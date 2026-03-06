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

export function registerReferenceSliceCollectionsExtendedCrudSuite() {
  test("articles collection CRUD flow returns deterministic validation and mutation contracts", async () => {
    const invalidCreate = await spec()
      .post("/api/reference/collections/articles/items")
      .withJson({
        title: "",
        status: "draft",
        category: "news"
      })
      .expectStatus(400);
    expect(invalidCreate.body.ok).toBe(false);
    expect(invalidCreate.body.error.code).toBe("ARTICLE_TITLE_REQUIRED");

    const unknownFieldCreate = await spec()
      .post("/api/reference/collections/articles/items")
      .withJson({
        title: "Unknown field article",
        status: "draft",
        category: "news",
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("ARTICLE_FIELD_UNKNOWN");

    const invalidReference = await spec()
      .post("/api/reference/collections/articles/items")
      .withJson({
        title: "Invalid reference article",
        status: "draft",
        category: "news",
        recordId: "rec-999"
      })
      .expectStatus(400);
    expect(invalidReference.body.error.code).toBe("ARTICLE_RECORD_NOT_FOUND");

    const invalidPublishedCreate = await spec()
      .post("/api/reference/collections/articles/items")
      .withJson({
        title: "Published without date",
        status: "published",
        category: "news",
        labels: ["featured"]
      })
      .expectStatus(400);
    expect(invalidPublishedCreate.body.error.code).toBe(
      "ARTICLE_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const createResponse = await spec()
      .post("/api/reference/collections/articles/items")
      .withJson({
        title: "M26 Articles Proof",
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001"
      })
      .expectStatus(201);
    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: "M26 Articles Proof",
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        recordTitle: expect.any(String),
        slug: "m26-articles-proof"
      })
    );

    const createdId = createResponse.body.item.id;

    const listResponse = await spec()
      .get(
        "/api/reference/collections/articles/items?status=review&category=guide&labels=featured,engineering&recordId=rec-001&search=m26"
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
        search: "m26"
      })
    );

    const unknownFieldUpdate = await spec()
      .put(`/api/reference/collections/articles/items/${createdId}`)
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("ARTICLE_FIELD_UNKNOWN");

    const invalidPublishedUpdate = await spec()
      .put(`/api/reference/collections/articles/items/${createdId}`)
      .withJson({
        status: "published",
        publishedOn: null
      })
      .expectStatus(400);
    expect(invalidPublishedUpdate.body.error.code).toBe(
      "ARTICLE_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const updateResponse = await spec()
      .put(`/api/reference/collections/articles/items/${createdId}`)
      .withJson({
        title: "M26 Articles Proof Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item).toEqual(
      expect.objectContaining({
        id: createdId,
        title: "M26 Articles Proof Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        recordTitle: expect.any(String),
        slug: "m26-articles-proof-updated"
      })
    );

    const readResponse = await spec()
      .get(`/api/reference/collections/articles/items/${createdId}`)
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.item.id).toBe(createdId);

    const deleteResponse = await spec()
      .delete(`/api/reference/collections/articles/items/${createdId}`)
      .expectStatus(200);
    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.id).toBe(createdId);

    const missingRead = await spec()
      .get(`/api/reference/collections/articles/items/${createdId}`)
      .expectStatus(404);
    expect(missingRead.body.error.code).toBe("ITEM_NOT_FOUND");
  });

  test("authors collection CRUD flow returns deterministic validation and mutation contracts", async () => {
    const invalidCreate = await spec()
      .post("/api/reference/collections/authors/items")
      .withJson({
        title: "",
        status: "draft",
        category: "news"
      })
      .expectStatus(400);
    expect(invalidCreate.body.ok).toBe(false);
    expect(invalidCreate.body.error.code).toBe("AUTHOR_TITLE_REQUIRED");

    const unknownFieldCreate = await spec()
      .post("/api/reference/collections/authors/items")
      .withJson({
        title: "Unknown field author",
        status: "draft",
        category: "news",
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("AUTHOR_FIELD_UNKNOWN");

    const invalidReference = await spec()
      .post("/api/reference/collections/authors/items")
      .withJson({
        title: "Invalid reference author",
        status: "draft",
        category: "news",
        recordId: "rec-999"
      })
      .expectStatus(400);
    expect(invalidReference.body.error.code).toBe("AUTHOR_RECORD_NOT_FOUND");

    const invalidPublishedCreate = await spec()
      .post("/api/reference/collections/authors/items")
      .withJson({
        title: "Published without date",
        status: "published",
        category: "news",
        labels: ["featured"]
      })
      .expectStatus(400);
    expect(invalidPublishedCreate.body.error.code).toBe(
      "AUTHOR_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const createResponse = await spec()
      .post("/api/reference/collections/authors/items")
      .withJson({
        title: "M28 Authors Proof",
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001"
      })
      .expectStatus(201);
    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: "M28 Authors Proof",
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        recordTitle: expect.any(String),
        slug: "m28-authors-proof"
      })
    );

    const createdId = createResponse.body.item.id;

    const listResponse = await spec()
      .get(
        "/api/reference/collections/authors/items?status=review&category=guide&labels=featured,engineering&recordId=rec-001&search=m28"
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
        search: "m28"
      })
    );

    const unknownFieldUpdate = await spec()
      .put(`/api/reference/collections/authors/items/${createdId}`)
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("AUTHOR_FIELD_UNKNOWN");

    const invalidPublishedUpdate = await spec()
      .put(`/api/reference/collections/authors/items/${createdId}`)
      .withJson({
        status: "published",
        publishedOn: null
      })
      .expectStatus(400);
    expect(invalidPublishedUpdate.body.error.code).toBe(
      "AUTHOR_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const updateResponse = await spec()
      .put(`/api/reference/collections/authors/items/${createdId}`)
      .withJson({
        title: "M28 Authors Proof Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item).toEqual(
      expect.objectContaining({
        id: createdId,
        title: "M28 Authors Proof Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        recordTitle: expect.any(String),
        slug: "m28-authors-proof-updated"
      })
    );

    const readResponse = await spec()
      .get(`/api/reference/collections/authors/items/${createdId}`)
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.item.id).toBe(createdId);

    const deleteResponse = await spec()
      .delete(`/api/reference/collections/authors/items/${createdId}`)
      .expectStatus(200);
    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.id).toBe(createdId);

    const missingRead = await spec()
      .get(`/api/reference/collections/authors/items/${createdId}`)
      .expectStatus(404);
    expect(missingRead.body.error.code).toBe("ITEM_NOT_FOUND");
  });

  test("publishers collection CRUD flow returns deterministic validation and mutation contracts", async () => {
    const invalidCreate = await spec()
      .post("/api/reference/collections/publishers/items")
      .withJson({
        title: "",
        status: "draft",
        category: "news"
      })
      .expectStatus(400);
    expect(invalidCreate.body.ok).toBe(false);
    expect(invalidCreate.body.error.code).toBe("PUBLISHER_TITLE_REQUIRED");

    const unknownFieldCreate = await spec()
      .post("/api/reference/collections/publishers/items")
      .withJson({
        title: "Unknown field publisher",
        status: "draft",
        category: "news",
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("PUBLISHER_FIELD_UNKNOWN");

    const invalidReference = await spec()
      .post("/api/reference/collections/publishers/items")
      .withJson({
        title: "Invalid reference publisher",
        status: "draft",
        category: "news",
        recordId: "rec-999"
      })
      .expectStatus(400);
    expect(invalidReference.body.error.code).toBe("PUBLISHER_RECORD_NOT_FOUND");

    const aggregatedInvalidReferences = await spec()
      .post("/api/reference/collections/publishers/items")
      .withJson({
        title: "Invalid multi reference publisher",
        status: "draft",
        category: "news",
        recordId: "rec-999",
        partnerAuthorId: "aut-999"
      })
      .expectStatus(400);
    expect(aggregatedInvalidReferences.body.error.code).toBe("PUBLISHER_RECORD_NOT_FOUND");
    expect(aggregatedInvalidReferences.body.error.conflicts).toEqual([
      expect.objectContaining({
        order: 0,
        code: "PUBLISHER_RECORD_NOT_FOUND",
        fieldId: "recordId",
        fieldType: "reference",
        referenceCollectionId: "records",
        missingReferenceIds: ["rec-999"],
        missingCount: 1
      }),
      expect.objectContaining({
        order: 1,
        code: "PUBLISHER_PARTNER_AUTHOR_ID_NOT_FOUND",
        fieldId: "partnerAuthorId",
        fieldType: "reference",
        referenceCollectionId: "authors",
        missingReferenceIds: ["aut-999"],
        missingCount: 1
      })
    ]);

    const partnerAuthorOne = await spec()
      .post("/api/reference/collections/authors/items")
      .withJson({
        title: "Publisher Partner Author One",
        status: "review",
        category: "guide",
        labels: ["featured"],
        publishedOn: null,
        recordId: "rec-001"
      })
      .expectStatus(201);
    const partnerAuthorOneId = partnerAuthorOne.body.item.id;

    const partnerAuthorTwo = await spec()
      .post("/api/reference/collections/authors/items")
      .withJson({
        title: "Publisher Partner Author Two",
        status: "review",
        category: "guide",
        labels: ["engineering"],
        publishedOn: null,
        recordId: "rec-002"
      })
      .expectStatus(201);
    const partnerAuthorTwoId = partnerAuthorTwo.body.item.id;

    const invalidPartnerReference = await spec()
      .post("/api/reference/collections/publishers/items")
      .withJson({
        title: "Invalid partner reference publisher",
        status: "draft",
        category: "news",
        recordId: "rec-001",
        partnerAuthorId: "aut-999"
      })
      .expectStatus(400);
    expect(invalidPartnerReference.body.error.code).toBe("PUBLISHER_PARTNER_AUTHOR_ID_NOT_FOUND");

    const invalidNumberCreate = await spec()
      .post("/api/reference/collections/publishers/items")
      .withJson({
        title: "Invalid edition count publisher",
        status: "draft",
        category: "news",
        editionCount: "many"
      })
      .expectStatus(400);
    expect(invalidNumberCreate.body.error.code).toBe("PUBLISHER_EDITION_COUNT_INVALID");

    const invalidBooleanCreate = await spec()
      .post("/api/reference/collections/publishers/items")
      .withJson({
        title: "Invalid listed flag publisher",
        status: "draft",
        category: "news",
        publiclyListed: "yes"
      })
      .expectStatus(400);
    expect(invalidBooleanCreate.body.error.code).toBe("PUBLISHER_PUBLICLY_LISTED_INVALID");

    const invalidPublishedCreate = await spec()
      .post("/api/reference/collections/publishers/items")
      .withJson({
        title: "Published without date",
        status: "published",
        category: "news",
        labels: ["featured"]
      })
      .expectStatus(400);
    expect(invalidPublishedCreate.body.error.code).toBe(
      "PUBLISHER_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const createResponse = await spec()
      .post("/api/reference/collections/publishers/items")
      .withJson({
        title: "M29 Publishers Proof",
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        partnerAuthorId: partnerAuthorOneId,
        editionCount: 12,
        publiclyListed: true
      })
      .expectStatus(201);
    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        title: "M29 Publishers Proof",
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        recordTitle: expect.any(String),
        partnerAuthorId: partnerAuthorOneId,
        partnerAuthorTitle: expect.any(String),
        partnerAuthorIdTitle: expect.any(String),
        editionCount: 12,
        publiclyListed: true,
        imprintCode: "M29 PUBLISHERS PROOF",
        slug: "m29-publishers-proof"
      })
    );

    const createdId = createResponse.body.item.id;

    const listResponse = await spec()
      .get(
        `/api/reference/collections/publishers/items?status=review&category=guide&labels=featured,engineering&recordId=rec-001&partnerAuthorId=${partnerAuthorOneId}&editionCount=12&publiclyListed=true&search=m29`
      )
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.items.map((item) => item.id)).toContain(createdId);
    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdId,
          partnerAuthorId: partnerAuthorOneId,
          partnerAuthorTitle: expect.any(String),
          partnerAuthorIdTitle: expect.any(String),
          editionCount: 12,
          publiclyListed: true,
          imprintCode: "M29 PUBLISHERS PROOF"
        })
      ])
    );
    expect(listResponse.body.filters).toEqual(
      expect.objectContaining({
        status: "review",
        category: "guide",
        labels: ["featured", "engineering"],
        recordId: "rec-001",
        partnerAuthorId: partnerAuthorOneId,
        editionCount: 12,
        publiclyListed: true,
        search: "m29"
      })
    );

    const unknownFieldUpdate = await spec()
      .put(`/api/reference/collections/publishers/items/${createdId}`)
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("PUBLISHER_FIELD_UNKNOWN");

    const invalidPublishedUpdate = await spec()
      .put(`/api/reference/collections/publishers/items/${createdId}`)
      .withJson({
        status: "published",
        publishedOn: null
      })
      .expectStatus(400);
    expect(invalidPublishedUpdate.body.error.code).toBe(
      "PUBLISHER_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const updateResponse = await spec()
      .put(`/api/reference/collections/publishers/items/${createdId}`)
      .withJson({
        title: "M29 Publishers Proof Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        partnerAuthorId: partnerAuthorTwoId,
        editionCount: 44,
        publiclyListed: false
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item).toEqual(
      expect.objectContaining({
        id: createdId,
        title: "M29 Publishers Proof Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        recordTitle: expect.any(String),
        partnerAuthorId: partnerAuthorTwoId,
        partnerAuthorTitle: expect.any(String),
        partnerAuthorIdTitle: expect.any(String),
        editionCount: 44,
        publiclyListed: false,
        imprintCode: "M29 PUBLISHERS PROOF UPDATED",
        slug: "m29-publishers-proof-updated"
      })
    );

    const readResponse = await spec()
      .get(`/api/reference/collections/publishers/items/${createdId}`)
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.item).toEqual(
      expect.objectContaining({
        id: createdId,
        imprintCode: "M29 PUBLISHERS PROOF UPDATED",
        editionCount: 44,
        publiclyListed: false
      })
    );

    const deleteResponse = await spec()
      .delete(`/api/reference/collections/publishers/items/${createdId}`)
      .expectStatus(200);
    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.id).toBe(createdId);

    const missingRead = await spec()
      .get(`/api/reference/collections/publishers/items/${createdId}`)
      .expectStatus(404);
    expect(missingRead.body.error.code).toBe("ITEM_NOT_FOUND");
  });

}


registerReferenceSliceSuiteWithServer(registerReferenceSliceCollectionsExtendedCrudSuite);

