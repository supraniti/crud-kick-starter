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
export function registerReferenceSliceDeployRemotesSuite() {
  test("GET /api/reference/products returns unfiltered list contract", async () => {
    const response = await spec().get("/api/reference/products").expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThan(0);
    expect(Array.isArray(response.body.items[0].tagIds)).toBe(true);
    expect(Array.isArray(response.body.items[0].tagLabels)).toBe(true);
    expect(response.body.meta).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        offset: 0,
        limit: 50
      })
    );
    expect(response.body.filters.applied.categoryIds).toEqual([]);
    expect(response.body.pipeline.executedStages).toEqual([
      "project",
      "sort",
      "filter",
      "slice",
      "resolve"
    ]);
  });

  test("GET /api/reference/products supports categoryIds filter", async () => {
    const response = await spec()
      .get("/api/reference/products?categoryIds=cat-002")
      .expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.filters.applied.categoryIds).toEqual(["cat-002"]);
    expect(response.body.items.length).toBeGreaterThan(0);

    for (const row of response.body.items) {
      expect(row.categoryId).toBe("cat-002");
      expect(typeof row.categoryLabel).toBe("string");
    }
  });

  test("GET /api/reference/deploy/state returns structured release payload", async () => {
    const response = await spec()
      .get("/api/reference/deploy/state")
      .expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.deploy).toEqual(
      expect.objectContaining({
        currentRevision: expect.any(Number),
        deployedRevision: expect.any(Number),
        deployRequired: expect.any(Boolean)
      })
    );
    expect(response.body.deploy).toHaveProperty("lastMutationAt");
    expect(response.body.deploy).toHaveProperty("lastDeployAt");
    expect(response.body.deploy).toHaveProperty("lastDeployJobId");
    expect(response.body.deploy).toHaveProperty("lastDeployRemoteId");
  });

  test("remote CRUD: list/create/update/delete flow with validation", async () => {
    const listResponse = await spec()
      .get("/api/reference/remotes")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(Array.isArray(listResponse.body.items)).toBe(true);
    expect(listResponse.body.items.length).toBeGreaterThanOrEqual(2);

    const invalidCreate = await spec()
      .post("/api/reference/remotes")
      .withJson({
        label: "",
        kind: "filesystem",
        endpoint: "file://x",
        enabled: true
      })
      .expectStatus(400);
    expect(invalidCreate.body.error.code).toBe("REMOTE_LABEL_REQUIRED");

    const unknownFieldCreate = await spec()
      .post("/api/reference/remotes")
      .withJson({
        label: "Unknown Field Remote",
        kind: "filesystem",
        endpoint: "file://x",
        enabled: true,
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldCreate.body.error.code).toBe("REMOTE_FIELD_UNKNOWN");

    const createResponse = await spec()
      .post("/api/reference/remotes")
      .withJson({
        label: "QA Mirror",
        kind: "HTTP",
        endpoint: "https://qa.example.invalid/deploy",
        enabled: true
      })
      .expectStatus(201);
    expect(createResponse.body.ok).toBe(true);
    expect(createResponse.body.item).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        label: "QA Mirror",
        kind: "http",
        enabled: true
      })
    );

    const remoteId = createResponse.body.item.id;

    const invalidUpdate = await spec()
      .put(`/api/reference/remotes/${remoteId}`)
      .withJson({
        enabled: "nope"
      })
      .expectStatus(400);
    expect(invalidUpdate.body.error.code).toBe("REMOTE_ENABLED_INVALID");

    const unknownFieldUpdate = await spec()
      .put(`/api/reference/remotes/${remoteId}`)
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("REMOTE_FIELD_UNKNOWN");

    const updateResponse = await spec()
      .put(`/api/reference/remotes/${remoteId}`)
      .withJson({
        enabled: false
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.item.enabled).toBe(false);

    const deleteResponse = await spec()
      .delete(`/api/reference/remotes/${remoteId}`)
      .expectStatus(200);
    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.remoteId).toBe(remoteId);
  });

  test("GET /api/reference/safeguards/preview returns structured safeguard payload", async () => {
    const response = await spec()
      .get("/api/reference/safeguards/preview?value=New%20Tag")
      .expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.safeguard).toEqual(
      expect.objectContaining({
        ok: true,
        decision: "require-confirmation",
        severity: "warning",
        code: "SAFEGUARD_CONFIRMATION_REQUIRED"
      })
    );
  });

  test("POST /api/reference/products/:id/tags requires safeguard confirmation for new tag", async () => {
    const response = await spec()
      .post("/api/reference/products/prd-001/tags")
      .withJson({
        tagIds: ["tag-001"],
        newTagLabel: "Seasonal",
        approveNewTag: false
      })
      .expectStatus(409);

    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe("SAFEGUARD_CONFIRMATION_REQUIRED");
    expect(response.body.safeguard.decision).toBe("require-confirmation");
  });

  test("POST /api/reference/products/:id/tags saves after safeguard confirmation", async () => {
    const response = await spec()
      .post("/api/reference/products/prd-001/tags")
      .withJson({
        tagIds: ["tag-001"],
        newTagLabel: "Seasonal",
        approveNewTag: true
      })
      .expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.item.tagLabels).toContain("Seasonal");
    expect(response.body.meta.createdTag).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        label: "Seasonal"
      })
    );
  });

  test("POST /api/reference/taxonomies/tags/impact returns delete impact summary", async () => {
    const response = await spec()
      .post("/api/reference/taxonomies/tags/impact")
      .withJson({
        tagIds: ["tag-001"]
      })
      .expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.impact.dependentCount).toBeGreaterThan(0);
    expect(response.body.impact.referenceCount).toBeGreaterThan(0);
    expect(response.body.safeguard.decision).toBe("require-confirmation");
  });

  test("POST /api/reference/taxonomies/tags/delete blocks without explicit approval", async () => {
    const response = await spec()
      .post("/api/reference/taxonomies/tags/delete")
      .withJson({
        tagIds: ["tag-001"],
        approved: false
      })
      .expectStatus(409);

    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe("SAFEGUARD_CONFIRMATION_REQUIRED");
    expect(response.body.safeguard.decision).toBe("require-confirmation");
  });

  test("POST /api/reference/taxonomies/tags/delete removes tags and cleans product references", async () => {
    const deleteResponse = await spec()
      .post("/api/reference/taxonomies/tags/delete")
      .withJson({
        tagIds: ["tag-001"],
        approved: true
      })
      .expectStatus(200);

    expect(deleteResponse.body.ok).toBe(true);
    expect(deleteResponse.body.removed.tagIds).toEqual(["tag-001"]);
    expect(deleteResponse.body.cleanup.productCount).toBeGreaterThan(0);
    expect(deleteResponse.body.cleanup.referenceCount).toBeGreaterThan(0);

    const tagsResponse = await spec()
      .get("/api/reference/taxonomies/tags")
      .expectStatus(200);
    const tagIds = tagsResponse.body.items.map((item) => item.id);
    expect(tagIds).not.toContain("tag-001");

    const productsResponse = await spec()
      .get("/api/reference/products")
      .expectStatus(200);
    for (const item of productsResponse.body.items) {
      expect(item.tagIds).not.toContain("tag-001");
      expect(item.tagLabels).not.toContain("Featured");
    }
  });

  test("deploy lifecycle: mutation sets deploy-required, deploy job succeeds, marker clears", async () => {
    await spec()
      .post("/api/reference/products/prd-002/tags")
      .withJson({
        tagIds: ["tag-003", "tag-004"],
        approveNewTag: false
      })
      .expectStatus(200);

    const dirtyState = await spec()
      .get("/api/reference/deploy/state")
      .expectStatus(200);

    expect(dirtyState.body.deploy.deployRequired).toBe(true);
    expect(dirtyState.body.deploy.currentRevision).toBeGreaterThan(
      dirtyState.body.deploy.deployedRevision
    );

    const missingRemote = await spec()
      .post("/api/reference/deploy/jobs")
      .withJson({
        remoteId: ""
      })
      .expectStatus(400);
    expect(missingRemote.body.error.code).toBe("REMOTE_ID_REQUIRED");

    const missingTarget = await spec()
      .post("/api/reference/deploy/jobs")
      .withJson({
        remoteId: "remote-999"
      })
      .expectStatus(404);
    expect(missingTarget.body.error.code).toBe("REMOTE_NOT_FOUND");

    await spec()
      .put("/api/reference/remotes/remote-002")
      .withJson({
        enabled: false
      })
      .expectStatus(200);

    const disabledTarget = await spec()
      .post("/api/reference/deploy/jobs")
      .withJson({
        remoteId: "remote-002"
      })
      .expectStatus(409);
    expect(disabledTarget.body.error.code).toBe("REMOTE_DISABLED");

    const submitResponse = await spec()
      .post("/api/reference/deploy/jobs")
      .withJson({
        remoteId: "remote-001"
      })
      .expectStatus(202);

    expect(submitResponse.body.ok).toBe(true);
    expect(submitResponse.body.job).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        type: "deploy-remote"
      })
    );

    const terminalJob = await waitForDeployJob(submitResponse.body.job.id);
    expect(terminalJob.status).toBe("succeeded");
    expect(Array.isArray(terminalJob.logs)).toBe(true);
    expect(terminalJob.logs.length).toBeGreaterThan(0);
    expect(terminalJob.result.artifacts).toEqual(
      expect.objectContaining({
        revision: expect.any(Number),
        outputDir: expect.any(String),
        counts: expect.objectContaining({
          products: expect.any(Number),
          files: expect.any(Number)
        })
      })
    );
    expect(terminalJob.result.remote).toEqual(
      expect.objectContaining({
        id: "remote-001",
        label: expect.any(String)
      })
    );
    expect(terminalJob.result.deployment).toEqual(
      expect.objectContaining({
        status: "succeeded",
        destination: expect.any(String)
      })
    );

    const listResponse = await spec()
      .get("/api/reference/deploy/jobs")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.items[0].id).toBe(submitResponse.body.job.id);
    expect(listResponse.body.items[0].status).toBe("succeeded");

    const cleanState = await spec()
      .get("/api/reference/deploy/state")
      .expectStatus(200);

    expect(cleanState.body.deploy.deployRequired).toBe(false);
    expect(cleanState.body.deploy.currentRevision).toBe(
      cleanState.body.deploy.deployedRevision
    );
    expect(cleanState.body.deploy.lastDeployJobId).toBe(submitResponse.body.job.id);
    expect(cleanState.body.deploy.lastDeployRemoteId).toBe("remote-001");
  });
}


registerReferenceSliceSuiteWithServer(registerReferenceSliceDeployRemotesSuite);

