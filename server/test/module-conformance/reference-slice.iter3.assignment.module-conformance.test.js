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

const ITER3_DRILL_RUNS_MODULE_ID = resolveReferenceModuleId("iter3-drill-runs");

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

function hasIncidentRouteAction(actions = [], drillRunId) {
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
      route.state.collectionId === "iter3-incidents" &&
      route.state.drillRunId === drillRunId
    );
  });
}

async function runIter3Scenario() {
  const ephemeral = await createEphemeralReferenceServer();

  try {
    const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
    expect(runtimeResponse.statusCode).toBe(200);
    expect(runtimeResponse.body.ok).toBe(true);
    expect(runtimeResponse.body.runtime.ok).toBe(true);

    const runtimeItems = runtimeResponse.body.runtime?.items ?? [];
    const runtimeModuleMap = new Map(runtimeItems.map((item) => [item.id, item]));
    const requiredModuleIds = [
      "iter3-drill-plans",
      "iter3-checkpoints",
      "iter3-drill-runs",
      "iter3-incidents"
    ].map((moduleId) => resolveReferenceModuleId(moduleId));
    for (const moduleId of requiredModuleIds) {
      expect(runtimeModuleMap.has(moduleId)).toBe(true);
      expect(runtimeModuleMap.get(moduleId)?.state).toBe("enabled");
    }

    const drillRunsRouteView = runtimeModuleMap.get(ITER3_DRILL_RUNS_MODULE_ID)?.ui?.routeView;
    expect(["custom", "collections"]).toContain(drillRunsRouteView?.kind ?? "");
    if (drillRunsRouteView?.kind === "custom") {
      expect(Array.isArray(drillRunsRouteView?.actions)).toBe(true);
      expect(
        (drillRunsRouteView.actions ?? []).some(
          (action) => action?.id === "iter3-focus-running" && action?.type === "module:filters"
        )
      ).toBe(true);
    }

    const settingsRead = await injectJson(
      ephemeral,
      "GET",
      buildReferenceModuleSettingsPath("iter3-drill-plans")
    );
    expect(settingsRead.statusCode).toBe(200);
    expect(settingsRead.body.ok).toBe(true);
    expect(Number.isInteger(settingsRead.body.settings.values.slugMaxLength)).toBe(true);
    expect(settingsRead.body.settings.values.slugMaxLength).toBeGreaterThanOrEqual(8);

    const settingsUpdateShort = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter3-drill-plans"),
      {
        slugMaxLength: 10,
        incidentDeletePolicy: "restrict"
      }
    );
    expect(settingsUpdateShort.statusCode).toBe(200);
    expect(settingsUpdateShort.body.ok).toBe(true);
    expect(settingsUpdateShort.body.settings.values.slugMaxLength).toBe(10);

    const incidentSettingsSeed = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter3-incidents"),
      {
        incidentDeletePolicy: "restrict"
      }
    );
    expect(incidentSettingsSeed.statusCode).toBe(200);
    expect(incidentSettingsSeed.body.ok).toBe(true);
    expect(incidentSettingsSeed.body.settings.values.incidentDeletePolicy).toBe("restrict");

    const authorCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/authors/items",
      {
        title: "Iter3 Author Owner",
        status: "review",
        category: "ops"
      }
    );
    expect(authorCreate.statusCode).toBe(201);
    const ownerAuthorId = authorCreate.body.item.id;

    const parentCheckpointCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter3-checkpoints/items",
      {
        label: "Primary Parent Checkpoint",
        parentCheckpointId: null,
        kind: "safety",
        status: "pending"
      }
    );
    expect(parentCheckpointCreate.statusCode).toBe(201);
    const parentCheckpointId = parentCheckpointCreate.body.item.id;

    const childCheckpointCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter3-checkpoints/items",
      {
        label: "Primary Child Checkpoint",
        parentCheckpointId,
        kind: "communication",
        status: "pending"
      }
    );
    expect(childCheckpointCreate.statusCode).toBe(201);
    const childCheckpointId = childCheckpointCreate.body.item.id;

    const checkpointUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter3-checkpoints/items/${childCheckpointId}`,
      {
        label: "Primary Child Checkpoint",
        parentCheckpointId,
        kind: "communication",
        status: "ready"
      }
    );
    expect(checkpointUpdate.statusCode).toBe(200);
    expect(checkpointUpdate.body.ok).toBe(true);

    const drillPlanCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter3-drill-plans/items",
      {
        title: "Iteration Three Primary Drill Plan",
        ownerAuthorId,
        checkpointIds: [childCheckpointId],
        status: "active"
      }
    );
    expect(drillPlanCreate.statusCode).toBe(201);
    expect(drillPlanCreate.body.item.slug.length).toBeLessThanOrEqual(10);
    const initialSlug = drillPlanCreate.body.item.slug;
    const drillPlanId = drillPlanCreate.body.item.id;

    const settingsUpdateLong = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter3-drill-plans"),
      {
        slugMaxLength: 18,
        incidentDeletePolicy: "restrict"
      }
    );
    expect(settingsUpdateLong.statusCode).toBe(200);
    expect(settingsUpdateLong.body.ok).toBe(true);
    expect(settingsUpdateLong.body.settings.values.slugMaxLength).toBe(18);

    const drillPlanUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter3-drill-plans/items/${drillPlanId}`,
      {
        title: "Iteration Three Primary Drill Plan Extended",
        ownerAuthorId,
        checkpointIds: [childCheckpointId],
        status: "active"
      }
    );
    expect(drillPlanUpdate.statusCode).toBe(200);
    expect(drillPlanUpdate.body.ok).toBe(true);
    const updatedSlug = drillPlanUpdate.body.item.slug;
    expect(updatedSlug.length).toBeLessThanOrEqual(18);
    expect(updatedSlug.length).toBeGreaterThan(initialSlug.length);

    const drillRunsWorkspace = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter3-drill-runs/workspace"
    );
    expect(drillRunsWorkspace.statusCode).toBe(200);
    expect(drillRunsWorkspace.body.ok).toBe(true);
    expect(drillRunsWorkspace.body.referenceOptions?.remotes?.errorMessage).toBeNull();
    expect(drillRunsWorkspace.body.referenceOptions?.missions?.errorMessage).toBeNull();

    const remoteOption = findReferenceOption(
      drillRunsWorkspace.body.referenceOptions?.remotes?.items ?? [],
      (item) => typeof item.id === "string" && item.id.length > 0
    );
    expect(remoteOption).toBeTruthy();

    const missionOption = findReferenceOption(
      drillRunsWorkspace.body.referenceOptions?.missions?.items ?? [],
      (item) => item?.id === "iter3-drill-run-mission"
    );
    expect(missionOption).toBeTruthy();

    const drillRunCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter3-drill-runs/items",
      {
        title: "Iter3 Drill Run One",
        drillPlanId,
        remoteId: remoteOption.id,
        missionId: missionOption.id,
        state: "queued",
        jobId: null
      }
    );
    expect(drillRunCreate.statusCode).toBe(201);
    expect(drillRunCreate.body.item.drillPlanId).toBe(drillPlanId);
    expect(drillRunCreate.body.item.remoteId).toBe(remoteOption.id);
    expect(drillRunCreate.body.item.missionId).toBe(missionOption.id);
    expect(drillRunCreate.body.item.drillPlanTitle).toBe(
      "Iteration Three Primary Drill Plan Extended"
    );
    expect(typeof drillRunCreate.body.item.remoteTitle).toBe("string");
    expect(typeof drillRunCreate.body.item.missionTitle).toBe("string");
    const drillRunId = drillRunCreate.body.item.id;

    const drillRunRead = await injectJson(
      ephemeral,
      "GET",
      `/api/reference/collections/iter3-drill-runs/items/${drillRunId}`
    );
    expect(drillRunRead.statusCode).toBe(200);
    expect(drillRunRead.body.ok).toBe(true);
    expect(drillRunRead.body.item.id).toBe(drillRunId);

    const drillRunUpdateRunning = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter3-drill-runs/items/${drillRunId}`,
      {
        title: "Iter3 Drill Run One",
        drillPlanId,
        remoteId: remoteOption.id,
        missionId: missionOption.id,
        state: "running",
        jobId: null
      }
    );
    expect(drillRunUpdateRunning.statusCode).toBe(200);
    expect(drillRunUpdateRunning.body.ok).toBe(true);

    const missionJobCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/missions/iter3-drill-run-mission/jobs",
      {
        drillRunId,
        drillPlanId,
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
    expect(missionJob.type).toBe("mission:iter3-drill-run-mission");

    const drillRunUpdateSucceeded = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter3-drill-runs/items/${drillRunId}`,
      {
        title: "Iter3 Drill Run One",
        drillPlanId,
        remoteId: remoteOption.id,
        missionId: missionOption.id,
        state: "succeeded",
        jobId: missionJobId
      }
    );
    expect(drillRunUpdateSucceeded.statusCode).toBe(200);
    expect(drillRunUpdateSucceeded.body.ok).toBe(true);

    const incidentCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter3-incidents/items",
      {
        title: "Iter3 Incident One",
        drillRunId,
        severity: "medium",
        status: "open"
      }
    );
    expect(incidentCreate.statusCode).toBe(201);
    const incidentId = incidentCreate.body.item.id;

    const incidentUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter3-incidents/items/${incidentId}`,
      {
        title: "Iter3 Incident One",
        drillRunId,
        severity: "high",
        status: "investigating"
      }
    );
    expect(incidentUpdate.statusCode).toBe(200);
    expect(incidentUpdate.body.ok).toBe(true);

    const restrictDeleteDrillRun = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter3-drill-runs/items/${drillRunId}`
    );
    expect(restrictDeleteDrillRun.statusCode).toBe(409);
    expect(restrictDeleteDrillRun.body.ok).toBe(false);
    expect(restrictDeleteDrillRun.body.error.code).toBe("REFERENCE_DELETE_RESTRICTED");
    expect(
      hasIncidentRouteAction(restrictDeleteDrillRun.body.error.actions ?? [], drillRunId)
    ).toBe(true);

    const incidentPolicySwitch = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter3-incidents"),
      {
        incidentDeletePolicy: "nullify"
      }
    );
    expect(incidentPolicySwitch.statusCode).toBe(200);
    expect(incidentPolicySwitch.body.ok).toBe(true);
    expect(incidentPolicySwitch.body.settings.values.incidentDeletePolicy).toBe("nullify");

    const nullifyDeleteDrillRun = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter3-drill-runs/items/${drillRunId}`
    );
    expect(nullifyDeleteDrillRun.statusCode).toBe(200);
    expect(nullifyDeleteDrillRun.body.ok).toBe(true);
    expect(nullifyDeleteDrillRun.body.cleanup.policy).toBe("nullify");

    const incidentAfterNullify = await injectJson(
      ephemeral,
      "GET",
      `/api/reference/collections/iter3-incidents/items/${incidentId}`
    );
    expect(incidentAfterNullify.statusCode).toBe(200);
    expect(incidentAfterNullify.body.ok).toBe(true);
    expect(incidentAfterNullify.body.item.drillRunId).toBe(null);

    const incidentDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter3-incidents/items/${incidentId}`
    );
    expect(incidentDelete.statusCode).toBe(200);
    expect(incidentDelete.body.ok).toBe(true);

    const drillPlanDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter3-drill-plans/items/${drillPlanId}`
    );
    expect(drillPlanDelete.statusCode).toBe(200);
    expect(drillPlanDelete.body.ok).toBe(true);

    const checkpointChildDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter3-checkpoints/items/${childCheckpointId}`
    );
    expect(checkpointChildDelete.statusCode).toBe(200);
    expect(checkpointChildDelete.body.ok).toBe(true);

    const checkpointParentDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter3-checkpoints/items/${parentCheckpointId}`
    );
    expect(checkpointParentDelete.statusCode).toBe(200);
    expect(checkpointParentDelete.body.ok).toBe(true);

    const disableDrillRuns = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter3-drill-runs", "disable")
    );
    expect(disableDrillRuns.statusCode).toBe(200);
    expect(disableDrillRuns.body.ok).toBe(true);
    expect(disableDrillRuns.body.state.after).toBe("disabled");

    const collectionsAfterDisable = await injectJson(ephemeral, "GET", "/api/reference/collections");
    expect(collectionsAfterDisable.statusCode).toBe(200);
    expect(collectionsAfterDisable.body.ok).toBe(true);
    expect(
      (collectionsAfterDisable.body.items ?? []).some(
        (collection) => collection?.id === "iter3-drill-runs"
      )
    ).toBe(false);

    const enableDrillRuns = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter3-drill-runs", "enable")
    );
    expect(enableDrillRuns.statusCode).toBe(200);
    expect(enableDrillRuns.body.ok).toBe(true);
    expect(enableDrillRuns.body.state.after).toBe("enabled");

    const collectionsAfterEnable = await injectJson(ephemeral, "GET", "/api/reference/collections");
    expect(collectionsAfterEnable.statusCode).toBe(200);
    expect(collectionsAfterEnable.body.ok).toBe(true);
    expect(
      (collectionsAfterEnable.body.items ?? []).some(
        (collection) => collection?.id === "iter3-drill-runs"
      )
    ).toBe(true);

    return {
      collectionIds: sortedIds(collectionsAfterEnable.body.items),
      slugLengths: {
        initial: initialSlug.length,
        updated: updatedSlug.length
      },
      remoteOptionId: remoteOption.id,
      missionOptionId: missionOption.id,
      missionJob: {
        id: missionJobId,
        type: missionJob.type,
        status: missionJob.status
      },
      deletePolicies: {
        restrictCode: restrictDeleteDrillRun.body.error.code,
        nullifyPolicy: nullifyDeleteDrillRun.body.cleanup.policy,
        incidentDrillRunIdAfterNullify: incidentAfterNullify.body.item.drillRunId
      },
      lifecycle: {
        drillRuns: {
          disableState: disableDrillRuns.body.state.after,
          enableState: enableDrillRuns.body.state.after
        }
      }
    };
  } finally {
    await ephemeral.close();
  }
}

export function registerReferenceSliceIter3AssignmentSuite() {
  test(
    "iter3 assignment flow replays deterministically x3 with no-fallback coverage",
    async () => {
      const snapshots = [];
      for (let runIndex = 0; runIndex < 3; runIndex += 1) {
        snapshots.push(await runIter3Scenario());
      }

      expect(snapshots[1]).toEqual(snapshots[0]);
      expect(snapshots[2]).toEqual(snapshots[0]);
    },
    60_000
  );
}


registerReferenceSliceSuiteWithServer(registerReferenceSliceIter3AssignmentSuite);
