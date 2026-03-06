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

export function registerReferenceSliceRuntimeLifecycleGeneratedValidationSuite() {
  test("generated runtime honors manifest-owned primary-field length constraints through API routes", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    await copyGeneratedRuntimeCoreModules(tempModulesRoot);
    const moduleDir = path.join(tempModulesRoot, "widgets-primary-length");
    const moduleServerDir = path.join(moduleDir, "server");
    await fs.mkdir(moduleServerDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(
        {
          contractVersion: 1,
          id: "widgets-primary-length",
          version: "0.1.0",
          name: "Widgets Primary Length Module",
          capabilities: ["ui.route", "schema", "crud.collection"],
          lifecycle: {
            install: "widgets-primary-length.install",
            uninstall: "widgets-primary-length.uninstall"
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
                  minLength: 4,
                  maxLength: 10
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
        "const WIDGETS_PRIMARY_LENGTH_COLLECTIONS = Object.freeze([",
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
        "    moduleId: \"widgets-primary-length\",",
        "    collections: WIDGETS_PRIMARY_LENGTH_COLLECTIONS",
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
        "const WIDGETS_PRIMARY_LENGTH_COLLECTIONS = Object.freeze([",
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
        "    moduleId: \"widgets-primary-length\",",
        "    collections: WIDGETS_PRIMARY_LENGTH_COLLECTIONS,",
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
      const shortCreate = await injectJson(ephemeral, "POST", "/api/reference/collections/widgets/items", {
        name: "abc"
      });
      expect(shortCreate.statusCode).toBe(400);
      expect(shortCreate.body.ok).toBe(false);
      expect(shortCreate.body.error).toEqual(
        expect.objectContaining({
          code: "WIDGET_NAME_TOO_SHORT",
          message: "Widget name must be at least 4 characters"
        })
      );

      const longCreate = await injectJson(ephemeral, "POST", "/api/reference/collections/widgets/items", {
        name: "ABCDEFGHIJK"
      });
      expect(longCreate.statusCode).toBe(400);
      expect(longCreate.body.ok).toBe(false);
      expect(longCreate.body.error).toEqual(
        expect.objectContaining({
          code: "WIDGET_NAME_TOO_LONG",
          message: "Widget name must be at most 10 characters"
        })
      );

      const validCreate = await injectJson(ephemeral, "POST", "/api/reference/collections/widgets/items", {
        name: "Alpha"
      });
      expect(validCreate.statusCode).toBe(201);
      expect(validCreate.body.ok).toBe(true);
      expect(validCreate.body.item.name).toBe("Alpha");
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("records validation profile resolves enum constraints from module manifest", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const recordsModuleDir = path.join(tempModulesRoot, "records");
    await copyGeneratedRuntimeCoreModules(tempModulesRoot);

    const manifestPath = path.join(recordsModuleDir, "module.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const recordsCollection =
      manifest.collections?.find((collection) => collection?.id === "records") ?? null;
    const statusField = recordsCollection?.fields?.find((field) => field?.id === "status") ?? null;
    if (!statusField) {
      throw new Error("records status field was not found in copied records module manifest");
    }
    statusField.options = ["draft", "archived"];
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: tempModulesRoot
    });

    try {
      const archivedCreate = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/collections/records/items",
        {
          title: "Archived Status Contract Item",
          status: "archived",
          score: 50,
          featured: false,
          publishedOn: null,
          noteIds: []
        }
      );
      expect(archivedCreate.statusCode).toBe(201);
      expect(archivedCreate.body.ok).toBe(true);
      expect(archivedCreate.body.item.status).toBe("archived");

      const archivedList = await injectJson(
        ephemeral,
        "GET",
        "/api/reference/collections/records/items?status=archived"
      );
      expect(archivedList.statusCode).toBe(200);
      expect(archivedList.body.ok).toBe(true);
      expect(archivedList.body.items.map((item) => item.id)).toContain(archivedCreate.body.item.id);

      const reviewCreate = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/collections/records/items",
        {
          title: "Review Status Should Fail",
          status: "review",
          score: 50,
          featured: false,
          publishedOn: null,
          noteIds: []
        }
      );
      expect(reviewCreate.statusCode).toBe(400);
      expect(reviewCreate.body.error.code).toBe("RECORD_STATUS_INVALID");
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

}


registerReferenceSliceSuiteWithServer(registerReferenceSliceRuntimeLifecycleGeneratedValidationSuite);

