import { registerReferenceSliceSuiteWithServer } from "../module-conformance/helpers/reference-slice-suite-host.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { spec } from "pactum";
import {
  createEphemeralReferenceServer,
  createModuleManifestWithoutCollections,
  injectJson
} from "../module-conformance/helpers/reference-slice-runtime-test-helpers.js";

const ACTIVE_MODULE_IDS = Object.freeze([
  "test-modules-crud-core",
  "test-modules-operations-dispatch",
  "test-modules-relations-taxonomy",
  "test-modules-remotes-publish",
  "test-modules-settings-policy"
]);

function sortIds(values = []) {
  return [...values].sort();
}

export function registerReferenceSliceRuntimeLifecycleDiscoverySuite() {
  test("GET /api/reference/modules returns the active five-module navigation payload", async () => {
    const response = await spec().get("/api/reference/modules").expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.runtimeOk).toBe(true);
    expect(response.body.diagnosticsCount).toBe(0);

    const ids = sortIds(response.body.items.map((item) => item.id));
    expect(ids).toEqual(ACTIVE_MODULE_IDS);
    expect(response.body.items).toHaveLength(5);
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "test-modules-crud-core",
          label: "Test Modules CRUD Core",
          state: "enabled",
          routeAvailability: expect.objectContaining({
            policy: "visible-but-unavailable",
            visible: true,
            routeAvailable: true,
            state: "enabled"
          })
        }),
        expect.objectContaining({
          id: "test-modules-operations-dispatch",
          label: "Test Modules Operations Dispatch"
        }),
        expect.objectContaining({
          id: "test-modules-relations-taxonomy",
          label: "Test Modules Relations Taxonomy"
        }),
        expect.objectContaining({
          id: "test-modules-remotes-publish",
          label: "Test Modules Remotes Publish"
        }),
        expect.objectContaining({
          id: "test-modules-settings-policy",
          label: "Test Modules Settings Policy"
        })
      ])
    );
  });

  test("GET /api/reference/modules does not apply static navigation fallback when no modules are discovered", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: tempModulesRoot
    });

    try {
      const modulesResponse = await injectJson(ephemeral, "GET", "/api/reference/modules");
      expect(modulesResponse.statusCode).toBe(200);
      expect(modulesResponse.body.ok).toBe(true);
      expect(modulesResponse.body.items).toEqual([]);
      expect(modulesResponse.body.runtimeOk).toBe(true);
      expect(modulesResponse.body.diagnosticsCount).toBe(0);
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("GET /api/reference/modules reflects lifecycle state in navigation semantics", async () => {
    const moduleId = "test-modules-crud-core";
    await spec().post(`/api/reference/modules/${moduleId}/disable`).expectStatus(200);
    try {
      const modulesResponse = await spec().get("/api/reference/modules").expectStatus(200);
      const moduleNavigationItem =
        modulesResponse.body.items.find((item) => item.id === moduleId) ?? null;

      expect(moduleNavigationItem).toEqual(
        expect.objectContaining({
          id: moduleId,
          state: "disabled",
          routeAvailability: expect.objectContaining({
            policy: "visible-but-unavailable",
            visible: true,
            routeAvailable: false,
            state: "disabled"
          })
        })
      );
    } finally {
      await spec().post(`/api/reference/modules/${moduleId}/enable`).expectStatus(200);
    }
  });

  test("dispatches continuity remains deterministic through the operations-dispatch module ownership map", async () => {
    const modulesResponse = await spec().get("/api/reference/modules").expectStatus(200);
    expect(modulesResponse.body.ok).toBe(true);
    expect(modulesResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "test-modules-operations-dispatch",
          label: "Test Modules Operations Dispatch"
        })
      ])
    );

    const runtimeResponse = await spec().get("/api/reference/modules/runtime").expectStatus(200);
    expect(runtimeResponse.body.ok).toBe(true);
    expect(runtimeResponse.body.runtime.moduleCollectionIds).toEqual(
      expect.arrayContaining(["dispatches"])
    );
    expect(runtimeResponse.body.runtime.registeredCollectionHandlerIds).toEqual(
      expect.arrayContaining(["dispatches"])
    );
    expect(runtimeResponse.body.runtime.collectionHandlerModuleMap).toEqual(
      expect.objectContaining({
        dispatches: "test-modules-operations-dispatch"
      })
    );
    expect(runtimeResponse.body.runtime.collectionRepositoryModuleMap).toEqual(
      expect.objectContaining({
        dispatches: "test-modules-operations-dispatch"
      })
    );
    expect(runtimeResponse.body.runtime.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "test-modules-operations-dispatch",
          state: "enabled",
          collectionIds: expect.arrayContaining(["dispatches"])
        })
      ])
    );
  });

  test("runtime collection definitions resolve from manifest truth without static records/notes fallback ownership", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const moduleDir = path.join(tempModulesRoot, "records");
    await fs.mkdir(moduleDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(
        createModuleManifestWithoutCollections({
          moduleId: "records"
        }),
        null,
        2
      ),
      "utf8"
    );

    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: tempModulesRoot
    });

    try {
      const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
      expect(runtimeResponse.statusCode).toBe(200);
      expect(runtimeResponse.body.ok).toBe(true);
      expect(runtimeResponse.body.runtime.ok).toBe(true);
      expect(runtimeResponse.body.runtime.moduleCollectionIds).toEqual([]);
      expect(runtimeResponse.body.runtime.collectionModuleMap).toEqual({});
      expect(runtimeResponse.body.runtime.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "records",
            collectionIds: []
          })
        ])
      );

      const collectionsResponse = await injectJson(ephemeral, "GET", "/api/reference/collections");
      expect(collectionsResponse.statusCode).toBe(200);
      expect(collectionsResponse.body.ok).toBe(true);
      expect(collectionsResponse.body.items).toEqual([]);
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("GET /api/reference/modules/runtime returns diagnostics and five-module ownership maps", async () => {
    const response = await spec().get("/api/reference/modules/runtime").expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.runtime).toEqual(
      expect.objectContaining({
        ok: true,
        modulesDir: expect.any(String),
        diagnostics: [],
        collectionDiagnostics: [],
        handlerDiagnostics: [],
        serviceDiagnostics: [],
        missionDiagnostics: [],
        persistencePluginDiagnostics: [],
        moduleSettingsDiagnostics: [],
        moduleSourcePosture: expect.objectContaining({
          trackedModuleIds: expect.any(Array),
          untrackedModuleIds: expect.any(Array),
          unknownModuleIds: expect.any(Array),
          hasUntrackedModules: expect.any(Boolean),
          reproducible: expect.any(Boolean),
          warningCount: expect.any(Number),
          warnings: expect.any(Array)
        }),
        referenceStatePersistence: expect.objectContaining({
          configuredMode: "auto"
        }),
        persistence: expect.objectContaining({
          source: expect.any(String)
        }),
        moduleIdTranslation: expect.objectContaining({
          discoveredModuleCount: 5,
          discoveredTargetModuleCount: 5
        })
      })
    );

    expect(sortIds(response.body.runtime.moduleIdTranslation.discoveredModuleIds)).toEqual(
      ACTIVE_MODULE_IDS
    );
    expect(sortIds(response.body.runtime.moduleSettingsIds)).toEqual(ACTIVE_MODULE_IDS);
    expect(sortIds(response.body.runtime.items.map((item) => item.id))).toEqual(ACTIVE_MODULE_IDS);

    expect(response.body.runtime.moduleCollectionIds).toEqual(
      expect.arrayContaining([
        "records",
        "notes",
        "dispatches",
        "iter2-gates",
        "wpx-posts"
      ])
    );
    expect(response.body.runtime.collectionHandlerModuleMap).toEqual(
      expect.objectContaining({
        records: "test-modules-crud-core",
        dispatches: "test-modules-operations-dispatch",
        authors: "test-modules-relations-taxonomy",
        "wpx-posts": "test-modules-remotes-publish",
        "iter2-gates": "test-modules-settings-policy"
      })
    );
    expect(response.body.runtime.collectionRepositoryModuleMap).toEqual(
      expect.objectContaining({
        records: "test-modules-crud-core",
        dispatches: "test-modules-operations-dispatch",
        authors: "test-modules-relations-taxonomy",
        "wpx-posts": "test-modules-remotes-publish",
        "iter2-gates": "test-modules-settings-policy"
      })
    );
    expect(response.body.runtime.serviceModuleMap).toEqual(
      expect.objectContaining({
        "remote-deploy-connector": "test-modules-remotes-publish",
        "dispatches-index-service": "test-modules-operations-dispatch",
        "settings-policy-service": "test-modules-settings-policy"
      })
    );
    expect(response.body.runtime.missionModuleMap).toEqual(
      expect.objectContaining({
        "remote-deploy-mission": "test-modules-remotes-publish",
        "iter5-playbook-run-mission": "test-modules-operations-dispatch"
      })
    );
    expect(response.body.runtime.persistencePluginModuleMap).toEqual(
      expect.objectContaining({
        "test-modules-crud-core-records-persistence": "test-modules-crud-core",
        "test-modules-operations-dispatch-dispatches-persistence":
          "test-modules-operations-dispatch",
        "test-modules-relations-taxonomy-authors-persistence":
          "test-modules-relations-taxonomy",
        "test-modules-remotes-publish-remotes-persistence": "test-modules-remotes-publish",
        "test-modules-settings-policy-iter2-gates-persistence":
          "test-modules-settings-policy"
      })
    );
    expect(response.body.runtime.settingsRepositoryModuleMap).toEqual(
      expect.objectContaining({
        "test-modules-crud-core": expect.any(String),
        "test-modules-operations-dispatch": expect.any(String),
        "test-modules-relations-taxonomy": expect.any(String),
        "test-modules-remotes-publish": expect.any(String),
        "test-modules-settings-policy": expect.any(String)
      })
    );
    expect(response.body.runtime.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "test-modules-crud-core",
          state: "enabled",
          collectionIds: expect.arrayContaining(["records", "notes", "articles"])
        }),
        expect.objectContaining({
          id: "test-modules-operations-dispatch",
          state: "enabled",
          collectionIds: expect.arrayContaining(["dispatches", "iter5-playbooks"])
        }),
        expect.objectContaining({
          id: "test-modules-relations-taxonomy",
          state: "enabled",
          collectionIds: expect.arrayContaining(["authors", "publishers", "wpx-terms"])
        }),
        expect.objectContaining({
          id: "test-modules-remotes-publish",
          state: "enabled",
          collectionIds: expect.arrayContaining(["briefs", "wpx-posts"])
        }),
        expect.objectContaining({
          id: "test-modules-settings-policy",
          state: "enabled",
          collectionIds: expect.arrayContaining(["iter2-gates", "wpx-settings"])
        })
      ])
    );
  });
}

registerReferenceSliceSuiteWithServer(registerReferenceSliceRuntimeLifecycleDiscoverySuite);

