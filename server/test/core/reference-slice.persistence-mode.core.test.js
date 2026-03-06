import { registerReferenceSliceSuiteWithServer } from '../module-conformance/helpers/reference-slice-suite-host.js';
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { spec } from "pactum";
import { createReferenceStatePersistenceAdapter } from "../../src/domains/reference/runtime-kernel/state-persistence.js";
import { createReferenceState } from "../../src/domains/reference/runtime-kernel/state-utils.js";
import {
  createEphemeralReferenceServer,
  createModuleManifestWithoutCollections,
  createRuntimeCollectionModuleManifest,
  createRuntimeServiceMissionModuleManifest,
  createSharedReferenceStatePersistence,
  injectJson,
  waitForDeployJob,
  waitForDeployJobInInstance,
  waitForMissionJob
} from "../module-conformance/helpers/reference-slice-runtime-test-helpers.js";

export function registerReferenceSlicePersistencePolicyModeSuite() {
  test(
    "collection mutation returns deterministic persistence error when persistence write fails",
    async () => {
    const failingPersistenceAdapter = {
      async hydrateState() {
        return {
          ok: true,
          mode: "memory-test",
          diagnostics: []
        };
      },
      async persistRecordsNotesState() {
        const error = new Error("Simulated persistence failure");
        error.code = "REFERENCE_STATE_PERSISTENCE_FAILED";
        throw error;
      },
      async close() {
        // no-op
      }
    };

    let ephemeralServer = null;
    try {
      ephemeralServer = await createEphemeralReferenceServer({
        referenceStatePersistence: failingPersistenceAdapter
      });

      const createResponse = await injectJson(
        ephemeralServer,
        "POST",
        "/api/reference/collections/records/items",
        {
          title: "Persistence Failure Record",
          status: "draft",
          score: 40,
          featured: false,
          publishedOn: null,
          noteIds: []
        }
      );
      expect(createResponse.statusCode).toBe(500);
      expect(createResponse.body.error.code).toBe("REFERENCE_STATE_PERSISTENCE_FAILED");
      expect(typeof createResponse.body.error.message).toBe("string");
    } finally {
      if (ephemeralServer) {
        await ephemeralServer.close();
      }
    }
    },
    20_000
  );

  test(
    "collection mutation deploy payload stays coherent with immediate deploy-state reads",
    async () => {
    const ephemeral = await createEphemeralReferenceServer();

    try {
      const createResponse = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/collections/records/items",
        {
          title: "Deploy Parity Record",
          status: "draft",
          score: 60,
          featured: false,
          publishedOn: null,
          noteIds: []
        }
      );
      expect(createResponse.statusCode).toBe(201);

      const createDeployState = await injectJson(ephemeral, "GET", "/api/reference/deploy/state");
      expect(createDeployState.statusCode).toBe(200);
      expect(createDeployState.body.deploy).toEqual(
        expect.objectContaining({
          currentRevision: createResponse.body.deploy.currentRevision,
          deployRequired: createResponse.body.deploy.deployRequired,
          lastMutationAt: createResponse.body.deploy.lastMutationAt
        })
      );

      const itemId = createResponse.body.item.id;
      const updateResponse = await injectJson(
        ephemeral,
        "PUT",
        `/api/reference/collections/records/items/${itemId}`,
        {
          score: 61
        }
      );
      expect(updateResponse.statusCode).toBe(200);

      const updateDeployState = await injectJson(ephemeral, "GET", "/api/reference/deploy/state");
      expect(updateDeployState.statusCode).toBe(200);
      expect(updateDeployState.body.deploy).toEqual(
        expect.objectContaining({
          currentRevision: updateResponse.body.deploy.currentRevision,
          deployRequired: updateResponse.body.deploy.deployRequired,
          lastMutationAt: updateResponse.body.deploy.lastMutationAt
        })
      );

      const deleteResponse = await injectJson(
        ephemeral,
        "DELETE",
        `/api/reference/collections/records/items/${itemId}`
      );
      expect(deleteResponse.statusCode).toBe(200);

      const deleteDeployState = await injectJson(ephemeral, "GET", "/api/reference/deploy/state");
      expect(deleteDeployState.statusCode).toBe(200);
      expect(deleteDeployState.body.deploy).toEqual(
        expect.objectContaining({
          currentRevision: deleteResponse.body.deploy.currentRevision,
          deployRequired: deleteResponse.body.deploy.deployRequired,
          lastMutationAt: deleteResponse.body.deploy.lastMutationAt
        })
      );
    } finally {
      await ephemeral.close();
    }
    },
    20_000
  );

  test("reference-state persistence fails fast when Mongo is unavailable and fallback is disabled", async () => {
    const adapter = createReferenceStatePersistenceAdapter({
      enabled: true,
      mode: "auto",
      allowMemoryFallback: false,
      mongoUri: "mongodb://127.0.0.1:1/admin",
      serverSelectionTimeoutMs: 25
    });
    const state = createReferenceState();

    try {
      await expect(adapter.hydrateState(state)).rejects.toMatchObject({
        code: "REFERENCE_STATE_PERSISTENCE_INIT_FAILED"
      });
      expect(adapter.describe()).toEqual(
        expect.objectContaining({
          enabled: true,
          failFast: true,
          allowMemoryFallback: false
        })
      );
    } finally {
      await adapter.close();
    }
  });

  test("reference-state persistence enters degraded mode only when fallback is explicitly enabled", async () => {
    const adapter = createReferenceStatePersistenceAdapter({
      enabled: true,
      mode: "auto",
      allowMemoryFallback: true,
      mongoUri: "mongodb://127.0.0.1:1/admin",
      serverSelectionTimeoutMs: 25
    });
    const state = createReferenceState();

    try {
      const hydration = await adapter.hydrateState(state);
      expect(hydration.mode).toBe("memory-fallback");
      expect(hydration.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "REFERENCE_STATE_MONGO_UNAVAILABLE",
            runtimeMode: "memory-fallback",
            allowMemoryFallback: true
          })
        ])
      );
      expect(adapter.describe()).toEqual(
        expect.objectContaining({
          enabled: true,
          runtimeMode: "memory-fallback",
          failFast: false,
          allowMemoryFallback: true
        })
      );
    } finally {
      await adapter.close();
    }
  });

  test(
    "runtime metadata exposes reference-state persistence policy and mode deterministically",
    async () => {
    const adapter = createReferenceStatePersistenceAdapter({
      enabled: true,
      mode: "memory",
      allowMemoryFallback: false,
      mongoUri: "mongodb://127.0.0.1:27017/admin"
    });

    let ephemeral = null;
    try {
      ephemeral = await createEphemeralReferenceServer({
        referenceStatePersistence: adapter
      });

      const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
      expect(runtimeResponse.statusCode).toBe(200);
      expect(runtimeResponse.body.runtime.referenceStatePersistence).toEqual(
        expect.objectContaining({
          enabled: true,
          configuredMode: "memory",
          runtimeMode: "memory",
          allowMemoryFallback: false,
          failFast: true,
          mongoUriConfigured: true
        })
      );
      expect(runtimeResponse.body.runtime.collectionRepositoryPolicyMap).toEqual(
        expect.objectContaining({
          records: expect.objectContaining({
            configuredMode: "memory",
            runtimeMode: "memory",
            source: "reference-state-persistence",
            stateFilePath: null
          }),
          notes: expect.objectContaining({
            configuredMode: "memory",
            runtimeMode: "memory",
            source: "reference-state-persistence",
            stateFilePath: null
          }),
          articles: expect.objectContaining({
            configuredMode: "auto",
            runtimeMode: "memory",
            source: "default",
            stateFilePath: null
          })
        })
      );
      expect(runtimeResponse.body.runtime.settingsRepositoryPolicyMap).toEqual(
        expect.objectContaining({
          "test-modules-remotes-publish": expect.objectContaining({
            configuredMode: "memory",
            runtimeMode: "memory",
            source: "reference-state-persistence",
            stateFilePath: null
          }),
          "test-modules-crud-core": expect.objectContaining({
            configuredMode: "memory",
            runtimeMode: "memory",
            source: "reference-state-persistence",
            stateFilePath: null
          })
        })
      );
    } finally {
      if (ephemeral) {
        await ephemeral.close();
      }
      await adapter.close();
    }
    },
    20_000
  );
}


registerReferenceSliceSuiteWithServer(registerReferenceSlicePersistencePolicyModeSuite);

