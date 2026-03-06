import { registerReferenceSliceSuiteWithServer } from './helpers/reference-slice-suite-host.js';
import { expect, test } from "vitest";
import { spec } from "pactum";
import { buildReferenceModuleLifecyclePath } from "./helpers/reference-slice-runtime-test-helpers.js";

function registerReferenceSliceCollectionsCoreBaselineWorkspaceSuite() {
  test("GET /api/reference/collections and schema expose collection/type baseline", async () => {
    const collectionsResponse = await spec()
      .get("/api/reference/collections")
      .expectStatus(200);

    expect(collectionsResponse.body.ok).toBe(true);
    expect(Array.isArray(collectionsResponse.body.items)).toBe(true);
    expect(collectionsResponse.body.items).toContainEqual(
      expect.objectContaining({
        id: "records",
        label: expect.any(String),
        entitySingular: "record",
        primaryField: "title"
      })
    );
    expect(collectionsResponse.body.items).toContainEqual(
      expect.objectContaining({
        id: "notes",
        label: expect.any(String),
        entitySingular: "note",
        primaryField: "title"
      })
    );

    const schemaResponse = await spec()
      .get("/api/reference/collections/records/schema")
      .expectStatus(200);

    expect(schemaResponse.body.ok).toBe(true);
    expect(schemaResponse.body.collection).toEqual(
      expect.objectContaining({
        id: "records",
        entitySingular: "record",
        fields: expect.arrayContaining([
          expect.objectContaining({ id: "title", required: true }),
          expect.objectContaining({
            id: "noteIds",
            type: "reference-multi",
            collectionId: "notes"
          }),
          expect.objectContaining({ id: "slug", type: "computed" })
        ])
      })
    );

    const notesSchemaResponse = await spec()
      .get("/api/reference/collections/notes/schema")
      .expectStatus(200);

    expect(notesSchemaResponse.body.ok).toBe(true);
    expect(notesSchemaResponse.body.collection).toEqual(
      expect.objectContaining({
        id: "notes",
        entitySingular: "note",
        fields: expect.arrayContaining([
          expect.objectContaining({ id: "category", type: "enum" }),
          expect.objectContaining({ id: "labels", type: "enum-multi" }),
          expect.objectContaining({ id: "pinned", type: "boolean" }),
          expect.objectContaining({ id: "dueDate", type: "date" }),
          expect.objectContaining({ id: "recordId", type: "reference", collectionId: "records" })
        ])
      })
    );
  });

  test("GET /api/reference/collections/:collectionId/workspace returns consolidated schema, rows, and reference options", async () => {
    const workspaceResponse = await spec()
      .get("/api/reference/collections/records/workspace?search=launch&status=draft")
      .expectStatus(200);

    expect(workspaceResponse.body.ok).toBe(true);
    expect(workspaceResponse.body.collection).toEqual(
      expect.objectContaining({
        id: "records",
        fields: expect.arrayContaining([
          expect.objectContaining({
            id: "noteIds",
            type: "reference-multi",
            collectionId: "notes"
          })
        ])
      })
    );
    expect(Array.isArray(workspaceResponse.body.items)).toBe(true);
    expect(workspaceResponse.body.items.map((item) => item.id)).toContain("rec-001");
    expect(workspaceResponse.body.meta).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        offset: 0,
        limit: 25
      })
    );
    expect(workspaceResponse.body.filters).toEqual(
      expect.objectContaining({
        search: "launch",
        status: "draft"
      })
    );
    expect(workspaceResponse.body.referenceOptions).toEqual(
      expect.objectContaining({
        notes: expect.objectContaining({
          errorMessage: null,
          items: expect.arrayContaining([
            expect.objectContaining({
              id: "note-001",
              title: expect.any(String)
            })
          ])
        })
      })
    );

    const missingWorkspace = await spec()
      .get("/api/reference/collections/not-real/workspace")
      .expectStatus(404);
    expect(missingWorkspace.body.error.code).toBe("COLLECTION_NOT_FOUND");
  });

  test("collection availability follows module lifecycle state for module-contributed CRUD paths", async () => {
    await spec()
      .post(buildReferenceModuleLifecyclePath("records", "disable"))
      .expectStatus(200);

    try {
      const collectionsAfterDisable = await spec()
        .get("/api/reference/collections")
        .expectStatus(200);
      const collectionIds = collectionsAfterDisable.body.items.map((item) => item.id);
      expect(collectionIds).not.toContain("records");
      expect(collectionIds).not.toContain("notes");

      const runtimeAfterDisable = await spec()
        .get("/api/reference/modules/runtime")
        .expectStatus(200);
      expect(runtimeAfterDisable.body.runtime.activeCollectionIds).not.toContain("records");
      expect(runtimeAfterDisable.body.runtime.activeCollectionIds).not.toContain("notes");

      const schemaBlocked = await spec()
        .get("/api/reference/collections/records/schema")
        .expectStatus(404);
      expect(schemaBlocked.body.error.code).toBe("COLLECTION_NOT_FOUND");

      const listBlocked = await spec()
        .get("/api/reference/collections/records/items")
        .expectStatus(404);
      expect(listBlocked.body.error.code).toBe("COLLECTION_NOT_FOUND");

      const readBlocked = await spec()
        .get("/api/reference/collections/records/items/rec-001")
        .expectStatus(404);
      expect(readBlocked.body.error.code).toBe("COLLECTION_NOT_FOUND");

      const createBlocked = await spec()
        .post("/api/reference/collections/records/items")
        .withJson({
          title: "Blocked create",
          status: "draft",
          score: 10
        })
        .expectStatus(404);
      expect(createBlocked.body.error.code).toBe("COLLECTION_NOT_FOUND");

      const updateBlocked = await spec()
        .put("/api/reference/collections/records/items/rec-001")
        .withJson({
          title: "Blocked update"
        })
        .expectStatus(404);
      expect(updateBlocked.body.error.code).toBe("COLLECTION_NOT_FOUND");

      const deleteBlocked = await spec()
        .delete("/api/reference/collections/records/items/rec-001")
        .expectStatus(404);
      expect(deleteBlocked.body.error.code).toBe("COLLECTION_NOT_FOUND");
    } finally {
      await spec()
        .post(buildReferenceModuleLifecyclePath("records", "enable"))
        .expectStatus(200);
    }

    const collectionsAfterEnable = await spec()
      .get("/api/reference/collections")
      .expectStatus(200);
    const collectionIdsAfterEnable = collectionsAfterEnable.body.items.map((item) => item.id);
    expect(collectionIdsAfterEnable).toContain("records");
    expect(collectionIdsAfterEnable).toContain("notes");
  });

  test("collection CRUD dispatch returns deterministic COLLECTION_NOT_FOUND for unsupported collection ids", async () => {
    const listResponse = await spec()
      .get("/api/reference/collections/not-real/items")
      .expectStatus(404);
    expect(listResponse.body.error.code).toBe("COLLECTION_NOT_FOUND");

    const readResponse = await spec()
      .get("/api/reference/collections/not-real/items/item-001")
      .expectStatus(404);
    expect(readResponse.body.error.code).toBe("COLLECTION_NOT_FOUND");

    const createResponse = await spec()
      .post("/api/reference/collections/not-real/items")
      .withJson({
        title: "Ignored payload"
      })
      .expectStatus(404);
    expect(createResponse.body.error.code).toBe("COLLECTION_NOT_FOUND");

    const updateResponse = await spec()
      .put("/api/reference/collections/not-real/items/item-001")
      .withJson({
        title: "Ignored update"
      })
      .expectStatus(404);
    expect(updateResponse.body.error.code).toBe("COLLECTION_NOT_FOUND");

    const deleteResponse = await spec()
      .delete("/api/reference/collections/not-real/items/item-001")
      .expectStatus(404);
    expect(deleteResponse.body.error.code).toBe("COLLECTION_NOT_FOUND");
  });

}

export { registerReferenceSliceCollectionsCoreBaselineWorkspaceSuite };

registerReferenceSliceSuiteWithServer(registerReferenceSliceCollectionsCoreBaselineWorkspaceSuite);
