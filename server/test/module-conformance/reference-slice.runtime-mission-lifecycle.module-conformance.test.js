import { registerReferenceSliceSuiteWithServer } from './helpers/reference-slice-suite-host.js';
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";
import { spec } from "pactum";
import { createReferenceStatePersistenceAdapter } from "../../src/domains/reference/runtime-kernel/state-persistence.js";
import { createReferenceState } from "../../src/domains/reference/runtime-kernel/state-utils.js";
import {
  buildReferenceModuleLifecyclePath,
  buildReferenceModuleSettingsPath,
  createEphemeralReferenceServer,
  createModuleManifestWithoutCollections,
  createRuntimeCollectionModuleManifest,
  createRuntimeServiceMissionModuleManifest,
  createSharedReferenceStatePersistence,
  injectJson,
  resolveReferenceModuleIdCandidates,
  waitForDeployJob,
  waitForDeployJobInInstance,
  waitForMissionJob
} from "./helpers/reference-slice-runtime-test-helpers.js";

function escapeRegexToken(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createModuleIdMatcher(legacyModuleId) {
  const candidates = resolveReferenceModuleIdCandidates(legacyModuleId);
  if (candidates.length === 1) {
    return candidates[0];
  }
  return expect.stringMatching(
    new RegExp(`^(${candidates.map((candidate) => escapeRegexToken(candidate)).join("|")})$`)
  );
}

const REMOTES_MODULE_ID_MATCHER = createModuleIdMatcher("remotes");
const PRODUCTS_MODULE_ID_MATCHER = createModuleIdMatcher("products");
const ARTICLE_MODULE_ID_CANDIDATES = resolveReferenceModuleIdCandidates("articles");

function hasOwnKey(value, key) {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, key)
  );
}

