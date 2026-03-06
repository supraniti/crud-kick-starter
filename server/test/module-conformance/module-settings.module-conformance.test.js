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

const REMOTES_MODULE_ID = resolveReferenceModuleId("remotes");
const ARTICLES_MODULE_ID = resolveReferenceModuleId("articles");
const AUTHORS_MODULE_ID = resolveReferenceModuleId("authors");
const PUBLISHERS_MODULE_ID = resolveReferenceModuleId("publishers");
const EDITORS_MODULE_ID = resolveReferenceModuleId("editors");
const AUTHORS_SHARE_SETTINGS_WITH_PUBLISHERS = AUTHORS_MODULE_ID === PUBLISHERS_MODULE_ID;
const AUTHORS_SHARE_SETTINGS_WITH_EDITORS = AUTHORS_MODULE_ID === EDITORS_MODULE_ID;

function registerReferenceSliceModuleSettingsConformanceSuite() {
  test("module settings endpoints enforce deterministic schema, redaction, and unknown-field rejection", async () => {
    const listResponse = await spec()
      .get("/api/reference/settings/modules")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    const remotesSummary = (listResponse.body.items ?? []).find(
      (item) => item?.moduleId === REMOTES_MODULE_ID
    );
    expect(remotesSummary).toBeTruthy();
    expect(remotesSummary?.fieldCount).toBeGreaterThanOrEqual(6);

    const readResponse = await spec()
      .get(buildReferenceModuleSettingsPath("remotes"))
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.settings.schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "deployMode",
          type: "enum"
        }),
        expect.objectContaining({
          id: "deployTimeoutMs",
          type: "number"
        }),
        expect.objectContaining({
          id: "verifyTls",
          type: "boolean"
        }),
        expect.objectContaining({
          id: "controlPlaneUrl",
          type: "url"
        }),
        expect.objectContaining({
          id: "lastAuditOn",
          type: "date"
        }),
        expect.objectContaining({
          id: "apiToken",
          type: "text",
          sensitive: true
        })
      ])
    );
    expect(readResponse.body.settings.values).toEqual(
      expect.objectContaining({
        deployMode: "safe",
        deployTimeoutMs: 120000,
        verifyTls: true,
        controlPlaneUrl: "https://control.example.invalid/deploy",
        lastAuditOn: "2026-02-01",
        apiToken: null
      })
    );
    expect(readResponse.body.settings.redactedFieldIds).toContain("apiToken");

    const unknownFieldUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("remotes"))
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("MODULE_SETTINGS_FIELD_UNKNOWN");

    const updateResponse = await spec()
      .put(buildReferenceModuleSettingsPath("remotes"))
      .withJson({
        deployMode: "fast",
        deployTimeoutMs: 240000,
        verifyTls: false,
        controlPlaneUrl: "https://control-fast.example.invalid/deploy",
        lastAuditOn: "2026-03-14",
        apiToken: "token-123"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.settings.values).toEqual(
      expect.objectContaining({
        deployMode: "fast",
        deployTimeoutMs: 240000,
        verifyTls: false,
        controlPlaneUrl: "https://control-fast.example.invalid/deploy",
        lastAuditOn: "2026-03-14",
        apiToken: null
      })
    );
    expect(updateResponse.body.settings.redactedFieldIds).toContain("apiToken");
  });


  test("module settings url fields enforce deterministic validation and normalization", async () => {
    const invalidUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("remotes"))
      .withJson({
        controlPlaneUrl: "ftp://control.example.invalid/deploy"
      })
      .expectStatus(400);
    expect(invalidUpdate.body.error.code).toBe("MODULE_SETTINGS_FIELD_INVALID");
    expect(invalidUpdate.body.error.message).toContain("valid http(s) URL");

    const validUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("remotes"))
      .withJson({
        controlPlaneUrl: "  https://ops.example.invalid/control  "
      })
      .expectStatus(200);
    expect(validUpdate.body.ok).toBe(true);
    expect(validUpdate.body.settings.values).toEqual(
      expect.objectContaining({
        controlPlaneUrl: "https://ops.example.invalid/control"
      })
    );
  });


  test("module settings date fields enforce deterministic validation and normalization", async () => {
    const invalidUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("remotes"))
      .withJson({
        lastAuditOn: "2026-02-30"
      })
      .expectStatus(400);
    expect(invalidUpdate.body.error.code).toBe("MODULE_SETTINGS_FIELD_INVALID");
    expect(invalidUpdate.body.error.message).toContain("YYYY-MM-DD");

    const validUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("remotes"))
      .withJson({
        lastAuditOn: " 2026-03-01 "
      })
      .expectStatus(200);
    expect(validUpdate.body.ok).toBe(true);
    expect(validUpdate.body.settings.values).toEqual(
      expect.objectContaining({
        lastAuditOn: "2026-03-01"
      })
    );

    const clearedUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("remotes"))
      .withJson({
        lastAuditOn: "   "
      })
      .expectStatus(200);
    expect(clearedUpdate.body.ok).toBe(true);
    expect(clearedUpdate.body.settings.values).toEqual(
      expect.objectContaining({
        lastAuditOn: null
      })
    );
  });


  test("dispatches module settings support enum-multi fields with deterministic validation", async () => {
    const readResponse = await spec()
      .get(buildReferenceModuleSettingsPath("dispatches"))
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.settings.schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "publishChannels",
          type: "enum-multi",
          required: true
        }),
        expect.objectContaining({
          id: "slugMaxLength",
          type: "number",
          required: true
        })
      ])
    );
    expect(readResponse.body.settings.values).toEqual(
      expect.objectContaining({
        publishChannels: ["web"],
        slugMaxLength: 64
      })
    );

    const invalidUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("dispatches"))
      .withJson({
        publishChannels: "web"
      })
      .expectStatus(400);
    expect(invalidUpdate.body.error.code).toBe("MODULE_SETTINGS_FIELD_INVALID");

    const emptyRequiredUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("dispatches"))
      .withJson({
        publishChannels: []
      })
      .expectStatus(400);
    expect(emptyRequiredUpdate.body.error.code).toBe("MODULE_SETTINGS_FIELD_REQUIRED");

    const updateResponse = await spec()
      .put(buildReferenceModuleSettingsPath("dispatches"))
      .withJson({
        publishChannels: ["web", "email", "web"]
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.settings.values).toEqual(
      expect.objectContaining({
        publishChannels: ["web", "email"],
        slugMaxLength: 64
      })
    );

    const invalidSlugLength = await spec()
      .put(buildReferenceModuleSettingsPath("dispatches"))
      .withJson({
        slugMaxLength: 11
      })
      .expectStatus(400);
    expect(invalidSlugLength.body.error.code).toBe("MODULE_SETTINGS_FIELD_RANGE_INVALID");

    const slugLengthUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("dispatches"))
      .withJson({
        slugMaxLength: 18
      })
      .expectStatus(200);
    expect(slugLengthUpdate.body.ok).toBe(true);
    expect(slugLengthUpdate.body.settings.values).toEqual(
      expect.objectContaining({
        slugMaxLength: 18
      })
    );
  });


  test("articles module settings are exposed with deterministic redaction and writes", async () => {
    const listResponse = await spec()
      .get("/api/reference/settings/modules")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          moduleId: ARTICLES_MODULE_ID,
          fieldCount: 4
        })
      ])
    );

    const readResponse = await spec()
      .get(buildReferenceModuleSettingsPath("articles"))
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.settings.schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "editorialMode",
          type: "enum"
        }),
        expect.objectContaining({
          id: "requireReview",
          type: "boolean"
        }),
        expect.objectContaining({
          id: "defaultCategory",
          type: "enum"
        }),
        expect.objectContaining({
          id: "webhookToken",
          type: "text",
          sensitive: true
        })
      ])
    );
    expect(readResponse.body.settings.values).toEqual(
      expect.objectContaining({
        editorialMode: "standard",
        requireReview: true,
        defaultCategory: "news",
        webhookToken: null
      })
    );
    expect(readResponse.body.settings.redactedFieldIds).toContain("webhookToken");

    const unknownFieldUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("articles"))
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("MODULE_SETTINGS_FIELD_UNKNOWN");

    const updateResponse = await spec()
      .put(buildReferenceModuleSettingsPath("articles"))
      .withJson({
        editorialMode: "strict",
        requireReview: false,
        defaultCategory: "guide",
        webhookToken: "articles-token"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.settings.values).toEqual(
      expect.objectContaining({
        editorialMode: "strict",
        requireReview: false,
        defaultCategory: "guide",
        webhookToken: null
      })
    );
    expect(updateResponse.body.settings.redactedFieldIds).toContain("webhookToken");
  });


  test("authors module settings are exposed with deterministic redaction and writes", async () => {
    const listResponse = await spec()
      .get("/api/reference/settings/modules")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          moduleId: AUTHORS_MODULE_ID,
          fieldCount: 4
        })
      ])
    );

    const readResponse = await spec()
      .get(buildReferenceModuleSettingsPath("authors"))
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.settings.schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "editorialMode",
          type: "enum"
        }),
        expect.objectContaining({
          id: "requireReview",
          type: "boolean"
        }),
        expect.objectContaining({
          id: "defaultCategory",
          type: "enum"
        }),
        expect.objectContaining({
          id: "webhookToken",
          type: "text",
          sensitive: true
        })
      ])
    );
    expect(readResponse.body.settings.values).toEqual(
      expect.objectContaining({
        editorialMode: "standard",
        requireReview: true,
        defaultCategory: "news",
        webhookToken: null
      })
    );
    expect(readResponse.body.settings.redactedFieldIds).toContain("webhookToken");

    const unknownFieldUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("authors"))
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("MODULE_SETTINGS_FIELD_UNKNOWN");

    const updateResponse = await spec()
      .put(buildReferenceModuleSettingsPath("authors"))
      .withJson({
        editorialMode: "strict",
        requireReview: false,
        defaultCategory: "guide",
        webhookToken: "authors-token"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.settings.values).toEqual(
      expect.objectContaining({
        editorialMode: "strict",
        requireReview: false,
        defaultCategory: "guide",
        webhookToken: null
      })
    );
    expect(updateResponse.body.settings.redactedFieldIds).toContain("webhookToken");
  });


  test("publishers module settings are exposed with deterministic redaction and writes", async () => {
    const listResponse = await spec()
      .get("/api/reference/settings/modules")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          moduleId: PUBLISHERS_MODULE_ID,
          fieldCount: 4
        })
      ])
    );

    const readResponse = await spec()
      .get(buildReferenceModuleSettingsPath("publishers"))
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.settings.schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "editorialMode",
          type: "enum"
        }),
        expect.objectContaining({
          id: "requireReview",
          type: "boolean"
        }),
        expect.objectContaining({
          id: "defaultCategory",
          type: "enum"
        }),
        expect.objectContaining({
          id: "webhookToken",
          type: "text",
          sensitive: true
        })
      ])
    );
    expect(readResponse.body.settings.values).toEqual(
      expect.objectContaining({
        editorialMode: AUTHORS_SHARE_SETTINGS_WITH_PUBLISHERS ? "strict" : "standard",
        requireReview: AUTHORS_SHARE_SETTINGS_WITH_PUBLISHERS ? false : true,
        defaultCategory: AUTHORS_SHARE_SETTINGS_WITH_PUBLISHERS ? "guide" : "news",
        webhookToken: null
      })
    );
    expect(readResponse.body.settings.redactedFieldIds).toContain("webhookToken");

    const unknownFieldUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("publishers"))
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("MODULE_SETTINGS_FIELD_UNKNOWN");

    const updateResponse = await spec()
      .put(buildReferenceModuleSettingsPath("publishers"))
      .withJson({
        editorialMode: "strict",
        requireReview: false,
        defaultCategory: "guide",
        webhookToken: "publishers-token"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.settings.values).toEqual(
      expect.objectContaining({
        editorialMode: "strict",
        requireReview: false,
        defaultCategory: "guide",
        webhookToken: null
      })
    );
    expect(updateResponse.body.settings.redactedFieldIds).toContain("webhookToken");
  });


  test("editors module settings are exposed with deterministic redaction and writes", async () => {
    const listResponse = await spec()
      .get("/api/reference/settings/modules")
      .expectStatus(200);
    expect(listResponse.body.ok).toBe(true);
    expect(listResponse.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          moduleId: EDITORS_MODULE_ID,
          fieldCount: 4
        })
      ])
    );

    const readResponse = await spec()
      .get(buildReferenceModuleSettingsPath("editors"))
      .expectStatus(200);
    expect(readResponse.body.ok).toBe(true);
    expect(readResponse.body.settings.schema.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "editorialMode",
          type: "enum"
        }),
        expect.objectContaining({
          id: "requireReview",
          type: "boolean"
        }),
        expect.objectContaining({
          id: "defaultCategory",
          type: "enum"
        }),
        expect.objectContaining({
          id: "webhookToken",
          type: "text",
          sensitive: true
        })
      ])
    );
    expect(readResponse.body.settings.values).toEqual(
      expect.objectContaining({
        editorialMode: AUTHORS_SHARE_SETTINGS_WITH_EDITORS ? "strict" : "standard",
        requireReview: AUTHORS_SHARE_SETTINGS_WITH_EDITORS ? false : true,
        defaultCategory: AUTHORS_SHARE_SETTINGS_WITH_EDITORS ? "guide" : "news",
        webhookToken: null
      })
    );
    expect(readResponse.body.settings.redactedFieldIds).toContain("webhookToken");

    const unknownFieldUpdate = await spec()
      .put(buildReferenceModuleSettingsPath("editors"))
      .withJson({
        unsupported: true
      })
      .expectStatus(400);
    expect(unknownFieldUpdate.body.error.code).toBe("MODULE_SETTINGS_FIELD_UNKNOWN");

    const updateResponse = await spec()
      .put(buildReferenceModuleSettingsPath("editors"))
      .withJson({
        editorialMode: "strict",
        requireReview: false,
        defaultCategory: "guide",
        webhookToken: "editors-token"
      })
      .expectStatus(200);
    expect(updateResponse.body.ok).toBe(true);
    expect(updateResponse.body.settings.values).toEqual(
      expect.objectContaining({
        editorialMode: "strict",
        requireReview: false,
        defaultCategory: "guide",
        webhookToken: null
      })
    );
    expect(updateResponse.body.settings.redactedFieldIds).toContain("webhookToken");
  });

}

export { registerReferenceSliceModuleSettingsConformanceSuite };

