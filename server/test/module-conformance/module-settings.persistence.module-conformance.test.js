import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { spec } from "pactum";
import { createReferenceStatePersistenceAdapter } from "../../src/domains/reference/runtime-kernel/state-persistence.js";
import { createReferenceState } from "../../src/domains/reference/runtime-kernel/state-utils.js";
import {
  buildReferenceModuleSettingsPath,
  createEphemeralReferenceServer,
  createModuleManifestWithoutCollections,
  createRuntimeCollectionModuleManifest,
  createRuntimeServiceMissionModuleManifest,
  createSharedReferenceStatePersistence,
  injectJson,
  resolveModuleSettingsSnapshotKey,
  waitForDeployJob,
  waitForDeployJobInInstance,
  waitForMissionJob
} from "./helpers/reference-slice-runtime-test-helpers.js";

const PERSISTENCE_RESTART_TIMEOUT_MS = 30_000;

function registerReferenceSliceModuleSettingsPersistenceConformanceSuite() {
  test(
    "module settings persist across restart when persistence adapter is shared",
    async () => {
    const sharedPersistence = createSharedReferenceStatePersistence();
    let firstServer = null;
    let secondServer = null;
    try {
      firstServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const firstUpdate = await injectJson(
        firstServer,
        "PUT",
        buildReferenceModuleSettingsPath("remotes"),
        {
          deployMode: "fast",
          deployTimeoutMs: 180000,
          verifyTls: false,
          controlPlaneUrl: "https://persisted.example.invalid/deploy",
          lastAuditOn: "2026-03-14",
          apiToken: "persisted-token"
        }
      );
      expect(firstUpdate.statusCode).toBe(200);
      expect(sharedPersistence.store.moduleSettingsSnapshot).toEqual(
        expect.objectContaining({
          [resolveModuleSettingsSnapshotKey("remotes")]: expect.objectContaining({
            deployMode: "fast",
            deployTimeoutMs: 180000,
            verifyTls: false,
            controlPlaneUrl: "https://persisted.example.invalid/deploy",
            lastAuditOn: "2026-03-14",
            apiToken: "persisted-token"
          })
        })
      );

      await firstServer.close();
      firstServer = null;

      secondServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const readAfterRestart = await injectJson(
        secondServer,
        "GET",
        buildReferenceModuleSettingsPath("remotes")
      );
      expect(readAfterRestart.statusCode).toBe(200);
      expect(readAfterRestart.body.settings.values).toEqual(
        expect.objectContaining({
          deployMode: "fast",
          deployTimeoutMs: 180000,
          verifyTls: false,
          controlPlaneUrl: "https://persisted.example.invalid/deploy",
          lastAuditOn: "2026-03-14",
          apiToken: null
        })
      );
      expect(readAfterRestart.body.settings.redactedFieldIds).toContain("apiToken");
    } finally {
      if (firstServer) {
        await firstServer.close();
      }
      if (secondServer) {
        await secondServer.close();
      }
    }
    },
    PERSISTENCE_RESTART_TIMEOUT_MS
  );


  test(
    "articles module settings persist across restart when persistence adapter is shared",
    async () => {
    const sharedPersistence = createSharedReferenceStatePersistence();
    let firstServer = null;
    let secondServer = null;
    try {
      firstServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const firstUpdate = await injectJson(
        firstServer,
        "PUT",
        buildReferenceModuleSettingsPath("articles"),
        {
          editorialMode: "strict",
          requireReview: false,
          defaultCategory: "ops",
          webhookToken: "persisted-articles-token"
        }
      );
      expect(firstUpdate.statusCode).toBe(200);
      expect(sharedPersistence.store.moduleSettingsSnapshot).toEqual(
        expect.objectContaining({
          [resolveModuleSettingsSnapshotKey("articles")]: expect.objectContaining({
            editorialMode: "strict",
            requireReview: false,
            defaultCategory: "ops",
            webhookToken: "persisted-articles-token"
          })
        })
      );

      await firstServer.close();
      firstServer = null;

      secondServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const readAfterRestart = await injectJson(
        secondServer,
        "GET",
        buildReferenceModuleSettingsPath("articles")
      );
      expect(readAfterRestart.statusCode).toBe(200);
      expect(readAfterRestart.body.settings.values).toEqual(
        expect.objectContaining({
          editorialMode: "strict",
          requireReview: false,
          defaultCategory: "ops",
          webhookToken: null
        })
      );
      expect(readAfterRestart.body.settings.redactedFieldIds).toContain("webhookToken");
    } finally {
      if (firstServer) {
        await firstServer.close();
      }
      if (secondServer) {
        await secondServer.close();
      }
    }
    },
    PERSISTENCE_RESTART_TIMEOUT_MS
  );


}

export { registerReferenceSliceModuleSettingsPersistenceConformanceSuite };