export function registerReferenceSliceRuntimeLifecycleMissionAndLifecycleSuite() {
  test("runtime diagnostics surface missing service and mission registrars deterministically", async () => {
    const tempModulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const moduleDir = path.join(tempModulesRoot, "widgets-runtime");
    await fs.mkdir(moduleDir, {
      recursive: true
    });
    await fs.writeFile(
      path.join(moduleDir, "module.json"),
      JSON.stringify(createRuntimeServiceMissionModuleManifest(), null, 2),
      "utf8"
    );

    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: tempModulesRoot
    });

    try {
      const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
      expect(runtimeResponse.statusCode).toBe(200);
      expect(runtimeResponse.body.ok).toBe(true);
      expect(runtimeResponse.body.runtime.ok).toBe(false);
      expect(runtimeResponse.body.runtime.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "SERVICE_REGISTRAR_NOT_FOUND",
            moduleId: "widgets-runtime"
          }),
          expect.objectContaining({
            code: "MISSION_REGISTRAR_NOT_FOUND",
            moduleId: "widgets-runtime"
          })
        ])
      );
      expect(runtimeResponse.body.runtime.serviceDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "SERVICE_REGISTRAR_NOT_FOUND",
            moduleId: "widgets-runtime"
          })
        ])
      );
      expect(runtimeResponse.body.runtime.missionDiagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "MISSION_REGISTRAR_NOT_FOUND",
            moduleId: "widgets-runtime"
          })
        ])
      );
    } finally {
      await ephemeral.close();
      await fs.rm(tempModulesRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test(
    "mission endpoints execute mission jobs with deterministic async-job contracts",
    async () => {
    const ephemeral = await createEphemeralReferenceServer();

    try {
      const missionsResponse = await injectJson(ephemeral, "GET", "/api/reference/missions");
      expect(missionsResponse.statusCode).toBe(200);
      expect(missionsResponse.body.ok).toBe(true);
      expect(missionsResponse.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            missionId: "remote-deploy-mission",
            moduleId: REMOTES_MODULE_ID_MATCHER,
            payload: expect.objectContaining({
              fields: expect.arrayContaining([
                expect.objectContaining({
                  id: "remoteId",
                  type: "text"
                }),
                expect.objectContaining({
                  id: "shouldFail",
                  type: "boolean",
                  defaultValue: false
                })
              ])
            }),
            active: true,
            state: "enabled"
          })
        ])
      );

      const submitResponse = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/missions/remote-deploy-mission/jobs",
        {
          remoteId: "remote-001"
        }
      );
      expect(submitResponse.statusCode).toBe(202);
      expect(submitResponse.body.ok).toBe(true);
      expect(submitResponse.body.job).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          type: "mission:remote-deploy-mission"
        })
      );

      const terminalJob = await waitForMissionJob(ephemeral, submitResponse.body.job.id);
      expect(terminalJob.status).toBe("succeeded");
      expect(Array.isArray(terminalJob.logs)).toBe(true);
      expect(terminalJob.logs.length).toBeGreaterThan(0);
      expect(terminalJob.logs.map((entry) => entry.message)).toEqual(
        expect.arrayContaining([
          "Mission job queued",
          "Mission job started",
          "Mission job succeeded"
        ])
      );
      expect(terminalJob.result).toEqual(
        expect.objectContaining({
          missionId: "remote-deploy-mission",
          moduleId: REMOTES_MODULE_ID_MATCHER,
          output: expect.objectContaining({
            ok: true,
            remoteId: "remote-001",
            simulated: true
          })
        })
      );

      const jobsResponse = await injectJson(ephemeral, "GET", "/api/reference/missions/jobs");
      expect(jobsResponse.statusCode).toBe(200);
      expect(jobsResponse.body.ok).toBe(true);
      expect(jobsResponse.body.items[0]).toEqual(
        expect.objectContaining({
          id: submitResponse.body.job.id,
          type: "mission:remote-deploy-mission",
          status: "succeeded"
        })
      );
    } finally {
      await ephemeral.close();
    }
    },
    20_000
  );

  test(
    "mission endpoints reject invalid payloads with deterministic validation envelope",
    async () => {
    const ephemeral = await createEphemeralReferenceServer();

    try {
      const invalidPayloadResponse = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/missions/remote-deploy-mission/jobs",
        {
          hold: true
        }
      );

      expect(invalidPayloadResponse.statusCode).toBe(400);
      expect(invalidPayloadResponse.body.ok).toBe(false);
      expect(invalidPayloadResponse.body.error).toEqual(
        expect.objectContaining({
          code: "MISSION_PAYLOAD_INVALID",
          message: "Mission 'remote-deploy-mission' payload is invalid"
        })
      );
      expect(invalidPayloadResponse.body.validation).toEqual(
        expect.objectContaining({
          code: "REMOTE_DEPLOY_PAYLOAD_FIELD_UNKNOWN",
          fieldId: "hold"
        })
      );
      expect(invalidPayloadResponse.body.mission).toEqual(
        expect.objectContaining({
          missionId: "remote-deploy-mission",
          moduleId: REMOTES_MODULE_ID_MATCHER
        })
      );
    } finally {
      await ephemeral.close();
    }
    },
    20_000
  );

  test(
    "mission endpoints surface deterministic failure and lookup error contracts",
    async () => {
    const ephemeral = await createEphemeralReferenceServer();

    try {
      const unknownMission = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/missions/unknown-mission/jobs",
        {}
      );
      expect(unknownMission.statusCode).toBe(404);
      expect(unknownMission.body.error.code).toBe("MISSION_NOT_FOUND");

      const submitted = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/missions/remote-deploy-mission/jobs",
        {
          shouldFail: true
        }
      );
      expect(submitted.statusCode).toBe(202);

      const failedJob = await waitForMissionJob(ephemeral, submitted.body.job.id);
      expect(failedJob.status).toBe("failed");
      expect(failedJob.error).toEqual(
        expect.objectContaining({
          code: "REMOTE_DEPLOY_MISSION_FAILED"
        })
      );
      expect(failedJob.logs.map((entry) => entry.message)).toEqual(
        expect.arrayContaining(["Mission job failed"])
      );

      const cancelTerminal = await injectJson(
        ephemeral,
        "POST",
        `/api/reference/missions/jobs/${submitted.body.job.id}/cancel`,
        {}
      );
      expect(cancelTerminal.statusCode).toBe(409);
      expect(cancelTerminal.body.error.code).toBe("MISSION_JOB_NOT_CANCELLABLE");

      const unknownJob = await injectJson(ephemeral, "GET", "/api/reference/missions/jobs/job-unknown");
      expect(unknownJob.statusCode).toBe(404);
      expect(unknownJob.body.error.code).toBe("MISSION_JOB_NOT_FOUND");

      const cancelUnknown = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/missions/jobs/job-unknown/cancel",
        {}
      );
      expect(cancelUnknown.statusCode).toBe(404);
      expect(cancelUnknown.body.error.code).toBe("MISSION_JOB_NOT_FOUND");
    } finally {
      await ephemeral.close();
    }
    },
    20_000
  );

  test(
    "mission execution enforces lifecycle gating deterministically",
    async () => {
    const ephemeral = await createEphemeralReferenceServer();

    try {
      const disableResponse = await injectJson(
        ephemeral,
        "POST",
        buildReferenceModuleLifecyclePath("remotes", "disable")
      );
      expect(disableResponse.statusCode).toBe(200);
      expect(disableResponse.body.state.after).toBe("disabled");

      const blockedSubmission = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/missions/remote-deploy-mission/jobs",
        {}
      );
      expect(blockedSubmission.statusCode).toBe(409);
      expect(blockedSubmission.body.error.code).toBe("MISSION_MODULE_NOT_ENABLED");
      expect(blockedSubmission.body.mission).toEqual(
        expect.objectContaining({
          missionId: "remote-deploy-mission",
          moduleId: REMOTES_MODULE_ID_MATCHER,
          state: "disabled",
          active: false
        })
      );
    } finally {
      await ephemeral.close();
    }
    },
    20_000
  );

  test("module lifecycle endpoints enforce deterministic transition and error contracts", async () => {
    const disableResponse = await spec()
      .post(buildReferenceModuleLifecyclePath("products", "disable"))
      .expectStatus(200);
    expect(disableResponse.body).toEqual(
      expect.objectContaining({
        ok: true,
        action: "disable",
        moduleId: PRODUCTS_MODULE_ID_MATCHER,
        state: expect.objectContaining({
          before: "enabled",
          after: "disabled"
        })
      })
    );

    const enableResponse = await spec()
      .post(buildReferenceModuleLifecyclePath("products", "enable"))
      .expectStatus(200);
    expect(enableResponse.body.state).toEqual(
      expect.objectContaining({
        before: "disabled",
        after: "enabled"
      })
    );

    const uninstallResponse = await spec()
      .post(buildReferenceModuleLifecyclePath("products", "uninstall"))
      .expectStatus(200);
    expect(uninstallResponse.body.state).toEqual(
      expect.objectContaining({
        before: "enabled",
        after: "uninstalled"
      })
    );

    const invalidEnable = await spec()
      .post(buildReferenceModuleLifecyclePath("products", "enable"))
      .expectStatus(409);
    expect(invalidEnable.body).toEqual(
      expect.objectContaining({
        ok: false,
        action: "enable",
        moduleId: PRODUCTS_MODULE_ID_MATCHER,
        state: expect.objectContaining({
          before: "uninstalled",
          after: "uninstalled"
        }),
        error: expect.objectContaining({
          code: "MODULE_NOT_INSTALLED"
        })
      })
    );

    const installResponse = await spec()
      .post(buildReferenceModuleLifecyclePath("products", "install"))
      .expectStatus(200);
    expect(installResponse.body.state).toEqual(
      expect.objectContaining({
        before: "uninstalled",
        after: "installed"
      })
    );

    const reEnableResponse = await spec()
      .post(buildReferenceModuleLifecyclePath("products", "enable"))
      .expectStatus(200);
    expect(reEnableResponse.body.state).toEqual(
      expect.objectContaining({
        before: "installed",
        after: "enabled"
      })
    );

    const missingModule = await spec()
      .post("/api/reference/modules/unknown-module/install")
      .expectStatus(404);
    expect(missingModule.body.error.code).toBe("MODULE_NOT_DISCOVERED");
  });

  test("service and mission availability follows module lifecycle state", async () => {
    const disableResponse = await spec()
      .post(buildReferenceModuleLifecyclePath("remotes", "disable"))
      .expectStatus(200);
    expect(disableResponse.body.state).toEqual(
      expect.objectContaining({
        before: "enabled",
        after: "disabled"
      })
    );

    const runtimeAfterDisable = await spec()
      .get("/api/reference/modules/runtime")
      .expectStatus(200);
    expect(runtimeAfterDisable.body.runtime.registeredServiceIds).toContain(
      "remote-deploy-connector"
    );
    expect(runtimeAfterDisable.body.runtime.activeRegisteredServiceIds).not.toContain(
      "remote-deploy-connector"
    );
    expect(runtimeAfterDisable.body.runtime.registeredMissionIds).toContain(
      "remote-deploy-mission"
    );
    expect(runtimeAfterDisable.body.runtime.activeRegisteredMissionIds).not.toContain(
      "remote-deploy-mission"
    );

    const enableResponse = await spec()
      .post(buildReferenceModuleLifecyclePath("remotes", "enable"))
      .expectStatus(200);
    expect(enableResponse.body.state).toEqual(
      expect.objectContaining({
        before: "disabled",
        after: "enabled"
      })
    );

    const runtimeAfterEnable = await spec()
      .get("/api/reference/modules/runtime")
      .expectStatus(200);
    expect(runtimeAfterEnable.body.runtime.activeRegisteredServiceIds).toContain(
      "remote-deploy-connector"
    );
    expect(runtimeAfterEnable.body.runtime.activeRegisteredMissionIds).toContain(
      "remote-deploy-mission"
    );
  });

  test("articles runtime capabilities toggle active maps by lifecycle and keep settings readable when disabled", async () => {
    const disableResponse = await spec()
      .post(buildReferenceModuleLifecyclePath("articles", "disable"))
      .expectStatus(200);
    expect(disableResponse.body.state).toEqual(
      expect.objectContaining({
        before: "enabled",
        after: "disabled"
      })
    );

    try {
      const runtimeAfterDisable = await spec()
        .get("/api/reference/modules/runtime")
        .expectStatus(200);
      expect(runtimeAfterDisable.body.runtime.registeredServiceIds).toContain(
        "articles-index-service"
      );
      expect(runtimeAfterDisable.body.runtime.activeRegisteredServiceIds).not.toContain(
        "articles-index-service"
      );
      expect(runtimeAfterDisable.body.runtime.moduleCollectionIds).toContain("articles");
      expect(runtimeAfterDisable.body.runtime.activeCollectionIds).not.toContain("articles");
      expect(runtimeAfterDisable.body.runtime.collectionRepositoryPolicyMap).toEqual(
        expect.objectContaining({
          articles: expect.objectContaining({
            configuredMode: "auto",
            runtimeMode: "memory",
            source: "default",
            stateFilePath: null
          })
        })
      );
      expect(
        runtimeAfterDisable.body.runtime.activeCollectionRepositoryPolicyMap
      ).not.toHaveProperty("articles");
      const settingsOwnerKey = hasOwnKey(
        runtimeAfterDisable.body.runtime.settingsRepositoryModuleMap,
        ARTICLE_MODULE_ID_CANDIDATES[0]
      )
        ? ARTICLE_MODULE_ID_CANDIDATES[0]
        : ARTICLE_MODULE_ID_CANDIDATES.find((candidate) =>
            hasOwnKey(runtimeAfterDisable.body.runtime.settingsRepositoryModuleMap, candidate)
          );
      expect(settingsOwnerKey).toBeTruthy();
      const settingsRepositoryId =
        runtimeAfterDisable.body.runtime.settingsRepositoryModuleMap[settingsOwnerKey];
      expect(typeof settingsRepositoryId).toBe("string");
      expect(settingsRepositoryId.startsWith(`${settingsOwnerKey}-`)).toBe(true);
      expect(settingsRepositoryId.endsWith("-persistence")).toBe(true);
      expect(runtimeAfterDisable.body.runtime.settingsRepositoryModuleMap).toEqual(
        expect.objectContaining({
          [settingsOwnerKey]: settingsRepositoryId
        })
      );
      expect(runtimeAfterDisable.body.runtime.activeSettingsRepositoryModuleMap).not.toHaveProperty(
        settingsOwnerKey
      );
      expect(runtimeAfterDisable.body.runtime.moduleSettingsIds).toContain(settingsOwnerKey);
      expect(runtimeAfterDisable.body.runtime.activeModuleSettingsIds).not.toContain(
        settingsOwnerKey
      );
      expect(runtimeAfterDisable.body.runtime.settingsRepositoryPolicyMap).toEqual(
        expect.objectContaining({
          [settingsOwnerKey]: expect.objectContaining({
            configuredMode: "auto",
            runtimeMode: "disabled",
            source: "reference-state-persistence",
            stateFilePath: null
          })
        })
      );
      expect(
        runtimeAfterDisable.body.runtime.activeSettingsRepositoryPolicyMap
      ).not.toHaveProperty(settingsOwnerKey);

      const settingsReadWhileDisabled = await spec()
        .get(buildReferenceModuleSettingsPath("articles"))
        .expectStatus(200);
      expect(settingsReadWhileDisabled.body.ok).toBe(true);
      expect(settingsReadWhileDisabled.body.state).toBe("disabled");
    } finally {
      await spec()
        .post(buildReferenceModuleLifecyclePath("articles", "enable"))
        .expectStatus(200);
    }

    const runtimeAfterEnable = await spec()
      .get("/api/reference/modules/runtime")
      .expectStatus(200);
    expect(runtimeAfterEnable.body.runtime.activeRegisteredServiceIds).toContain(
      "articles-index-service"
    );
    expect(runtimeAfterEnable.body.runtime.activeCollectionIds).toContain("articles");
    expect(runtimeAfterEnable.body.runtime.activeCollectionRepositoryPolicyMap).toEqual(
      expect.objectContaining({
        articles: expect.objectContaining({
          configuredMode: "auto",
          runtimeMode: "memory",
          source: "default",
          stateFilePath: null
        })
      })
    );
    const activeSettingsOwnerKey = hasOwnKey(
      runtimeAfterEnable.body.runtime.activeSettingsRepositoryModuleMap,
      ARTICLE_MODULE_ID_CANDIDATES[0]
    )
      ? ARTICLE_MODULE_ID_CANDIDATES[0]
      : ARTICLE_MODULE_ID_CANDIDATES.find((candidate) =>
          hasOwnKey(runtimeAfterEnable.body.runtime.activeSettingsRepositoryModuleMap, candidate)
        );
    expect(activeSettingsOwnerKey).toBeTruthy();
    const activeSettingsRepositoryId =
      runtimeAfterEnable.body.runtime.activeSettingsRepositoryModuleMap[activeSettingsOwnerKey];
    expect(typeof activeSettingsRepositoryId).toBe("string");
    expect(activeSettingsRepositoryId.startsWith(`${activeSettingsOwnerKey}-`)).toBe(true);
    expect(activeSettingsRepositoryId.endsWith("-persistence")).toBe(true);
    expect(runtimeAfterEnable.body.runtime.activeSettingsRepositoryModuleMap).toEqual(
      expect.objectContaining({
        [activeSettingsOwnerKey]: activeSettingsRepositoryId
      })
    );
    expect(runtimeAfterEnable.body.runtime.activeSettingsRepositoryPolicyMap).toEqual(
      expect.objectContaining({
        [activeSettingsOwnerKey]: expect.objectContaining({
          configuredMode: "auto",
          runtimeMode: "disabled",
          source: "reference-state-persistence",
          stateFilePath: null
        })
      })
    );
    expect(runtimeAfterEnable.body.runtime.activeModuleSettingsIds).toContain(
      activeSettingsOwnerKey
    );
  });
}


registerReferenceSliceSuiteWithServer(registerReferenceSliceRuntimeLifecycleMissionAndLifecycleSuite);

