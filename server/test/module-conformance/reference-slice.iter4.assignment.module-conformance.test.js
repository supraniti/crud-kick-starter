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

const ITER4_DISPATCH_RUNS_MODULE_ID = resolveReferenceModuleId("iter4-dispatch-runs");

function sortedIds(items = []) {
  return [...items]
    .map((item) => item?.id)
    .filter((id) => typeof id === "string" && id.length > 0)
    .sort((left, right) => left.localeCompare(right));
}

function findReferenceOption(options = [], predicate) {
  if (!Array.isArray(options)) {
    return null;
  }

  for (const option of options) {
    if (!option || typeof option !== "object") {
      continue;
    }
    if (predicate(option)) {
      return option;
    }
  }

  return null;
}

function hasIncidentRouteAction(actions = [], dispatchRunId) {
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
      route.state.collectionId === "iter4-incidents" &&
      route.state.dispatchRunId === dispatchRunId
    );
  });
}

function conflictFieldIds(payload) {
  const conflicts = payload?.error?.conflicts;
  if (!Array.isArray(conflicts)) {
    return [];
  }

  return conflicts.map((conflict) => conflict?.fieldId ?? "");
}

async function runIter4Scenario() {
  const ephemeral = await createEphemeralReferenceServer();

  try {
    const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
    expect(runtimeResponse.statusCode).toBe(200);
    expect(runtimeResponse.body.ok).toBe(true);
    expect(runtimeResponse.body.runtime.ok).toBe(true);

    const runtimeItems = runtimeResponse.body.runtime?.items ?? [];
    const runtimeModuleMap = new Map(runtimeItems.map((item) => [item.id, item]));
    const requiredModuleIds = [
      "iter4-response-plans",
      "iter4-response-windows",
      "iter4-dispatch-runs",
      "iter4-incidents"
    ].map((moduleId) => resolveReferenceModuleId(moduleId));
    for (const moduleId of requiredModuleIds) {
      expect(runtimeModuleMap.has(moduleId)).toBe(true);
      expect(runtimeModuleMap.get(moduleId)?.state).toBe("enabled");
    }

    const dispatchRouteView = runtimeModuleMap.get(ITER4_DISPATCH_RUNS_MODULE_ID)?.ui?.routeView;
    expect(["custom", "collections"]).toContain(dispatchRouteView?.kind ?? "");
    if (dispatchRouteView?.kind === "custom") {
      expect(Array.isArray(dispatchRouteView?.actions)).toBe(true);
      expect(
        (dispatchRouteView.actions ?? []).some(
          (action) => action?.id === "iter4-focus-ready" && action?.type === "module:filters"
        )
      ).toBe(true);
    }

    const responsePlanSettingsRead = await injectJson(
      ephemeral,
      "GET",
      buildReferenceModuleSettingsPath("iter4-response-plans")
    );
    expect(responsePlanSettingsRead.statusCode).toBe(200);
    expect(responsePlanSettingsRead.body.ok).toBe(true);
    expect(Number.isInteger(responsePlanSettingsRead.body.settings.values.slugMaxLength)).toBe(
      true
    );
    expect(responsePlanSettingsRead.body.settings.values.slugMaxLength).toBeGreaterThanOrEqual(8);

    const responsePlanSettingsUpdateShort = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter4-response-plans"),
      {
        slugMaxLength: 12,
        incidentDeletePolicy: "restrict",
        defaultDispatchStatus: "draft"
      }
    );
    expect(responsePlanSettingsUpdateShort.statusCode).toBe(200);
    expect(responsePlanSettingsUpdateShort.body.ok).toBe(true);
    expect(responsePlanSettingsUpdateShort.body.settings.values.slugMaxLength).toBe(12);

    const incidentSettingsSeed = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter4-incidents"),
      {
        incidentDeletePolicy: "restrict"
      }
    );
    expect(incidentSettingsSeed.statusCode).toBe(200);
    expect(incidentSettingsSeed.body.ok).toBe(true);

    const authorCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/authors/items",
      {
        title: "Iter4 Author Owner",
        status: "review",
        category: "ops"
      }
    );
    expect(authorCreate.statusCode).toBe(201);
    const ownerAuthorId = authorCreate.body.item.id;

    const parentWindowCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter4-response-windows/items",
      {
        label: "Primary Parent Window",
        parentWindowId: null,
        kind: "containment",
        status: "active"
      }
    );
    expect(parentWindowCreate.statusCode).toBe(201);
    const parentWindowId = parentWindowCreate.body.item.id;

    const childWindowCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter4-response-windows/items",
      {
        label: "Primary Child Window",
        parentWindowId,
        kind: "investigation",
        status: "draft"
      }
    );
    expect(childWindowCreate.statusCode).toBe(201);
    const childWindowId = childWindowCreate.body.item.id;

    const childWindowUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter4-response-windows/items/${childWindowId}`,
      {
        label: "Primary Child Window",
        parentWindowId,
        kind: "investigation",
        status: "active"
      }
    );
    expect(childWindowUpdate.statusCode).toBe(200);
    expect(childWindowUpdate.body.ok).toBe(true);

    const responsePlanCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter4-response-plans/items",
      {
        title: "Iteration Four Primary Response Plan",
        ownerAuthorId,
        windowIds: [childWindowId],
        status: "ready"
      }
    );
    expect(responsePlanCreate.statusCode).toBe(201);
    const initialSlug = responsePlanCreate.body.item.slug;
    expect(initialSlug.length).toBeLessThanOrEqual(12);
    const responsePlanId = responsePlanCreate.body.item.id;

    const responsePlanSettingsUpdateLong = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter4-response-plans"),
      {
        slugMaxLength: 24,
        incidentDeletePolicy: "restrict",
        defaultDispatchStatus: "ready"
      }
    );
    expect(responsePlanSettingsUpdateLong.statusCode).toBe(200);
    expect(responsePlanSettingsUpdateLong.body.ok).toBe(true);
    expect(responsePlanSettingsUpdateLong.body.settings.values.slugMaxLength).toBe(24);

    const responsePlanUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter4-response-plans/items/${responsePlanId}`,
      {
        title: "Iteration Four Primary Response Plan Extended",
        ownerAuthorId,
        windowIds: [childWindowId],
        status: "ready"
      }
    );
    expect(responsePlanUpdate.statusCode).toBe(200);
    expect(responsePlanUpdate.body.ok).toBe(true);
    const updatedSlug = responsePlanUpdate.body.item.slug;
    expect(updatedSlug.length).toBeLessThanOrEqual(24);
    expect(updatedSlug.length).toBeGreaterThan(initialSlug.length);

    const dispatchWorkspace = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter4-dispatch-runs/workspace"
    );
    expect(dispatchWorkspace.statusCode).toBe(200);
    expect(dispatchWorkspace.body.ok).toBe(true);
    expect(dispatchWorkspace.body.referenceOptions?.remotes?.errorMessage).toBeNull();
    expect(dispatchWorkspace.body.referenceOptions?.missions?.errorMessage).toBeNull();

    const remoteOption = findReferenceOption(
      dispatchWorkspace.body.referenceOptions?.remotes?.items ?? [],
      (item) => typeof item?.id === "string" && item.id.length > 0
    );
    expect(remoteOption).toBeTruthy();

    const missionOption = findReferenceOption(
      dispatchWorkspace.body.referenceOptions?.missions?.items ?? [],
      (item) => item?.id === "iter4-dispatch-run-mission"
    );
    expect(missionOption).toBeTruthy();

    const dispatchRunCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter4-dispatch-runs/items",
      {
        title: "Iter4 Dispatch Run One",
        responsePlanId,
        remoteId: remoteOption.id,
        missionId: missionOption.id,
        status: "ready",
        jobId: null
      }
    );
    expect(dispatchRunCreate.statusCode).toBe(201);
    expect(dispatchRunCreate.body.item.responsePlanId).toBe(responsePlanId);
    expect(dispatchRunCreate.body.item.remoteId).toBe(remoteOption.id);
    expect(dispatchRunCreate.body.item.missionId).toBe(missionOption.id);
    expect(dispatchRunCreate.body.item.responsePlanTitle).toBe(
      "Iteration Four Primary Response Plan Extended"
    );
    expect(typeof dispatchRunCreate.body.item.remoteTitle).toBe("string");
    expect(typeof dispatchRunCreate.body.item.missionTitle).toBe("string");
    const dispatchRunId = dispatchRunCreate.body.item.id;

    const dispatchRunRead = await injectJson(
      ephemeral,
      "GET",
      `/api/reference/collections/iter4-dispatch-runs/items/${dispatchRunId}`
    );
    expect(dispatchRunRead.statusCode).toBe(200);
    expect(dispatchRunRead.body.ok).toBe(true);
    expect(dispatchRunRead.body.item.id).toBe(dispatchRunId);

    const statusFilterBeforeLifecycleChurn = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter4-dispatch-runs/items?status=ready"
    );
    expect(statusFilterBeforeLifecycleChurn.statusCode).toBe(200);
    expect(statusFilterBeforeLifecycleChurn.body.ok).toBe(true);
    expect(statusFilterBeforeLifecycleChurn.body.filters.status).toBe("ready");
    expect(
      sortedIds(statusFilterBeforeLifecycleChurn.body.items).includes(dispatchRunId)
    ).toBe(true);

    const missionJobCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/missions/iter4-dispatch-run-mission/jobs",
      {
        dispatchRunId,
        responsePlanId,
        remoteId: remoteOption.id,
        missionId: missionOption.id,
        shouldFail: false
      }
    );
    expect(missionJobCreate.statusCode).toBe(202);
    expect(missionJobCreate.body.ok).toBe(true);
    const missionJobId = missionJobCreate.body.job.id;

    const missionJob = await waitForMissionJob(ephemeral, missionJobId);
    expect(missionJob.status).toBe("succeeded");
    expect(missionJob.type).toBe("mission:iter4-dispatch-run-mission");

    const dispatchRunUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter4-dispatch-runs/items/${dispatchRunId}`,
      {
        title: "Iter4 Dispatch Run One",
        responsePlanId,
        remoteId: remoteOption.id,
        missionId: missionOption.id,
        status: "succeeded",
        jobId: missionJobId
      }
    );
    expect(dispatchRunUpdate.statusCode).toBe(200);
    expect(dispatchRunUpdate.body.ok).toBe(true);

    const statusFilterAfterMission = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter4-dispatch-runs/items?status=succeeded"
    );
    expect(statusFilterAfterMission.statusCode).toBe(200);
    expect(statusFilterAfterMission.body.ok).toBe(true);
    expect(statusFilterAfterMission.body.filters.status).toBe("succeeded");
    expect(sortedIds(statusFilterAfterMission.body.items)).toEqual([dispatchRunId]);

    const incidentCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter4-incidents/items",
      {
        title: "Iter4 Incident One",
        dispatchRunId,
        relatedMissionIds: [missionOption.id],
        severity: "high",
        status: "open"
      }
    );
    expect(incidentCreate.statusCode).toBe(201);
    const incidentId = incidentCreate.body.item.id;

    const incidentUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter4-incidents/items/${incidentId}`,
      {
        title: "Iter4 Incident One",
        dispatchRunId,
        relatedMissionIds: [missionOption.id],
        severity: "high",
        status: "investigating"
      }
    );
    expect(incidentUpdate.statusCode).toBe(200);
    expect(incidentUpdate.body.ok).toBe(true);

    const mixedInvalidIncident = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter4-incidents/items",
      {
        title: "Iter4 Mixed Invalid Incident",
        dispatchRunId: "i4d-missing",
        relatedMissionIds: ["missing-mission-id"],
        severity: "medium",
        status: "open"
      }
    );
    expect(mixedInvalidIncident.statusCode).toBe(400);
    expect(mixedInvalidIncident.body.ok).toBe(false);
    expect(Array.isArray(mixedInvalidIncident.body.error.conflicts)).toBe(true);
    expect(conflictFieldIds(mixedInvalidIncident.body)).toEqual([
      "dispatchRunId",
      "relatedMissionIds"
    ]);
    expect(mixedInvalidIncident.body.error.conflicts.map((entry) => entry.order)).toEqual([
      0,
      1
    ]);

    const statusFilterAfterLifecycleChurn = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter4-dispatch-runs/items?status=succeeded"
    );
    expect(statusFilterAfterLifecycleChurn.statusCode).toBe(200);
    expect(statusFilterAfterLifecycleChurn.body.ok).toBe(true);
    expect(statusFilterAfterLifecycleChurn.body.filters.status).toBe("succeeded");
    expect(sortedIds(statusFilterAfterLifecycleChurn.body.items)).toEqual([dispatchRunId]);

    const restrictDeleteDispatchRun = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter4-dispatch-runs/items/${dispatchRunId}`
    );
    expect(restrictDeleteDispatchRun.statusCode).toBe(409);
    expect(restrictDeleteDispatchRun.body.ok).toBe(false);
    expect(restrictDeleteDispatchRun.body.error.code).toBe("REFERENCE_DELETE_RESTRICTED");
    expect(
      hasIncidentRouteAction(restrictDeleteDispatchRun.body.error.actions ?? [], dispatchRunId)
    ).toBe(true);

    const incidentPolicySwitch = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter4-incidents"),
      {
        incidentDeletePolicy: "nullify"
      }
    );
    expect(incidentPolicySwitch.statusCode).toBe(200);
    expect(incidentPolicySwitch.body.ok).toBe(true);
    expect(incidentPolicySwitch.body.settings.values.incidentDeletePolicy).toBe("nullify");

    const nullifyDeleteDispatchRun = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter4-dispatch-runs/items/${dispatchRunId}`
    );
    expect(nullifyDeleteDispatchRun.statusCode).toBe(200);
    expect(nullifyDeleteDispatchRun.body.ok).toBe(true);
    expect(nullifyDeleteDispatchRun.body.cleanup.policy).toBe("nullify");

    const incidentAfterNullify = await injectJson(
      ephemeral,
      "GET",
      `/api/reference/collections/iter4-incidents/items/${incidentId}`
    );
    expect(incidentAfterNullify.statusCode).toBe(200);
    expect(incidentAfterNullify.body.ok).toBe(true);
    expect(incidentAfterNullify.body.item.dispatchRunId).toBe(null);

    const incidentDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter4-incidents/items/${incidentId}`
    );
    expect(incidentDelete.statusCode).toBe(200);
    expect(incidentDelete.body.ok).toBe(true);

    const responsePlanDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter4-response-plans/items/${responsePlanId}`
    );
    expect(responsePlanDelete.statusCode).toBe(200);
    expect(responsePlanDelete.body.ok).toBe(true);

    const childWindowDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter4-response-windows/items/${childWindowId}`
    );
    expect(childWindowDelete.statusCode).toBe(200);
    expect(childWindowDelete.body.ok).toBe(true);

    const parentWindowDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter4-response-windows/items/${parentWindowId}`
    );
    expect(parentWindowDelete.statusCode).toBe(200);
    expect(parentWindowDelete.body.ok).toBe(true);

    const disableDispatchRuns = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter4-dispatch-runs", "disable")
    );
    expect(disableDispatchRuns.statusCode).toBe(200);
    expect(disableDispatchRuns.body.ok).toBe(true);
    expect(disableDispatchRuns.body.state.after).toBe("disabled");

    const collectionsAfterDisable = await injectJson(ephemeral, "GET", "/api/reference/collections");
    expect(collectionsAfterDisable.statusCode).toBe(200);
    expect(collectionsAfterDisable.body.ok).toBe(true);
    expect(
      (collectionsAfterDisable.body.items ?? []).some(
        (collection) => collection?.id === "iter4-dispatch-runs"
      )
    ).toBe(false);

    const enableDispatchRuns = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter4-dispatch-runs", "enable")
    );
    expect(enableDispatchRuns.statusCode).toBe(200);
    expect(enableDispatchRuns.body.ok).toBe(true);
    expect(enableDispatchRuns.body.state.after).toBe("enabled");

    const collectionsAfterEnable = await injectJson(ephemeral, "GET", "/api/reference/collections");
    expect(collectionsAfterEnable.statusCode).toBe(200);
    expect(collectionsAfterEnable.body.ok).toBe(true);
    expect(
      (collectionsAfterEnable.body.items ?? []).some(
        (collection) => collection?.id === "iter4-dispatch-runs"
      )
    ).toBe(true);

    return {
      collectionIds: sortedIds(collectionsAfterEnable.body.items),
      slugLengths: {
        initial: initialSlug.length,
        updated: updatedSlug.length
      },
      referenceOptions: {
        remoteOptionId: remoteOption.id,
        missionOptionId: missionOption.id
      },
      missionJob: {
        id: missionJobId,
        type: missionJob.type,
        status: missionJob.status
      },
      conflictEnvelope: {
        fieldIds: conflictFieldIds(mixedInvalidIncident.body),
        orders: mixedInvalidIncident.body.error.conflicts.map((entry) => entry.order)
      },
      filters: {
        beforeLifecycleChurn: sortedIds(statusFilterBeforeLifecycleChurn.body.items),
        afterLifecycleChurn: sortedIds(statusFilterAfterLifecycleChurn.body.items)
      },
      deletePolicies: {
        restrictCode: restrictDeleteDispatchRun.body.error.code,
        nullifyPolicy: nullifyDeleteDispatchRun.body.cleanup.policy,
        incidentDispatchRunIdAfterNullify: incidentAfterNullify.body.item.dispatchRunId
      },
      lifecycle: {
        dispatchRuns: {
          disableState: disableDispatchRuns.body.state.after,
          enableState: enableDispatchRuns.body.state.after
        }
      }
    };
  } finally {
    await ephemeral.close();
  }
}

export function registerReferenceSliceIter4AssignmentSuite() {
  test(
    "iter4 assignment flow replays deterministically x3 with shared row parity",
    async () => {
      const snapshots = [];
      for (let runIndex = 0; runIndex < 3; runIndex += 1) {
        snapshots.push(await runIter4Scenario());
      }

      expect(snapshots[1]).toEqual(snapshots[0]);
      expect(snapshots[2]).toEqual(snapshots[0]);
    },
    60_000
  );
}


registerReferenceSliceSuiteWithServer(registerReferenceSliceIter4AssignmentSuite);
