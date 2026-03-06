import { registerReferenceSliceSuiteWithServer } from './helpers/reference-slice-suite-host.js';
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import {
  createEphemeralReferenceServer,
  injectJson
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

export function registerReferenceSliceCollectionsReferenceDeletePolicySuite() {
  test("generated delete flow enforces reference restrict/nullify policies with guided route actions", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    await copyGeneratedRuntimeCoreModules(tempModulesRoot);
    const moduleDir = path.join(tempModulesRoot, "wpmt-delete-policy");
    const moduleServerDir = path.join(moduleDir, "server");
    await fs.mkdir(moduleServerDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(
        {
          contractVersion: 1,
          id: "wpmt-delete-policy",
          version: "0.1.0",
          name: "WPMT Delete Policy Module",
          capabilities: ["ui.route", "schema", "crud.collection"],
          lifecycle: {
            install: "wpmt-delete-policy.install",
            uninstall: "wpmt-delete-policy.uninstall"
          },
          runtime: {
            collectionHandlers: "./server/collection-handlers.mjs",
            persistence: "./server/persistence-plugins.mjs"
          },
          collections: [
            {
              id: "authors",
              label: "Authors",
              entitySingular: "author",
              primaryField: "name",
              description: "Authors collection",
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
                  required: true
                },
                {
                  id: "handle",
                  label: "Handle",
                  type: "text",
                  required: true
                }
              ]
            },
            {
              id: "posts",
              label: "Posts",
              entitySingular: "post",
              primaryField: "title",
              description: "Posts collection",
              capabilities: {
                list: true,
                read: true,
                create: true,
                update: true,
                delete: true
              },
              fields: [
                {
                  id: "title",
                  label: "Title",
                  type: "text",
                  required: true
                },
                {
                  id: "authorId",
                  label: "Author",
                  type: "reference",
                  required: false,
                  collectionId: "authors",
                  labelField: "handle",
                  onDelete: "restrict"
                },
                {
                  id: "coAuthorIds",
                  label: "Co-Authors",
                  type: "reference-multi",
                  required: false,
                  collectionId: "authors",
                  labelField: "handle",
                  onDelete: "nullify"
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
        "const WPMT_DELETE_POLICY_COLLECTIONS = Object.freeze([",
        "  {",
        "    collectionId: \"authors\",",
        "    entitySingular: \"author\",",
        "    idPrefix: \"aut\",",
        "    primaryField: \"name\"",
        "  },",
        "  {",
        "    collectionId: \"posts\",",
        "    entitySingular: \"post\",",
        "    idPrefix: \"pst\",",
        "    primaryField: \"title\"",
        "  }",
        "]);",
        "",
        "export function registerCollectionHandlers(context = {}) {",
        "  return registerGeneratedCollectionHandlers({",
        "    ...context,",
        "    moduleId: \"wpmt-delete-policy\",",
        "    collections: WPMT_DELETE_POLICY_COLLECTIONS",
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
        "const WPMT_DELETE_POLICY_COLLECTIONS = Object.freeze([",
        "  {",
        "    collectionId: \"authors\",",
        "    entitySingular: \"author\",",
        "    idPrefix: \"aut\",",
        "    primaryField: \"name\"",
        "  },",
        "  {",
        "    collectionId: \"posts\",",
        "    entitySingular: \"post\",",
        "    idPrefix: \"pst\",",
        "    primaryField: \"title\"",
        "  }",
        "]);",
        "",
        "export function registerPersistencePlugins(context = {}) {",
        "  return registerGeneratedCollectionPersistencePlugins({",
        "    ...context,",
        "    moduleId: \"wpmt-delete-policy\",",
        "    collections: WPMT_DELETE_POLICY_COLLECTIONS,",
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
      const authorOneCreate = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/collections/authors/items",
        {
          name: "Alice",
          handle: "alice-handle"
        }
      );
      expect(authorOneCreate.statusCode).toBe(201);
      expect(authorOneCreate.body.ok).toBe(true);
      const authorOneId = authorOneCreate.body.item.id;

      const restrictPostCreate = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/collections/posts/items",
        {
          title: "Restrict Post",
          authorId: authorOneId,
          coAuthorIds: [authorOneId]
        }
      );
      expect(restrictPostCreate.statusCode).toBe(201);
      expect(restrictPostCreate.body.ok).toBe(true);
      expect([
        restrictPostCreate.body.item.authorIdTitle,
        restrictPostCreate.body.item.authorTitle
      ]).toContain("alice-handle");
      const coAuthorTitles =
        restrictPostCreate.body.item.coAuthorIdsTitles ??
        restrictPostCreate.body.item.coAuthorTitles ??
        [];
      expect(coAuthorTitles).toContain("alice-handle");

      const restrictDelete = await injectJson(
        ephemeral,
        "DELETE",
        `/api/reference/collections/authors/items/${authorOneId}`
      );
      expect(restrictDelete.statusCode).toBe(409);
      expect(restrictDelete.body.ok).toBe(false);
      expect(restrictDelete.body.error.code).toBe("REFERENCE_DELETE_RESTRICTED");
      expect(restrictDelete.body.error.actions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "navigate",
            route: expect.objectContaining({
              moduleId: "wpmt-delete-policy",
              state: expect.objectContaining({
                collectionId: "posts",
                authorId: authorOneId
              })
            })
          })
        ])
      );
      expect(restrictDelete.body.error.impact).toEqual(
        expect.objectContaining({
          referenceCount: 1,
          dependencies: expect.arrayContaining([
            expect.objectContaining({
              referencingCollectionId: "posts",
              fieldId: "authorId",
              policy: "restrict",
              referenceCount: 1
            })
          ])
        })
      );

      const authorTwoCreate = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/collections/authors/items",
        {
          name: "Bob",
          handle: "bob-handle"
        }
      );
      expect(authorTwoCreate.statusCode).toBe(201);
      const authorTwoId = authorTwoCreate.body.item.id;

      const nullifyPostCreate = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/collections/posts/items",
        {
          title: "Nullify Post",
          authorId: null,
          coAuthorIds: [authorTwoId]
        }
      );
      expect(nullifyPostCreate.statusCode).toBe(201);
      const nullifyPostId = nullifyPostCreate.body.item.id;

      const nullifyDelete = await injectJson(
        ephemeral,
        "DELETE",
        `/api/reference/collections/authors/items/${authorTwoId}`
      );
      expect(nullifyDelete.statusCode).toBe(200);
      expect(nullifyDelete.body.ok).toBe(true);
      expect(nullifyDelete.body.cleanup).toEqual(
        expect.objectContaining({
          policy: "nullify",
          referenceCount: 1,
          collections: expect.arrayContaining(["posts"])
        })
      );

      const nullifiedPost = await injectJson(
        ephemeral,
        "GET",
        `/api/reference/collections/posts/items/${nullifyPostId}`
      );
      expect(nullifiedPost.statusCode).toBe(200);
      expect(nullifiedPost.body.ok).toBe(true);
      expect(nullifiedPost.body.item.coAuthorIds).toEqual([]);
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });
}



registerReferenceSliceSuiteWithServer(registerReferenceSliceCollectionsReferenceDeletePolicySuite);
