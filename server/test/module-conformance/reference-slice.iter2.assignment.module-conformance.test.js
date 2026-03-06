import { registerReferenceSliceSuiteWithServer } from './helpers/reference-slice-suite-host.js';
import { expect, test } from "vitest";
import {
  buildReferenceModuleLifecyclePath,
  buildReferenceModuleSettingsPath,
  createEphemeralReferenceServer,
  injectJson,
  resolveReferenceModuleId,
  waitForMissionJob
} from "./helpers/reference-slice-runtime-test-helpers.js";

function sortedIds(items = []) {
  return [...items]
    .map((item) => item?.id)
    .filter((id) => typeof id === "string" && id.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function resolveRemoteOption(workspacePayload) {
  const remotes = workspacePayload?.referenceOptions?.remotes?.items ?? [];
  const firstRemote = remotes.find(
    (remote) => remote && typeof remote.id === "string" && remote.id.length > 0
  );

  return firstRemote ?? null;
}

function hasReleasePlanRouteAction(actions = [], gateId) {
  return actions.some((action) => {
    if (!action || typeof action !== "object" || action.type !== "navigate") {
      return false;
    }

    const route = action.route;
    if (!route || typeof route !== "object") {
      return false;
    }

    return (
      route.state &&
      route.state.collectionId === "iter2-release-plans" &&
      route.state.gateId === gateId
    );
  });
}

async function runIter2Scenario() {
  const ephemeral = await createEphemeralReferenceServer();

  try {
    const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
    expect(runtimeResponse.statusCode).toBe(200);
    expect(runtimeResponse.body.ok).toBe(true);
    const runtimeItems = runtimeResponse.body.runtime?.items ?? [];
    const runtimeModuleMap = new Map(runtimeItems.map((item) => [item.id, item]));

    const requiredModuleIds = [
      "iter2-release-plans",
      "iter2-environments",
      "iter2-gates",
      "iter2-executions"
    ].map((moduleId) => resolveReferenceModuleId(moduleId));
    for (const moduleId of requiredModuleIds) {
      expect(runtimeModuleMap.has(moduleId)).toBe(true);
      expect(runtimeModuleMap.get(moduleId)?.state).toBe("enabled");
    }

    const settingsRead = await injectJson(
      ephemeral,
      "GET",
      buildReferenceModuleSettingsPath("iter2-release-plans")
    );
    expect(settingsRead.statusCode).toBe(200);
    expect(settingsRead.body.ok).toBe(true);
    expect(settingsRead.body.settings.values.slugMaxLength).toBe(48);
    expect(settingsRead.body.settings.values.gateDeletePolicy).toBe("restrict");

    const settingsUpdate = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter2-release-plans"),
      {
        slugMaxLength: 12,
        gateDeletePolicy: "restrict"
      }
    );
    expect(settingsUpdate.statusCode).toBe(200);
    expect(settingsUpdate.body.ok).toBe(true);
    expect(settingsUpdate.body.settings.values.slugMaxLength).toBe(12);
    expect(settingsUpdate.body.settings.values.gateDeletePolicy).toBe("restrict");

    const authorCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/authors/items",
      {
        title: "Iter2 Owner",
        status: "review",
        category: "ops"
      }
    );
    expect(authorCreate.statusCode).toBe(201);
    const ownerAuthorId = authorCreate.body.item.id;

    const environmentCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter2-environments/items",
      {
        label: "Production US East",
        tier: "production",
        region: "us-east-1"
      }
    );
    expect(environmentCreate.statusCode).toBe(201);
    const environmentId = environmentCreate.body.item.id;

    const gateParentCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter2-gates/items",
      {
        label: "Security Parent",
        gateType: "approval",
        parentGateId: null,
        status: "pending"
      }
    );
    expect(gateParentCreate.statusCode).toBe(201);
    const gateParentId = gateParentCreate.body.item.id;

    const gateOneCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter2-gates/items",
      {
        label: "Security Child One",
        gateType: "approval",
        parentGateId: gateParentId,
        status: "pending"
      }
    );
    expect(gateOneCreate.statusCode).toBe(201);
    const gateOneId = gateOneCreate.body.item.id;

    const gateTwoCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter2-gates/items",
      {
        label: "Security Child Two",
        gateType: "approval",
        parentGateId: gateParentId,
        status: "pending"
      }
    );
    expect(gateTwoCreate.statusCode).toBe(201);
    const gateTwoId = gateTwoCreate.body.item.id;

    const releasePlanCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter2-release-plans/items",
      {
        title: "Iteration Two Release Plan",
        ownerAuthorId,
        environmentId,
        gateIds: [gateOneId, gateTwoId],
        status: "approved"
      }
    );
    expect(releasePlanCreate.statusCode).toBe(201);
    expect(releasePlanCreate.body.item.slug.length).toBeLessThanOrEqual(12);
    const releasePlanId = releasePlanCreate.body.item.id;

    const executionsWorkspace = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter2-executions/workspace"
    );
    expect(executionsWorkspace.statusCode).toBe(200);
    expect(executionsWorkspace.body.ok).toBe(true);
    expect(executionsWorkspace.body.referenceOptions?.remotes?.errorMessage).toBeNull();
    const remoteOption = resolveRemoteOption(executionsWorkspace.body);
    expect(remoteOption).toBeTruthy();
    expect(typeof remoteOption.label).toBe("string");
    const executionRemoteId = remoteOption.id;

    const executionCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter2-executions/items",
      {
        title: "Execution One",
        releasePlanId,
        remoteId: executionRemoteId,
        state: "queued",
        jobId: null
      }
    );
    expect(executionCreate.statusCode).toBe(201);
    expect(executionCreate.body.item.releasePlanId).toBe(releasePlanId);
    expect(executionCreate.body.item.remoteId).toBe(executionRemoteId);
    expect(executionCreate.body.item.releasePlanTitle).toBe("Iteration Two Release Plan");
    const executionId = executionCreate.body.item.id;

    const missionsRead = await injectJson(ephemeral, "GET", "/api/reference/missions");
    expect(missionsRead.statusCode).toBe(200);
    expect(missionsRead.body.ok).toBe(true);
    expect(
      (missionsRead.body.items ?? []).some(
        (mission) => mission?.missionId === "iter2-execution-mission"
      )
    ).toBe(true);

    const missionJobCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/missions/iter2-execution-mission/jobs",
      {
        executionId,
        releasePlanId,
        remoteId: executionRemoteId,
        shouldFail: false
      }
    );
    expect(missionJobCreate.statusCode).toBe(202);
    expect(missionJobCreate.body.ok).toBe(true);
    const missionJobId = missionJobCreate.body.job.id;

    const missionJob = await waitForMissionJob(ephemeral, missionJobId);
    expect(missionJob.status).toBe("succeeded");

    const executionUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter2-executions/items/${executionId}`,
      {
        title: "Execution One",
        releasePlanId,
        remoteId: executionRemoteId,
        state: "succeeded",
        jobId: missionJobId
      }
    );
    expect(executionUpdate.statusCode).toBe(200);
    expect(executionUpdate.body.ok).toBe(true);

    const restrictDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter2-gates/items/${gateOneId}`
    );
    expect(restrictDelete.statusCode).toBe(409);
    expect(restrictDelete.body.ok).toBe(false);
    expect(restrictDelete.body.error.code).toBe("REFERENCE_DELETE_RESTRICTED");
    expect(
      hasReleasePlanRouteAction(restrictDelete.body.error.actions ?? [], gateOneId)
    ).toBe(true);

    const policySwitch = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter2-release-plans"),
      {
        gateDeletePolicy: "nullify"
      }
    );
    expect(policySwitch.statusCode).toBe(200);
    expect(policySwitch.body.ok).toBe(true);
    expect(policySwitch.body.settings.values.gateDeletePolicy).toBe("nullify");

    const nullifyDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter2-gates/items/${gateTwoId}`
    );
    expect(nullifyDelete.statusCode).toBe(200);
    expect(nullifyDelete.body.ok).toBe(true);
    expect(nullifyDelete.body.cleanup.policy).toBe("nullify");

    const releasePlanAfterNullify = await injectJson(
      ephemeral,
      "GET",
      `/api/reference/collections/iter2-release-plans/items/${releasePlanId}`
    );
    expect(releasePlanAfterNullify.statusCode).toBe(200);
    expect(releasePlanAfterNullify.body.ok).toBe(true);
    expect(releasePlanAfterNullify.body.item.gateIds).toEqual([gateOneId]);

    const disableResponse = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter2-executions", "disable")
    );
    expect(disableResponse.statusCode).toBe(200);
    expect(disableResponse.body.ok).toBe(true);
    expect(disableResponse.body.state.after).toBe("disabled");

    const collectionsAfterDisable = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections"
    );
    expect(collectionsAfterDisable.statusCode).toBe(200);
    expect(collectionsAfterDisable.body.ok).toBe(true);
    expect(
      (collectionsAfterDisable.body.items ?? []).some(
        (collection) => collection?.id === "iter2-executions"
      )
    ).toBe(false);

    const enableResponse = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter2-executions", "enable")
    );
    expect(enableResponse.statusCode).toBe(200);
    expect(enableResponse.body.ok).toBe(true);
    expect(enableResponse.body.state.after).toBe("enabled");

    const collectionsAfterEnable = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections"
    );
    expect(collectionsAfterEnable.statusCode).toBe(200);
    expect(collectionsAfterEnable.body.ok).toBe(true);
    expect(
      (collectionsAfterEnable.body.items ?? []).some(
        (collection) => collection?.id === "iter2-executions"
      )
    ).toBe(true);

    return {
      collectionIds: sortedIds(collectionsAfterEnable.body.items),
      releasePlanSlug: releasePlanCreate.body.item.slug,
      executionRemoteId,
      missionJobType: missionJob.type,
      missionJobStatus: missionJob.status,
      restrictCode: restrictDelete.body.error.code,
      nullifyPolicy: nullifyDelete.body.cleanup.policy,
      gateIdsAfterNullify: [...(releasePlanAfterNullify.body.item.gateIds ?? [])],
      disableState: disableResponse.body.state.after,
      enableState: enableResponse.body.state.after
    };
  } finally {
    await ephemeral.close();
  }
}

export function registerReferenceSliceIter2AssignmentSuite() {
  test(
    "iter2 assignment flow replays deterministically x3 with stable outcomes",
    async () => {
      const snapshots = [];
      for (let runIndex = 0; runIndex < 3; runIndex += 1) {
        snapshots.push(await runIter2Scenario());
      }

      expect(snapshots[1]).toEqual(snapshots[0]);
      expect(snapshots[2]).toEqual(snapshots[0]);
    },
    60_000
  );
}


registerReferenceSliceSuiteWithServer(registerReferenceSliceIter2AssignmentSuite);
