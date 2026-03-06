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

export function registerReferenceSliceRuntimeLifecycleRegistrarDiagnosticsSuite() {
  test("runtime diagnostics surface missing collection handler registrar deterministically", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const moduleDir = path.join(tempModulesRoot, "widgets");
    await fs.mkdir(moduleDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(createRuntimeCollectionModuleManifest(), null, 2),
      "utf8"
    );

    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: tempModulesRoot
    });

    try {
      const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
      expect(runtimeResponse.statusCode).toBe(200);
      expect(runtimeResponse.body.ok).toBe(true);
      expect(runtimeResponse.body.runtime.ok).toBe(false);
      expect(runtimeResponse.body.runtime.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_REGISTRAR_NOT_FOUND",
            moduleId: "widgets",
            collectionIds: ["widgets"]
          })
        ])
      );
      expect(runtimeResponse.body.runtime.handlerDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_NOT_REGISTERED",
            collectionId: "widgets",
            moduleId: "widgets"
          })
        ])
      );
      expect(runtimeResponse.body.runtime.registeredCollectionHandlerIds).toEqual([]);
      expect(runtimeResponse.body.runtime.activeRegisteredCollectionHandlerIds).toEqual([]);
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("runtime diagnostics surface registrar import failures deterministically", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const moduleDir = path.join(tempModulesRoot, "widgets");
    await fs.mkdir(moduleDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(
        createRuntimeCollectionModuleManifest({
          runtimeEntrypoint: "./server/missing-entrypoint.mjs"
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
      expect(runtimeResponse.body.runtime.ok).toBe(false);
      expect(runtimeResponse.body.runtime.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_REGISTRAR_IMPORT_FAILED",
            moduleId: "widgets",
            collectionIds: ["widgets"],
            entrypoint: "./server/missing-entrypoint.mjs"
          })
        ])
      );
      expect(runtimeResponse.body.runtime.handlerDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_NOT_REGISTERED",
            collectionId: "widgets",
            moduleId: "widgets"
          })
        ])
      );
      expect(runtimeResponse.body.runtime.registeredCollectionHandlerIds).toEqual([]);
      expect(runtimeResponse.body.runtime.activeRegisteredCollectionHandlerIds).toEqual([]);
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("runtime diagnostics surface registrar path validation failures deterministically", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const moduleDir = path.join(tempModulesRoot, "widgets");
    await fs.mkdir(moduleDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(
        createRuntimeCollectionModuleManifest({
          runtimeEntrypoint: "../outside-module.mjs"
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
      expect(runtimeResponse.body.runtime.ok).toBe(false);
      expect(runtimeResponse.body.runtime.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_REGISTRAR_PATH_INVALID",
            moduleId: "widgets",
            collectionIds: ["widgets"]
          })
        ])
      );
      expect(runtimeResponse.body.runtime.handlerDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_NOT_REGISTERED",
            collectionId: "widgets",
            moduleId: "widgets"
          })
        ])
      );
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("runtime diagnostics surface registrar invalid export deterministically", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const moduleDir = path.join(tempModulesRoot, "widgets");
    const moduleServerDir = path.join(moduleDir, "server");
    await fs.mkdir(moduleServerDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(
        createRuntimeCollectionModuleManifest({
          runtimeEntrypoint: "./server/collection-handlers.mjs",
          persistenceEntrypoint: "./server/persistence-plugins.mjs"
        }),
        null,
        2
      ),
      "utf8"
    );
    await fs.writeFile(
      path.join(moduleServerDir, "collection-handlers.mjs"),
      "export const notRegistrar = true;\n",
      "utf8"
    );

    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: tempModulesRoot
    });

    try {
      const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
      expect(runtimeResponse.statusCode).toBe(200);
      expect(runtimeResponse.body.runtime.ok).toBe(false);
      expect(runtimeResponse.body.runtime.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_REGISTRAR_INVALID_EXPORT",
            moduleId: "widgets",
            collectionIds: ["widgets"],
            entrypoint: "./server/collection-handlers.mjs"
          })
        ])
      );
      expect(runtimeResponse.body.runtime.handlerDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_NOT_REGISTERED",
            collectionId: "widgets",
            moduleId: "widgets"
          })
        ])
      );
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("runtime diagnostics surface registrar execution failures deterministically", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const moduleDir = path.join(tempModulesRoot, "widgets");
    const moduleServerDir = path.join(moduleDir, "server");
    await fs.mkdir(moduleServerDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(
        createRuntimeCollectionModuleManifest({
          runtimeEntrypoint: "./server/collection-handlers.mjs",
          persistenceEntrypoint: "./server/persistence-plugins.mjs"
        }),
        null,
        2
      ),
      "utf8"
    );
    await fs.writeFile(
      path.join(moduleServerDir, "collection-handlers.mjs"),
      [
        "export function registerCollectionHandlers() {",
        "  throw new Error('widgets registrar exploded');",
        "}"
      ].join("\n"),
      "utf8"
    );

    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: tempModulesRoot
    });

    try {
      const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
      expect(runtimeResponse.statusCode).toBe(200);
      expect(runtimeResponse.body.runtime.ok).toBe(false);
      expect(runtimeResponse.body.runtime.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_REGISTRAR_FAILED",
            moduleId: "widgets",
            collectionIds: ["widgets"],
            entrypoint: "./server/collection-handlers.mjs",
            errorMessage: "widgets registrar exploded"
          })
        ])
      );
      expect(runtimeResponse.body.runtime.handlerDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_HANDLER_NOT_REGISTERED",
            collectionId: "widgets",
            moduleId: "widgets"
          })
        ])
      );
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

}


registerReferenceSliceSuiteWithServer(registerReferenceSliceRuntimeLifecycleRegistrarDiagnosticsSuite);

