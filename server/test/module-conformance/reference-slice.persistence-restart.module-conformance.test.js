import { registerReferenceSliceSuiteWithServer } from './helpers/reference-slice-suite-host.js';
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { spec } from "pactum";
import { createReferenceStatePersistenceAdapter } from "../../src/domains/reference/runtime-kernel/state-persistence.js";
import { createReferenceState } from "../../src/domains/reference/runtime-kernel/state-utils.js";
import {
  buildReferenceModuleLifecyclePath,
  createEphemeralReferenceServer,
  createModuleManifestWithoutCollections,
  createRuntimeCollectionModuleManifest,
  createRuntimeServiceMissionModuleManifest,
  createSharedReferenceStatePersistence,
  injectJson,
  resolveReferenceModuleId,
  waitForDeployJob,
  waitForDeployJobInInstance,
  waitForMissionJob
} from "./helpers/reference-slice-runtime-test-helpers.js";

const RECORDS_MODULE_ID = resolveReferenceModuleId("records");
const REMOTES_MODULE_ID = resolveReferenceModuleId("remotes");

export function registerReferenceSlicePersistencePolicyRestartSuite() {
  test(
    "module lifecycle state persists across restart and keeps collection availability aligned",
    async () => {
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-m11-runtime-"));
    const runtimeStateFile = path.join(runtimeDir, "module-runtime-state.json");
    let firstServer = null;
    let secondServer = null;

    try {
      firstServer = await createEphemeralReferenceServer({
        moduleRuntimeStateFile: runtimeStateFile
      });

      const disableResponse = await injectJson(
        firstServer,
        "POST",
        buildReferenceModuleLifecyclePath("records", "disable")
      );
      expect(disableResponse.statusCode).toBe(200);
      expect(disableResponse.body.state.after).toBe("disabled");

      const persistedAfterDisable = JSON.parse(
        await fs.readFile(runtimeStateFile, "utf8")
      );
      expect(persistedAfterDisable.modules[RECORDS_MODULE_ID]).toBe("disabled");

      await firstServer.close();
      firstServer = null;

      secondServer = await createEphemeralReferenceServer({
        moduleRuntimeStateFile: runtimeStateFile
      });

      const runtimeResponse = await injectJson(
        secondServer,
        "GET",
        "/api/reference/modules/runtime"
      );
      expect(runtimeResponse.statusCode).toBe(200);
      const recordsRuntime = runtimeResponse.body.runtime.items.find(
        (item) => item.id === RECORDS_MODULE_ID
      );
      expect(recordsRuntime?.state).toBe("disabled");
      expect(runtimeResponse.body.runtime.activeCollectionIds).not.toContain("records");
      expect(runtimeResponse.body.runtime.activeCollectionIds).not.toContain("notes");

      const recordsListBlocked = await injectJson(
        secondServer,
        "GET",
        "/api/reference/collections/records/items"
      );
      expect(recordsListBlocked.statusCode).toBe(404);
      expect(recordsListBlocked.body.error.code).toBe("COLLECTION_NOT_FOUND");

      const enableResponse = await injectJson(
        secondServer,
        "POST",
        buildReferenceModuleLifecyclePath("records", "enable")
      );
      expect(enableResponse.statusCode).toBe(200);
      expect(enableResponse.body.state.after).toBe("enabled");

      const persistedAfterEnable = JSON.parse(
        await fs.readFile(runtimeStateFile, "utf8")
      );
      expect(persistedAfterEnable.modules[RECORDS_MODULE_ID]).toBe("enabled");
    } finally {
      if (firstServer) {
        await firstServer.close();
      }
      if (secondServer) {
        await secondServer.close();
      }
      await fs.rm(runtimeDir, {
        recursive: true,
        force: true
      });
    }
    },
    30_000
  );

  test("startup reconciliation surfaces diagnostics for orphan and invalid persisted module states", async () => {
    const runtimeDir = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-m11-runtime-"));
    const runtimeStateFile = path.join(runtimeDir, "module-runtime-state.json");
    let ephemeralServer = null;

    try {
      await fs.writeFile(
        runtimeStateFile,
        `${JSON.stringify(
          {
            version: 1,
            modules: {
              [RECORDS_MODULE_ID]: "disabled",
              "ghost-module": "enabled",
              [REMOTES_MODULE_ID]: "bogus-state"
            },
            updatedAt: "2026-02-12T00:00:00.000Z"
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      ephemeralServer = await createEphemeralReferenceServer({
        moduleRuntimeStateFile: runtimeStateFile
      });

      const runtimeResponse = await injectJson(
        ephemeralServer,
        "GET",
        "/api/reference/modules/runtime"
      );
      expect(runtimeResponse.statusCode).toBe(200);
      expect(runtimeResponse.body.runtime.ok).toBe(false);
      expect(runtimeResponse.body.runtime.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "MODULE_RUNTIME_STATE_INVALID",
            moduleId: REMOTES_MODULE_ID
          }),
          expect.objectContaining({
            code: "MODULE_RUNTIME_STATE_ORPHAN_MODULE",
            moduleId: "ghost-module"
          })
        ])
      );
      expect(runtimeResponse.body.runtime.persistence).toEqual(
        expect.objectContaining({
          enabled: true,
          source: "file",
          appliedCount: 1
        })
      );

      const recordsRuntime = runtimeResponse.body.runtime.items.find(
        (item) => item.id === RECORDS_MODULE_ID
      );
      const remotesRuntime = runtimeResponse.body.runtime.items.find(
        (item) => item.id === REMOTES_MODULE_ID
      );
      expect(recordsRuntime?.state).toBe("disabled");
      expect(remotesRuntime?.state).toBe("enabled");
      expect(runtimeResponse.body.runtime.activeCollectionIds).not.toContain("records");
      expect(runtimeResponse.body.runtime.activeCollectionIds).not.toContain("notes");
    } finally {
      if (ephemeralServer) {
        await ephemeralServer.close();
      }
      await fs.rm(runtimeDir, {
        recursive: true,
        force: true
      });
    }
  }, 30_000);

  test("records and notes state persists across restart when persistence adapter is shared", async () => {
    const sharedPersistence = createSharedReferenceStatePersistence();
    let firstServer = null;
    let secondServer = null;

    try {
      firstServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const createdNote = await injectJson(
        firstServer,
        "POST",
        "/api/reference/collections/notes/items",
        {
          title: "Persistent Note",
          category: "ops",
          labels: ["ops"],
          priority: 2,
          pinned: false,
          dueDate: null,
          recordId: null
        }
      );
      expect(createdNote.statusCode).toBe(201);
      const noteId = createdNote.body.item.id;

      const createdRecord = await injectJson(
        firstServer,
        "POST",
        "/api/reference/collections/records/items",
        {
          title: "Persistent Record",
          status: "draft",
          score: 61,
          featured: false,
          publishedOn: null,
          noteIds: [noteId]
        }
      );
      expect(createdRecord.statusCode).toBe(201);
      const recordId = createdRecord.body.item.id;

      await firstServer.close();
      firstServer = null;

      secondServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const readRecord = await injectJson(
        secondServer,
        "GET",
        `/api/reference/collections/records/items/${recordId}`
      );
      expect(readRecord.statusCode).toBe(200);
      expect(readRecord.body.item).toEqual(
        expect.objectContaining({
          id: recordId,
          title: "Persistent Record",
          noteIds: [noteId]
        })
      );

      const readNote = await injectJson(
        secondServer,
        "GET",
        `/api/reference/collections/notes/items/${noteId}`
      );
      expect(readNote.statusCode).toBe(200);
      expect(readNote.body.item).toEqual(
        expect.objectContaining({
          id: noteId,
          title: "Persistent Note"
        })
      );
    } finally {
      if (firstServer) {
        await firstServer.close();
      }
      if (secondServer) {
        await secondServer.close();
      }
    }
  }, 30_000);

  test("remotes and deploy state persist across restart when persistence adapter is shared", async () => {
    const sharedPersistence = createSharedReferenceStatePersistence();
    let firstServer = null;
    let secondServer = null;

    try {
      firstServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const createRemote = await injectJson(
        firstServer,
        "POST",
        "/api/reference/remotes",
        {
          label: "Persistent Remote",
          kind: "http",
          endpoint: "https://persistent.example.invalid/deploy",
          enabled: true
        }
      );
      expect(createRemote.statusCode).toBe(201);
      const remoteId = createRemote.body.item.id;

      const deployStateBeforeRestart = await injectJson(
        firstServer,
        "GET",
        "/api/reference/deploy/state"
      );
      expect(deployStateBeforeRestart.statusCode).toBe(200);
      expect(deployStateBeforeRestart.body.deploy).toEqual(
        expect.objectContaining({
          deployRequired: true,
          currentRevision: expect.any(Number)
        })
      );

      await firstServer.close();
      firstServer = null;

      secondServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const remotesAfterRestart = await injectJson(
        secondServer,
        "GET",
        "/api/reference/remotes"
      );
      expect(remotesAfterRestart.statusCode).toBe(200);
      expect(remotesAfterRestart.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: remoteId,
            label: "Persistent Remote"
          })
        ])
      );

      const deployStateAfterRestart = await injectJson(
        secondServer,
        "GET",
        "/api/reference/deploy/state"
      );
      expect(deployStateAfterRestart.statusCode).toBe(200);
      expect(deployStateAfterRestart.body.deploy).toEqual(
        expect.objectContaining({
          deployRequired: true,
          currentRevision: deployStateBeforeRestart.body.deploy.currentRevision
        })
      );
    } finally {
      if (firstServer) {
        await firstServer.close();
      }
      if (secondServer) {
        await secondServer.close();
      }
    }
  }, 30_000);

  test("products and taxonomies state persists across restart when persistence adapter is shared", async () => {
    const sharedPersistence = createSharedReferenceStatePersistence();
    let firstServer = null;
    let secondServer = null;

    try {
      firstServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const updateTags = await injectJson(
        firstServer,
        "POST",
        "/api/reference/products/prd-001/tags",
        {
          tagIds: ["tag-001"],
          newTagLabel: "Persistent Tag",
          approveNewTag: true
        }
      );
      expect(updateTags.statusCode).toBe(200);
      const createdTagId = updateTags.body.meta?.createdTag?.id;
      expect(createdTagId).toBeTruthy();

      await firstServer.close();
      firstServer = null;

      secondServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const tagsAfterRestart = await injectJson(
        secondServer,
        "GET",
        "/api/reference/taxonomies/tags"
      );
      expect(tagsAfterRestart.statusCode).toBe(200);
      expect(tagsAfterRestart.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: createdTagId,
            label: "Persistent Tag"
          })
        ])
      );

      const productsAfterRestart = await injectJson(
        secondServer,
        "GET",
        "/api/reference/products"
      );
      expect(productsAfterRestart.statusCode).toBe(200);
      const product = productsAfterRestart.body.items.find((item) => item.id === "prd-001");
      expect(product).toBeTruthy();
      expect(product.tagLabels).toContain("Persistent Tag");
    } finally {
      if (firstServer) {
        await firstServer.close();
      }
      if (secondServer) {
        await secondServer.close();
      }
    }
  });

  test("deploy and mission job state persists across restart when persistence adapter is shared", async () => {
    const sharedPersistence = createSharedReferenceStatePersistence();
    let firstServer = null;
    let secondServer = null;

    try {
      firstServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const mutateForDeploy = await injectJson(
        firstServer,
        "POST",
        "/api/reference/products/prd-002/tags",
        {
          tagIds: ["tag-003", "tag-004"],
          approveNewTag: false
        }
      );
      expect(mutateForDeploy.statusCode).toBe(200);

      const deploySubmit = await injectJson(
        firstServer,
        "POST",
        "/api/reference/deploy/jobs",
        {
          remoteId: "remote-001"
        }
      );
      expect(deploySubmit.statusCode).toBe(202);
      const deployJobId = deploySubmit.body.job.id;

      const deployTerminalJob = await waitForDeployJobInInstance(
        firstServer,
        deployJobId
      );
      expect(deployTerminalJob.status).toBe("succeeded");

      const missionSubmit = await injectJson(
        firstServer,
        "POST",
        "/api/reference/missions/remote-deploy-mission/jobs",
        {
          remoteId: "remote-001"
        }
      );
      expect(missionSubmit.statusCode).toBe(202);
      const missionJobId = missionSubmit.body.job.id;

      const missionTerminalJob = await waitForMissionJob(firstServer, missionJobId);
      expect(missionTerminalJob.status).toBe("succeeded");

      await firstServer.close();
      firstServer = null;

      secondServer = await createEphemeralReferenceServer({
        referenceStatePersistence: sharedPersistence.adapter
      });

      const deployJobAfterRestart = await injectJson(
        secondServer,
        "GET",
        `/api/reference/deploy/jobs/${deployJobId}`
      );
      expect(deployJobAfterRestart.statusCode).toBe(200);
      expect(deployJobAfterRestart.body.job).toEqual(
        expect.objectContaining({
          id: deployJobId,
          status: "succeeded"
        })
      );

      const missionJobAfterRestart = await injectJson(
        secondServer,
        "GET",
        `/api/reference/missions/jobs/${missionJobId}`
      );
      expect(missionJobAfterRestart.statusCode).toBe(200);
      expect(missionJobAfterRestart.body.job).toEqual(
        expect.objectContaining({
          id: missionJobId,
          status: "succeeded"
        })
      );

      const deployJobListAfterRestart = await injectJson(
        secondServer,
        "GET",
        "/api/reference/deploy/jobs"
      );
      expect(deployJobListAfterRestart.statusCode).toBe(200);
      expect(
        deployJobListAfterRestart.body.items.map((item) => item.id)
      ).toContain(deployJobId);

      const missionJobListAfterRestart = await injectJson(
        secondServer,
        "GET",
        "/api/reference/missions/jobs"
      );
      expect(missionJobListAfterRestart.statusCode).toBe(200);
      expect(
        missionJobListAfterRestart.body.items.map((item) => item.id)
      ).toContain(missionJobId);

      const submitAfterRestart = await injectJson(
        secondServer,
        "POST",
        "/api/reference/missions/remote-deploy-mission/jobs",
        {
          remoteId: "remote-002"
        }
      );
      expect(submitAfterRestart.statusCode).toBe(202);

      const maxPersistedSequence = Math.max(
        Number.parseInt(deployJobId.split("-")[1], 10),
        Number.parseInt(missionJobId.split("-")[1], 10)
      );
      const nextSequence = Number.parseInt(
        submitAfterRestart.body.job.id.split("-")[1],
        10
      );
      expect(nextSequence).toBeGreaterThan(maxPersistedSequence);
    } finally {
      if (firstServer) {
        await firstServer.close();
      }
      if (secondServer) {
        await secondServer.close();
      }
    }
  });

}


registerReferenceSliceSuiteWithServer(registerReferenceSlicePersistencePolicyRestartSuite);

