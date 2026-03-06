import { registerReferenceSliceSuiteWithServer } from './helpers/reference-slice-suite-host.js';
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
} from "./helpers/reference-slice-runtime-test-helpers.js";

async function copyGeneratedRuntimeCoreModules(tempModulesRoot) {
  const sourceRecordsModuleDir = path.resolve(
    process.cwd(),
    "test",
    "fixtures",
    "generated-runtime-support",
    "records"
  );
  const sourceCapabilityKernelModuleDir = path.resolve(
    process.cwd(),
    "test",
    "fixtures",
    "generated-runtime-support",
    "capability-kernel"
  );
  await fs.cp(sourceRecordsModuleDir, path.join(tempModulesRoot, "records"), {
    recursive: true
  });
  await fs.cp(sourceCapabilityKernelModuleDir, path.join(tempModulesRoot, "capability-kernel"), {
    recursive: true
  });
}

export function registerReferenceSliceRuntimeLifecycleGeneratedCoreSuite() {
  test("module-owned registrar entrypoint registers collection handlers successfully", async () => {
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
        "export function registerCollectionHandlers({ registry }) {",
        "  registry.register({",
        "    collectionId: 'widgets',",
        "    moduleId: 'widgets',",
        "    handler: {",
        "      list: () => ({ items: [], meta: { total: 0 } })",
        "    }",
        "  });",
        "}"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(moduleServerDir, "persistence-plugins.mjs"),
      [
        "const state = { widgets: [] };",
        "const repository = {",
        "  async readState() {",
        "    return state;",
        "  },",
        "  async transact(mutator) {",
        "    return mutator(state);",
        "  }",
        "};",
        "",
        "export function registerPersistencePlugins({ registry }) {",
        "  registry.register({",
        "    pluginId: 'widgets-persistence',",
        "    moduleId: 'widgets',",
        "    collections: [",
        "      {",
        "        collectionId: 'widgets',",
        "        repository",
        "      }",
        "    ]",
        "  });",
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
      expect(runtimeResponse.body.runtime.ok).toBe(true);
      expect(runtimeResponse.body.runtime.diagnostics).toEqual([]);
      expect(runtimeResponse.body.runtime.handlerDiagnostics).toEqual([]);
      expect(runtimeResponse.body.runtime.registeredCollectionHandlerIds).toEqual(["widgets"]);

      const listResponse = await injectJson(ephemeral, "GET", "/api/reference/collections/widgets/items");
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.body.ok).toBe(true);
      expect(listResponse.body.collectionId).toBe("widgets");
      expect(listResponse.body.items).toEqual([]);
      expect(listResponse.body.meta).toEqual({
        total: 0
      });
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("generated runtime honors manifest primaryField semantics through API routes", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    await copyGeneratedRuntimeCoreModules(tempModulesRoot);
    const moduleDir = path.join(tempModulesRoot, "widgets-primary");
    const moduleServerDir = path.join(moduleDir, "server");
    await fs.mkdir(moduleServerDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(
        {
          contractVersion: 1,
          id: "widgets-primary",
          version: "0.1.0",
          name: "Widgets Primary Module",
          capabilities: ["ui.route", "schema", "crud.collection"],
          lifecycle: {
            install: "widgets-primary.install",
            uninstall: "widgets-primary.uninstall"
          },
          runtime: {
            collectionHandlers: "./server/collection-handlers.mjs",
            persistence: "./server/persistence-plugins.mjs"
          },
          collections: [
            {
              id: "widgets",
              label: "Widgets",
              primaryField: "name",
              description: "Widgets collection",
              capabilities: {
                list: true,
                read: true,
                create: true,
                update: true,
                delete: true
              },
              fields: [
                {
                  id: "name",
                  label: "Name",
                  type: "text",
                  required: true,
                  minLength: 2,
                  maxLength: 80
                },
                {
                  id: "nameSlug",
                  label: "Name Slug",
                  type: "computed",
                  source: "name",
                  resolver: "slugify"
                }
              ]
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );
    await fs.writeFile(
      path.join(moduleServerDir, "collection-handlers.mjs"),
      [
        "import { registerGeneratedCollectionHandlers } from \"../../records/server/shared/generated-proof-runtime.mjs\";",
        "",
        "const WIDGETS_PRIMARY_COLLECTIONS = Object.freeze([",
        "  {",
        "    collectionId: \"widgets\",",
        "    entitySingular: \"widget\",",
        "    idPrefix: \"wid\",",
        "    primaryField: \"name\"",
        "  }",
        "]);",
        "",
        "export function registerCollectionHandlers(context = {}) {",
        "  return registerGeneratedCollectionHandlers({",
        "    ...context,",
        "    moduleId: \"widgets-primary\",",
        "    collections: WIDGETS_PRIMARY_COLLECTIONS",
        "  });",
        "}"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(moduleServerDir, "persistence-plugins.mjs"),
      [
        "import {",
        "  registerGeneratedCollectionPersistencePlugins",
        "} from \"../../records/server/shared/generated-proof-runtime.mjs\";",
        "",
        "const WIDGETS_PRIMARY_COLLECTIONS = Object.freeze([",
        "  {",
        "    collectionId: \"widgets\",",
        "    entitySingular: \"widget\",",
        "    idPrefix: \"wid\",",
        "    primaryField: \"name\"",
        "  }",
        "]);",
        "",
        "export function registerPersistencePlugins(context = {}) {",
        "  return registerGeneratedCollectionPersistencePlugins({",
        "    ...context,",
        "    moduleId: \"widgets-primary\",",
        "    collections: WIDGETS_PRIMARY_COLLECTIONS,",
        "    persistenceMode: \"memory\"",
        "  });",
        "}"
      ].join("\n"),
      "utf8"
    );

    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: tempModulesRoot
    });

    try {
      const zuluCreate = await injectJson(ephemeral, "POST", "/api/reference/collections/widgets/items", {
        name: "Zulu Widget"
      });
      expect(zuluCreate.statusCode).toBe(201);
      expect(zuluCreate.body.ok).toBe(true);

      const alphaCreate = await injectJson(ephemeral, "POST", "/api/reference/collections/widgets/items", {
        name: "Alpha Widget"
      });
      expect(alphaCreate.statusCode).toBe(201);
      expect(alphaCreate.body.ok).toBe(true);

      const listResponse = await injectJson(ephemeral, "GET", "/api/reference/collections/widgets/items");
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.body.ok).toBe(true);
      expect(listResponse.body.items.map((item) => item.name)).toEqual([
        "Alpha Widget",
        "Zulu Widget"
      ]);

      const searchResponse = await injectJson(
        ephemeral,
        "GET",
        "/api/reference/collections/widgets/items?search=alpha"
      );
      expect(searchResponse.statusCode).toBe(200);
      expect(searchResponse.body.ok).toBe(true);
      expect(searchResponse.body.items).toHaveLength(1);
      expect(searchResponse.body.items[0].name).toBe("Alpha Widget");
      expect(searchResponse.body.filters.search).toBe("alpha");

      const duplicateCreate = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/collections/widgets/items",
        {
          name: "Alpha Widget"
        }
      );
      expect(duplicateCreate.statusCode).toBe(409);
      expect(duplicateCreate.body.ok).toBe(false);
      expect(duplicateCreate.body.error).toEqual(
        expect.objectContaining({
          code: "WIDGET_NAME_CONFLICT",
          message: "Widget name 'Alpha Widget' already exists"
        })
      );
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("generated runtime honors behavior.enforcePrimaryFieldUnique=false through API routes", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    await copyGeneratedRuntimeCoreModules(tempModulesRoot);
    const moduleDir = path.join(tempModulesRoot, "widgets-primary-nounique");
    const moduleServerDir = path.join(moduleDir, "server");
    await fs.mkdir(moduleServerDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(
        {
          contractVersion: 1,
          id: "widgets-primary-nounique",
          version: "0.1.0",
          name: "Widgets Primary No-Unique Module",
          capabilities: ["ui.route", "schema", "crud.collection"],
          lifecycle: {
            install: "widgets-primary-nounique.install",
            uninstall: "widgets-primary-nounique.uninstall"
          },
          runtime: {
            collectionHandlers: "./server/collection-handlers.mjs",
            persistence: "./server/persistence-plugins.mjs"
          },
          collections: [
            {
              id: "widgets",
              label: "Widgets",
              primaryField: "name",
              behavior: {
                enforcePrimaryFieldUnique: false,
                enforceTitleUnique: false
              },
              description: "Widgets collection",
              capabilities: {
                list: true,
                read: true,
                create: true,
                update: true,
                delete: true
              },
              fields: [
                {
                  id: "name",
                  label: "Name",
                  type: "text",
                  required: true,
                  minLength: 2,
                  maxLength: 80
                },
                {
                  id: "nameSlug",
                  label: "Name Slug",
                  type: "computed",
                  source: "name",
                  resolver: "slugify"
                }
              ]
            }
          ]
        },
        null,
        2
      ),
      "utf8"
    );
    await fs.writeFile(
      path.join(moduleServerDir, "collection-handlers.mjs"),
      [
        "import { registerGeneratedCollectionHandlers } from \"../../records/server/shared/generated-proof-runtime.mjs\";",
        "",
        "const WIDGETS_PRIMARY_NOUNIQUE_COLLECTIONS = Object.freeze([",
        "  {",
        "    collectionId: \"widgets\",",
        "    entitySingular: \"widget\",",
        "    idPrefix: \"wid\",",
        "    primaryField: \"name\"",
        "  }",
        "]);",
        "",
        "export function registerCollectionHandlers(context = {}) {",
        "  return registerGeneratedCollectionHandlers({",
        "    ...context,",
        "    moduleId: \"widgets-primary-nounique\",",
        "    collections: WIDGETS_PRIMARY_NOUNIQUE_COLLECTIONS",
        "  });",
        "}"
      ].join("\n"),
      "utf8"
    );
    await fs.writeFile(
      path.join(moduleServerDir, "persistence-plugins.mjs"),
      [
        "import {",
        "  registerGeneratedCollectionPersistencePlugins",
        "} from \"../../records/server/shared/generated-proof-runtime.mjs\";",
        "",
        "const WIDGETS_PRIMARY_NOUNIQUE_COLLECTIONS = Object.freeze([",
        "  {",
        "    collectionId: \"widgets\",",
        "    entitySingular: \"widget\",",
        "    idPrefix: \"wid\",",
        "    primaryField: \"name\"",
        "  }",
        "]);",
        "",
        "export function registerPersistencePlugins(context = {}) {",
        "  return registerGeneratedCollectionPersistencePlugins({",
        "    ...context,",
        "    moduleId: \"widgets-primary-nounique\",",
        "    collections: WIDGETS_PRIMARY_NOUNIQUE_COLLECTIONS,",
        "    persistenceMode: \"memory\"",
        "  });",
        "}"
      ].join("\n"),
      "utf8"
    );

    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: tempModulesRoot
    });

    try {
      const firstCreate = await injectJson(ephemeral, "POST", "/api/reference/collections/widgets/items", {
        name: "Alpha Widget"
      });
      expect(firstCreate.statusCode).toBe(201);
      expect(firstCreate.body.ok).toBe(true);

      const secondCreate = await injectJson(ephemeral, "POST", "/api/reference/collections/widgets/items", {
        name: "Alpha Widget"
      });
      expect(secondCreate.statusCode).toBe(201);
      expect(secondCreate.body.ok).toBe(true);

      const listResponse = await injectJson(ephemeral, "GET", "/api/reference/collections/widgets/items");
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.body.ok).toBe(true);
      expect(listResponse.body.items).toHaveLength(2);
      expect(listResponse.body.items.map((item) => item.name)).toEqual([
        "Alpha Widget",
        "Alpha Widget"
      ]);
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

}


registerReferenceSliceSuiteWithServer(registerReferenceSliceRuntimeLifecycleGeneratedCoreSuite);

