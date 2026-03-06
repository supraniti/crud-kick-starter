import { registerReferenceSliceSuiteWithServer } from './helpers/reference-slice-suite-host.js';
import { expect, test } from "vitest";
import { spec } from "pactum";

function registerReferenceSliceCollectionsCoreCrudFlowsSuite() {
  test("records collection CRUD flow returns deterministic validation and mutation contracts", async () => {
    const invalidCreate = await spec()
      .post("/api/reference/collections/records/items")
      .withJson({
        title: "",
        status: "draft",
        score: 55
      })
      .expectStatus(400);
    expect(invalidCreate.body.ok).toBe(false);
    expect(invalidCreate.body.error.code).toBe("RECORD_TITLE_REQUIRED");

    const invalidFeatured = await spec()
      .post("/api/reference/collections/records/items")
      .withJson({
        title: "Bad Featured",
        status: "draft",
        score: 50,
        featured: "yes"
      })
      .expectStatus(400);
    expect(invalidFeatured.body.error.code).toBe("RECORD_FEATURED_INVALID");

    const invalidPublishedWithoutDate = await spec()
      .post("/api/reference/collections/records/items")
      .withJson({
        title: "Published Without Date",
        status: "published",
        score: 90,
        featured: true,
        publishedOn: null
      })
      .expectStatus(400);
    expect(invalidPublishedWithoutDate.body.error.code).toBe(
      "RECORD_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const invalidNoteIds = await spec()
      .post("/api/reference/collections/records/items")
      .withJson({
        title: "Invalid Notes Shape",
        status: "draft",
        score: 60,
        featured: false,
        noteIds: "note-001"
      })
      .expectStatus(400);
    expect(invalidNoteIds.body.error.code).toBe("RECORD_NOTE_IDS_INVALID");

    const invalidNoteReference = await spec()
      .post("/api/reference/collections/records/items")
      .withJson({
        title: "Missing Note Ref",
        status: "draft",
        score: 60,
        featured: false,
        noteIds: ["note-999"]
      })
      .expectStatus(400);
    expect(invalidNoteReference.body.error.code).toBe("RECORD_NOTE_ID_NOT_FOUND");

    const unknownFieldCreate = await spec()
      .post("/api/reference/collections/records/items")
      .withJson({
        title: "Unknown Field Record",
        status: "draft",
        score: 60,
        featured: false,
        extraField: "nope"
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("RECORD_FIELD_UNKNOWN");

    const createResponse = await spec()
      .post("/api/reference/collections/records/items")
      .withJson({
        title: "M7 Baseline Item",
        status: "draft",
        score: 91,
        featured: true,
        publishedOn: "2026-02-11",
        noteIds: ["note-001"]
      })
      .expectStatus(201);

    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: "M7 Baseline Item",
        status: "draft",
        score: 91,
        featured: true,
        publishedOn: "2026-02-11",
        noteIds: ["note-001"],
        noteTitles: ["Ops Followup"],
        slug: "m7-baseline-item"
      })
    );

    const createdId = createResponse.body.item.id;

    const listResponse = await spec()
      .get("/api/reference/collections/records/items?search=baseline")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.items.map((item) => item.id)).toContain(createdId);
    expect(listResponse.body.meta.total).toBeGreaterThan(0);

    const filteredByNote = await spec()
      .get("/api/reference/collections/records/items?noteId=note-001")
      .expectStatus(200);
    expect(filteredByNote.body.ok).toBe(true);
    expect(filteredByNote.body.items.map((item) => item.id)).toContain(createdId);
    expect(filteredByNote.body.filters.noteId).toBe("note-001");

    const filteredByNoteKebab = await spec()
      .get("/api/reference/collections/records/items?note-id=note-001")
      .expectStatus(200);
    expect(filteredByNoteKebab.body.ok).toBe(true);
    expect(filteredByNoteKebab.body.items.map((item) => item.id)).toContain(createdId);
    expect(filteredByNoteKebab.body.filters.noteId).toBe("note-001");

    const filteredByNotePlural = await spec()
      .get("/api/reference/collections/records/items?noteIds=note-001")
      .expectStatus(200);
    expect(filteredByNotePlural.body.ok).toBe(true);
    expect(filteredByNotePlural.body.items.map((item) => item.id)).toContain(createdId);
    expect(filteredByNotePlural.body.filters.noteId).toBe("note-001");

    const invalidUpdate = await spec()
      .put(`/api/reference/collections/records/items/${createdId}`)
      .withJson({
        status: "bad-status"
      })
      .expectStatus(400);
    expect(invalidUpdate.body.error.code).toBe("RECORD_STATUS_INVALID");

    const invalidNoteIdsUpdate = await spec()
      .put(`/api/reference/collections/records/items/${createdId}`)
      .withJson({
        noteIds: "note-001"
      })
      .expectStatus(400);
    expect(invalidNoteIdsUpdate.body.error.code).toBe("RECORD_NOTE_IDS_INVALID");

    const invalidNoteReferenceUpdate = await spec()
      .put(`/api/reference/collections/records/items/${createdId}`)
      .withJson({
        noteIds: ["note-999"]
      })
      .expectStatus(400);
    expect(invalidNoteReferenceUpdate.body.error.code).toBe("RECORD_NOTE_ID_NOT_FOUND");

    const invalidDateUpdate = await spec()
      .put(`/api/reference/collections/records/items/${createdId}`)
      .withJson({
        publishedOn: "2026-02-30"
      })
      .expectStatus(400);
    expect(invalidDateUpdate.body.error.code).toBe("RECORD_PUBLISHED_ON_INVALID");

    const unknownFieldUpdate = await spec()
      .put(`/api/reference/collections/records/items/${createdId}`)
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("RECORD_FIELD_UNKNOWN");

    const updateResponse = await spec()
      .put(`/api/reference/collections/records/items/${createdId}`)
      .withJson({
        title: "M7 Baseline Item Updated",
        status: "review",
        score: 88,
        featured: false,
        publishedOn: null,
        noteIds: ["note-002"]
      })
      .expectStatus(200);

    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item).toEqual(
      expect.objectContaining({
        id: createdId,
        title: "M7 Baseline Item Updated",
        status: "review",
        score: 88,
        featured: false,
        publishedOn: null,
        noteIds: ["note-002"],
        noteTitles: ["Frontend Polish"],
        slug: "m7-baseline-item-updated"
      })
    );

    const invalidPublishedStatusUpdate = await spec()
      .put(`/api/reference/collections/records/items/${createdId}`)
      .withJson({
        status: "published"
      })
      .expectStatus(400);
    expect(invalidPublishedStatusUpdate.body.error.code).toBe(
      "RECORD_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const readResponse = await spec()
      .get(`/api/reference/collections/records/items/${createdId}`)
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.item.id).toBe(createdId);
    expect(readResponse.body.item.noteIds).toEqual(["note-002"]);
    expect(readResponse.body.item.noteTitles).toEqual(["Frontend Polish"]);

    const deleteResponse = await spec()
      .delete(`/api/reference/collections/records/items/${createdId}`)
      .expectStatus(200);
    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.id).toBe(createdId);

    const missingRead = await spec()
      .get(`/api/reference/collections/records/items/${createdId}`)
      .expectStatus(404);
    expect(missingRead.body.error.code).toBe("ITEM_NOT_FOUND");
  });

  test("notes collection CRUD flow returns deterministic validation and mutation contracts", async () => {
    const invalidCreate = await spec()
      .post("/api/reference/collections/notes/items")
      .withJson({
        title: "",
        category: "general",
        priority: 2
      })
      .expectStatus(400);
    expect(invalidCreate.body.ok).toBe(false);
    expect(invalidCreate.body.error.code).toBe("NOTE_TITLE_REQUIRED");

    const invalidPinned = await spec()
      .post("/api/reference/collections/notes/items")
      .withJson({
        title: "Bad Note",
        category: "general",
        priority: 2,
        pinned: "true"
      })
      .expectStatus(400);
    expect(invalidPinned.body.error.code).toBe("NOTE_PINNED_INVALID");

    const invalidReference = await spec()
      .post("/api/reference/collections/notes/items")
      .withJson({
        title: "Bad Ref",
        category: "general",
        priority: 2,
        recordId: "rec-999"
      })
      .expectStatus(400);
    expect(invalidReference.body.error.code).toBe("NOTE_RECORD_NOT_FOUND");

    const invalidLabels = await spec()
      .post("/api/reference/collections/notes/items")
      .withJson({
        title: "Bad Labels",
        category: "general",
        priority: 2,
        labels: "ops"
      })
      .expectStatus(400);
    expect(invalidLabels.body.error.code).toBe("NOTE_LABELS_INVALID");

    const invalidLabelValue = await spec()
      .post("/api/reference/collections/notes/items")
      .withJson({
        title: "Bad Label Value",
        category: "general",
        priority: 2,
        labels: ["ops", "invalid"]
      })
      .expectStatus(400);
    expect(invalidLabelValue.body.error.code).toBe("NOTE_LABEL_INVALID");

    const unknownFieldCreate = await spec()
      .post("/api/reference/collections/notes/items")
      .withJson({
        title: "Unknown Note Field",
        category: "general",
        priority: 2,
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("NOTE_FIELD_UNKNOWN");

    const invalidReleaseWithoutDueDate = await spec()
      .post("/api/reference/collections/notes/items")
      .withJson({
        title: "Release Note Missing Due",
        category: "ops",
        labels: ["release"],
        priority: 4,
        pinned: false,
        dueDate: null
      })
      .expectStatus(400);
    expect(invalidReleaseWithoutDueDate.body.error.code).toBe(
      "NOTE_DUE_DATE_REQUIRED_FOR_RELEASE"
    );

    const createResponse = await spec()
      .post("/api/reference/collections/notes/items")
      .withJson({
        title: "M8 Ops Note",
        category: "ops",
        labels: ["ops", "release"],
        priority: 4,
        pinned: true,
        dueDate: "2026-02-20",
        recordId: "rec-001"
      })
      .expectStatus(201);

    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: "M8 Ops Note",
        category: "ops",
        labels: ["ops", "release"],
        priority: 4,
        pinned: true,
        dueDate: "2026-02-20",
        recordId: "rec-001",
        recordTitle: expect.any(String),
        recordIdTitle: expect.any(String),
        slug: "m8-ops-note"
      })
    );

    const createdId = createResponse.body.item.id;

    const listResponse = await spec()
      .get("/api/reference/collections/notes/items?category=ops&labels=ops,release&recordId=rec-001&search=m8")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.items.map((item) => item.id)).toContain(createdId);
    expect(listResponse.body.filters).toEqual(
      expect.objectContaining({
        category: "ops",
        labels: ["ops", "release"],
        recordId: "rec-001",
        search: "m8"
      })
    );

    const listResponseKebabReference = await spec()
      .get("/api/reference/collections/notes/items?category=ops&labels=ops,release&record-id=rec-001&search=m8")
      .expectStatus(200);
    expect(listResponseKebabReference.body.ok).toBe(true);
    expect(listResponseKebabReference.body.items.map((item) => item.id)).toContain(createdId);
    expect(listResponseKebabReference.body.filters.recordId).toBe("rec-001");

    const invalidUpdate = await spec()
      .put(`/api/reference/collections/notes/items/${createdId}`)
      .withJson({
        priority: 11
      })
      .expectStatus(400);
    expect(invalidUpdate.body.error.code).toBe("NOTE_PRIORITY_INVALID");

    const invalidReleaseDueDateUpdate = await spec()
      .put(`/api/reference/collections/notes/items/${createdId}`)
      .withJson({
        dueDate: null,
        labels: ["release", "ops"]
      })
      .expectStatus(400);
    expect(invalidReleaseDueDateUpdate.body.error.code).toBe(
      "NOTE_DUE_DATE_REQUIRED_FOR_RELEASE"
    );

    const unknownFieldUpdate = await spec()
      .put(`/api/reference/collections/notes/items/${createdId}`)
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("NOTE_FIELD_UNKNOWN");

    const updateResponse = await spec()
      .put(`/api/reference/collections/notes/items/${createdId}`)
      .withJson({
        title: "M8 Ops Note Updated",
        category: "tech",
        labels: ["ui"],
        priority: 3,
        pinned: false,
        dueDate: null,
        recordId: "rec-002"
      })
      .expectStatus(200);

    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item).toEqual(
      expect.objectContaining({
        id: createdId,
        title: "M8 Ops Note Updated",
        category: "tech",
        labels: ["ui"],
        priority: 3,
        pinned: false,
        dueDate: null,
        recordId: "rec-002",
        recordTitle: expect.any(String),
        recordIdTitle: expect.any(String),
        slug: "m8-ops-note-updated"
      })
    );

    const readResponse = await spec()
      .get(`/api/reference/collections/notes/items/${createdId}`)
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.item.id).toBe(createdId);

    const deleteResponse = await spec()
      .delete(`/api/reference/collections/notes/items/${createdId}`)
      .expectStatus(200);
    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.id).toBe(createdId);

    const missingRead = await spec()
      .get(`/api/reference/collections/notes/items/${createdId}`)
      .expectStatus(404);
    expect(missingRead.body.error.code).toBe("ITEM_NOT_FOUND");
  });
}

export { registerReferenceSliceCollectionsCoreCrudFlowsSuite };

registerReferenceSliceSuiteWithServer(registerReferenceSliceCollectionsCoreCrudFlowsSuite);
