import { registerReferenceSliceSuiteWithServer } from './helpers/reference-slice-suite-host.js';
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { spec } from "pactum";
import { createReferenceStatePersistenceAdapter } from "../../src/domains/reference/runtime-kernel/state-persistence.js";
import { createReferenceState } from "../../src/domains/reference/runtime-kernel/state-utils.js";
import {
  buildReferenceModuleSettingsPath,
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

const BRIEFS_MODULE_ID = resolveReferenceModuleId("briefs");
const DIGESTS_MODULE_ID = resolveReferenceModuleId("digests");

export function registerReferenceSliceCollectionsExtendedComputedSuite() {
  test("briefs collection applies non-slug computed resolvers deterministically", async () => {
    const runtimeResponse = await spec()
      .get("/api/reference/modules/runtime")
      .expectStatus(200);
    expect(runtimeResponse.body.ok).toBe(true);
    expect(runtimeResponse.body.runtime.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: BRIEFS_MODULE_ID,
          state: "enabled",
          collectionIds: expect.arrayContaining(["briefs"])
        })
      ])
    );
    expect(runtimeResponse.body.runtime.serviceModuleMap).toEqual(
      expect.objectContaining({
        "briefs-index-service": BRIEFS_MODULE_ID
      })
    );
    expect(runtimeResponse.body.runtime.collectionRepositoryModuleMap).toEqual(
      expect.objectContaining({
        briefs: BRIEFS_MODULE_ID
      })
    );

    const unknownFieldCreate = await spec()
      .post("/api/reference/collections/briefs/items")
      .withJson({
        title: "Unknown field brief",
        status: "draft",
        category: "news",
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("BRIEF_FIELD_UNKNOWN");

    const createResponse = await spec()
      .post("/api/reference/collections/briefs/items")
      .withJson({
        title: "Brief Resolver Beacon",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        summary: "Resolver proof summary",
        sourceUrl: "https://briefs.example.test/brief-proof"
      })
      .expectStatus(201);
    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item).toEqual(
      expect.objectContaining({
        title: "Brief Resolver Beacon",
        status: "draft",
        category: "news",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        summary: "Resolver proof summary",
        sourceUrl: "https://briefs.example.test/brief-proof",
        headlineCode: "BRIEF RESOLVER BEACON",
        headlineEcho: "Brief Resolver Beacon",
        headlineTitle: "Brief Resolver Beacon"
      })
    );
    expect(createResponse.body.item).not.toHaveProperty("slug");
    const briefId = createResponse.body.item.id;

    const invalidUrlUpdate = await spec()
      .put(`/api/reference/collections/briefs/items/${briefId}`)
      .withJson({
        sourceUrl: "ftp://briefs.example.test/invalid"
      })
      .expectStatus(400);
    expect(invalidUrlUpdate.body.error.code).toBe("BRIEF_SOURCE_URL_INVALID_URL");

    const invalidPublishedUpdate = await spec()
      .put(`/api/reference/collections/briefs/items/${briefId}`)
      .withJson({
        status: "published",
        publishedOn: null
      })
      .expectStatus(400);
    expect(invalidPublishedUpdate.body.error.code).toBe(
      "BRIEF_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const updateResponse = await spec()
      .put(`/api/reference/collections/briefs/items/${briefId}`)
      .withJson({
        title: "Brief Resolver Beacon Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        summary: "Updated resolver proof summary",
        sourceUrl: "https://briefs.example.test/brief-proof-updated"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item).toEqual(
      expect.objectContaining({
        id: briefId,
        title: "Brief Resolver Beacon Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        summary: "Updated resolver proof summary",
        sourceUrl: "https://briefs.example.test/brief-proof-updated",
        headlineCode: "BRIEF RESOLVER BEACON UPDATED",
        headlineEcho: "Brief Resolver Beacon Updated",
        headlineTitle: "Brief Resolver Beacon Updated"
      })
    );

    const listResponse = await spec()
      .get("/api/reference/collections/briefs/items?status=published&category=ops&recordId=rec-002&search=beacon")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.meta.total).toBe(1);
    expect(listResponse.body.items[0].id).toBe(briefId);

    const deleteResponse = await spec()
      .delete(`/api/reference/collections/briefs/items/${briefId}`)
      .expectStatus(200);
    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.id).toBe(briefId);

    const missingRead = await spec()
      .get(`/api/reference/collections/briefs/items/${briefId}`)
      .expectStatus(404);
    expect(missingRead.body.error.code).toBe("ITEM_NOT_FOUND");
  });

  test("digests collection applies multi-resolver computed fields deterministically", async () => {
    const runtimeResponse = await spec()
      .get("/api/reference/modules/runtime")
      .expectStatus(200);
    expect(runtimeResponse.body.ok).toBe(true);
    expect(runtimeResponse.body.runtime.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: DIGESTS_MODULE_ID,
          state: "enabled",
          collectionIds: expect.arrayContaining(["digests"])
        })
      ])
    );
    expect(runtimeResponse.body.runtime.serviceModuleMap).toEqual(
      expect.objectContaining({
        "digests-index-service": DIGESTS_MODULE_ID
      })
    );
    expect(runtimeResponse.body.runtime.collectionRepositoryModuleMap).toEqual(
      expect.objectContaining({
        digests: DIGESTS_MODULE_ID
      })
    );

    const unknownFieldCreate = await spec()
      .post("/api/reference/collections/digests/items")
      .withJson({
        title: "Unknown field digest",
        status: "draft",
        category: "news",
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("DIGEST_FIELD_UNKNOWN");

    const createResponse = await spec()
      .post("/api/reference/collections/digests/items")
      .withJson({
        title: "Digest Resolver Beacon",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        summary: "Resolver catalog multi-token proof",
        sourceUrl: "https://digests.example.test/digest-proof"
      })
      .expectStatus(201);
    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item).toEqual(
      expect.objectContaining({
        title: "Digest Resolver Beacon",
        status: "draft",
        category: "news",
        labels: ["featured", "engineering"],
        publishedOn: null,
        recordId: "rec-001",
        summary: "Resolver catalog multi-token proof",
        sourceUrl: "https://digests.example.test/digest-proof",
        slug: "digest-resolver-beacon",
        headlineCode: "DIGEST RESOLVER BEACON",
        headlineEcho: "Digest Resolver Beacon",
        headlineLower: "digest resolver beacon",
        headlineTitle: "Digest Resolver Beacon"
      })
    );
    const digestId = createResponse.body.item.id;

    const invalidUrlUpdate = await spec()
      .put(`/api/reference/collections/digests/items/${digestId}`)
      .withJson({
        sourceUrl: "mailto:digest@example.test"
      })
      .expectStatus(400);
    expect(invalidUrlUpdate.body.error.code).toBe("DIGEST_SOURCE_URL_INVALID_URL");

    const invalidPublishedUpdate = await spec()
      .put(`/api/reference/collections/digests/items/${digestId}`)
      .withJson({
        status: "published",
        publishedOn: null
      })
      .expectStatus(400);
    expect(invalidPublishedUpdate.body.error.code).toBe(
      "DIGEST_PUBLISHED_ON_REQUIRED_FOR_PUBLISHED"
    );

    const updateResponse = await spec()
      .put(`/api/reference/collections/digests/items/${digestId}`)
      .withJson({
        title: "Digest Resolver Beacon Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        summary: "Updated resolver catalog multi-token proof",
        sourceUrl: "https://digests.example.test/digest-proof-updated"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item).toEqual(
      expect.objectContaining({
        id: digestId,
        title: "Digest Resolver Beacon Updated",
        status: "published",
        category: "ops",
        labels: ["release"],
        publishedOn: "2026-02-14",
        recordId: "rec-002",
        summary: "Updated resolver catalog multi-token proof",
        sourceUrl: "https://digests.example.test/digest-proof-updated",
        slug: "digest-resolver-beacon-updated",
        headlineCode: "DIGEST RESOLVER BEACON UPDATED",
        headlineEcho: "Digest Resolver Beacon Updated",
        headlineLower: "digest resolver beacon updated",
        headlineTitle: "Digest Resolver Beacon Updated"
      })
    );

    const listResponse = await spec()
      .get("/api/reference/collections/digests/items?status=published&category=ops&recordId=rec-002&search=beacon")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.meta.total).toBe(1);
    expect(listResponse.body.items[0].id).toBe(digestId);

    const deleteResponse = await spec()
      .delete(`/api/reference/collections/digests/items/${digestId}`)
      .expectStatus(200);
    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.id).toBe(digestId);

    const missingRead = await spec()
      .get(`/api/reference/collections/digests/items/${digestId}`)
      .expectStatus(404);
    expect(missingRead.body.error.code).toBe("ITEM_NOT_FOUND");
  });

  test("dispatches computed slug resolver applies module settings driven maxLength", async () => {
    await spec()
      .put(buildReferenceModuleSettingsPath("dispatches"))
      .withJson({
        slugMaxLength: 18
      })
      .expectStatus(200);

    const createResponse = await spec()
      .post("/api/reference/collections/dispatches/items")
      .withJson({
        title: "Dispatches Runtime Settings To Compute Linkage Proof",
        status: "draft",
        category: "news"
      })
      .expectStatus(201);
    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item.slug).toBe("dispatches-runtime");
    const dispatchId = createResponse.body.item.id;

    await spec()
      .put(buildReferenceModuleSettingsPath("dispatches"))
      .withJson({
        slugMaxLength: 13
      })
      .expectStatus(200);

    const updateResponse = await spec()
      .put(`/api/reference/collections/dispatches/items/${dispatchId}`)
      .withJson({
        title: "Settings Linkage Updated"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item.slug).toBe("settings-link");

    await spec()
      .delete(`/api/reference/collections/dispatches/items/${dispatchId}`)
      .expectStatus(200);

    await spec()
      .put(buildReferenceModuleSettingsPath("dispatches"))
      .withJson({
        slugMaxLength: 64
      })
      .expectStatus(200);
  });

  test("deleting a note cleans dependent records.noteIds references", async () => {
    const createdNote = await spec()
      .post("/api/reference/collections/notes/items")
      .withJson({
        title: "Cleanup Link Note",
        category: "general",
        labels: ["ops"],
        priority: 2,
        pinned: false,
        dueDate: null,
        recordId: null
      })
      .expectStatus(201);
    const noteId = createdNote.body.item.id;

    const createdRecord = await spec()
      .post("/api/reference/collections/records/items")
      .withJson({
        title: "Cleanup Link Record",
        status: "draft",
        score: 55,
        featured: false,
        publishedOn: null,
        noteIds: [noteId]
      })
      .expectStatus(201);
    const recordId = createdRecord.body.item.id;
    expect(createdRecord.body.item.noteIds).toEqual([noteId]);

    await spec()
      .delete(`/api/reference/collections/notes/items/${noteId}`)
      .expectStatus(200);

    const recordRead = await spec()
      .get(`/api/reference/collections/records/items/${recordId}`)
      .expectStatus(200);
    expect(recordRead.body.ok).toBe(true);
    expect(recordRead.body.item.noteIds).toEqual([]);
    expect(recordRead.body.item.noteTitles).toEqual([]);

    await spec()
      .delete(`/api/reference/collections/records/items/${recordId}`)
      .expectStatus(200);
  });
}


registerReferenceSliceSuiteWithServer(registerReferenceSliceCollectionsExtendedComputedSuite);



