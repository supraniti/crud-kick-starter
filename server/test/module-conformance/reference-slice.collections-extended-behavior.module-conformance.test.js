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

export function registerReferenceSliceCollectionsExtendedBehaviorSuite() {
  test("editors collection CRUD flow returns deterministic validation and mutation contracts", async () => {
    const invalidCreate = await spec()
      .post("/api/reference/collections/editors/items")
      .withJson({
        title: "",
        status: "draft",
        category: "news"
      })
      .expectStatus(400);
    expect(invalidCreate.body.ok).toBe(false);
    expect(invalidCreate.body.error.code).toBe("EDITOR_TITLE_REQUIRED");

    const unknownFieldCreate = await spec()
      .post("/api/reference/collections/editors/items")
      .withJson({
        title: "Unknown field editor",
        status: "draft",
        category: "news",
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("EDITOR_FIELD_UNKNOWN");

    const invalidReference = await spec()
      .post("/api/reference/collections/editors/items")
      .withJson({
        title: "Invalid reference editor",
        status: "draft",
        category: "news",
        recordId: "rec-999"
      })
      .expectStatus(400);
    expect(invalidReference.body.error.code).toBe("EDITOR_RECORD_NOT_FOUND");

    const mentorAuthorOne = await spec()
      .post("/api/reference/collections/authors/items")
      .withJson({
        title: "Editor Mentor One",
        status: "review",
        category: "guide",
        labels: ["featured"],
        publishedOn: null,
        recordId: "rec-001"
      })
      .expectStatus(201);
    const mentorAuthorOneId = mentorAuthorOne.body.item.id;

    const mentorAuthorTwo = await spec()
      .post("/api/reference/collections/authors/items")
      .withJson({
        title: "Editor Mentor Two",
        status: "review",
        category: "guide",
        labels: ["engineering"],
        publishedOn: null,
        recordId: "rec-002"
      })
      .expectStatus(201);
    const mentorAuthorTwoId = mentorAuthorTwo.body.item.id;

    const invalidMentorReference = await spec()
      .post("/api/reference/collections/editors/items")
      .withJson({
        title: "Invalid mentor reference editor",
        status: "draft",
        category: "news",
        recordId: "rec-001",
        mentorId: "aut-999"
      })
      .expectStatus(400);
    expect(invalidMentorReference.body.error.code).toBe("EDITOR_MENTOR_ID_NOT_FOUND");

    const invalidNumberCreate = await spec()
      .post("/api/reference/collections/editors/items")
      .withJson({
        title: "Invalid score editor",
        status: "draft",
        category: "news",
        editorialScore: "high"
      })
      .expectStatus(400);
    expect(invalidNumberCreate.body.error.code).toBe("EDITOR_EDITORIAL_SCORE_INVALID");

    const invalidBooleanCreate = await spec()
      .post("/api/reference/collections/editors/items")
      .withJson({
        title: "Invalid verified editor",
        status: "draft",
        category: "news",
        verified: "yes"
      })
      .expectStatus(400);
    expect(invalidBooleanCreate.body.error.code).toBe("EDITOR_VERIFIED_INVALID");

    const invalidPublishedCreate = await spec()
      .post("/api/reference/collections/editors/items")
      .withJson({
        title: "Published without date",
        status: "published",
        category: "news",
        labels: ["featured"]
      })
      .expectStatus(400);
    expect(invalidPublishedCreate.body.error.code).toBe(
      "EDITOR_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const createResponse = await spec()
      .post("/api/reference/collections/editors/items")
      .withJson({
        title: "M30 Editors Proof",
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        bio: "Lead standards editor",
        mentorId: mentorAuthorTwoId,
        focusAreas: ["standards", "style"],
        editorialScore: "92.5",
        verified: "true"
      })
      .expectStatus(201);
    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: "M30 Editors Proof",
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        recordTitle: expect.any(String),
        bio: "Lead standards editor",
        mentorId: mentorAuthorTwoId,
        mentorTitle: expect.any(String),
        mentorIdTitle: expect.any(String),
        focusAreas: ["standards", "style"],
        editorialScore: 92.5,
        verified: true,
        bioSlug: "lead-standards-editor",
        bioCode: "LEAD STANDARDS EDITOR",
        slug: "m30-editors-proof"
      })
    );

    const createdId = createResponse.body.item.id;

    const listResponse = await spec()
      .get(
        `/api/reference/collections/editors/items?status=review&category=guide&labels=featured,engineering&recordId=rec-001&mentorId=${mentorAuthorTwoId}&focusAreas=standards,style&editorialScore=92.5&verified=true&search=m30`
      )
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.items.map((item) => item.id)).toContain(createdId);
    expect(listResponse.body.filters).toEqual(
      expect.objectContaining({
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        recordId: "rec-001",
        mentorId: mentorAuthorTwoId,
        focusAreas: ["standards", "style"],
        editorialScore: 92.5,
        verified: true,
        search: "m30"
      })
    );

    const unknownFieldUpdate = await spec()
      .put(`/api/reference/collections/editors/items/${createdId}`)
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("EDITOR_FIELD_UNKNOWN");

    const invalidPublishedUpdate = await spec()
      .put(`/api/reference/collections/editors/items/${createdId}`)
      .withJson({
        status: "published",
        publishedOn: null
      })
      .expectStatus(400);
    expect(invalidPublishedUpdate.body.error.code).toBe(
      "EDITOR_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const updateResponse = await spec()
      .put(`/api/reference/collections/editors/items/${createdId}`)
      .withJson({
        title: "M30 Editors Proof Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        bio: "Lead standards editor updated",
        mentorId: mentorAuthorOneId,
        focusAreas: ["newsroom"],
        editorialScore: 88,
        verified: false
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item).toEqual(
      expect.objectContaining({
        id: createdId,
        title: "M30 Editors Proof Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        recordTitle: expect.any(String),
        bio: "Lead standards editor updated",
        mentorId: mentorAuthorOneId,
        mentorTitle: expect.any(String),
        mentorIdTitle: expect.any(String),
        focusAreas: ["newsroom"],
        editorialScore: 88,
        verified: false,
        bioSlug: "lead-standards-editor-updated",
        bioCode: "LEAD STANDARDS EDITOR UPDATED",
        slug: "m30-editors-proof-updated"
      })
    );

    const readResponse = await spec()
      .get(`/api/reference/collections/editors/items/${createdId}`)
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.item.id).toBe(createdId);

    const deleteResponse = await spec()
      .delete(`/api/reference/collections/editors/items/${createdId}`)
      .expectStatus(200);
    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.id).toBe(createdId);

    const missingRead = await spec()
      .get(`/api/reference/collections/editors/items/${createdId}`)
      .expectStatus(404);
    expect(missingRead.body.error.code).toBe("ITEM_NOT_FOUND");
  });

  test("reviews collection behavior descriptors allow published-null and duplicate titles deterministically", async () => {
    const unknownFieldCreate = await spec()
      .post("/api/reference/collections/reviews/items")
      .withJson({
        title: "Unknown field review",
        status: "draft",
        category: "news",
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("REVIEW_FIELD_UNKNOWN");

    const firstCreate = await spec()
      .post("/api/reference/collections/reviews/items")
      .withJson({
        title: "M43 Reviews Behavior Proof",
        status: "published",
        category: "news",
        labels: ["featured"],
        publishedOn: null
      })
      .expectStatus(201);
    expect(firstCreate.body.ok).toBe(true);
    expect(firstCreate.body.item).toEqual(
      expect.objectContaining({
        title: "M43 Reviews Behavior Proof",
        status: "published",
        category: "news",
        labels: ["featured"],
        publishedOn: null,
        slug: "m43-reviews-behavior-proof"
      })
    );
    const firstId = firstCreate.body.item.id;

    const secondCreate = await spec()
      .post("/api/reference/collections/reviews/items")
      .withJson({
        title: "M43 Reviews Behavior Proof",
        status: "published",
        category: "ops",
        labels: [],
        publishedOn: null
      })
      .expectStatus(201);
    expect(secondCreate.body.ok).toBe(true);
    expect(secondCreate.body.item.id).not.toBe(firstId);
    const secondId = secondCreate.body.item.id;

    const updateFirst = await spec()
      .put(`/api/reference/collections/reviews/items/${firstId}`)
      .withJson({
        status: "published",
        category: "ops",
        publishedOn: null
      })
      .expectStatus(200);
    expect(updateFirst.body.ok).toBe(true);
    expect(updateFirst.body.item.publishedOn).toBe(null);

    const listResponse = await spec()
      .get("/api/reference/collections/reviews/items?status=published&category=ops&search=m43")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.meta.total).toBe(2);
    expect(listResponse.body.items.map((item) => item.id)).toEqual(
      expect.arrayContaining([firstId, secondId])
    );

    await spec()
      .delete(`/api/reference/collections/reviews/items/${firstId}`)
      .expectStatus(200);
    await spec()
      .delete(`/api/reference/collections/reviews/items/${secondId}`)
      .expectStatus(200);

    const missingRead = await spec()
      .get(`/api/reference/collections/reviews/items/${firstId}`)
      .expectStatus(404);
    expect(missingRead.body.error.code).toBe("ITEM_NOT_FOUND");
  });

}


registerReferenceSliceSuiteWithServer(registerReferenceSliceCollectionsExtendedBehaviorSuite);

