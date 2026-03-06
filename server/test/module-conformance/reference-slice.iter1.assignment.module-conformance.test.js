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

function resolveRemoteId(workspacePayload) {
  const remotes = workspacePayload?.referenceOptions?.remotes?.items ?? [];
  return typeof remotes[0]?.id === "string" ? remotes[0].id : null;
}

async function runIter1Scenario() {
  const ephemeral = await createEphemeralReferenceServer();

  try {
    const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
    expect(runtimeResponse.statusCode).toBe(200);
    expect(runtimeResponse.body.ok).toBe(true);
    const runtimeItems = runtimeResponse.body.runtime?.items ?? [];
    const runtimeModuleMap = new Map(runtimeItems.map((item) => [item.id, item]));

    const requiredModuleIds = [
      "iter1-campaigns",
      "iter1-audiences",
      "iter1-assets",
      "iter1-dispatches"
    ].map((moduleId) => resolveReferenceModuleId(moduleId));
    for (const moduleId of requiredModuleIds) {
      expect(runtimeModuleMap.has(moduleId)).toBe(true);
      expect(runtimeModuleMap.get(moduleId)?.state).toBe("enabled");
    }

    const settingsRead = await injectJson(
      ephemeral,
      "GET",
      buildReferenceModuleSettingsPath("iter1-campaigns")
    );
    expect(settingsRead.statusCode).toBe(200);
    expect(settingsRead.body.ok).toBe(true);
    expect(Number.isInteger(settingsRead.body.settings.values.slugMaxLength)).toBe(true);
    expect(settingsRead.body.settings.values.slugMaxLength).toBeGreaterThanOrEqual(8);

    const settingsUpdate = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter1-campaigns"),
      {
        slugMaxLength: 16
      }
    );
    expect(settingsUpdate.statusCode).toBe(200);
    expect(settingsUpdate.body.ok).toBe(true);
    expect(settingsUpdate.body.settings.values.slugMaxLength).toBe(16);

    const authorCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/authors/items",
      {
        title: "Iter1 Owner",
        status: "review",
        category: "ops"
      }
    );
    expect(authorCreate.statusCode).toBe(201);
    const ownerAuthorId = authorCreate.body.item.id;

    const parentAudienceCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter1-audiences/items",
      {
        label: "North America Audience",
        segmentKey: "na",
        taxonomy: "region",
        parentAudienceId: null
      }
    );
    expect(parentAudienceCreate.statusCode).toBe(201);
    const parentAudienceId = parentAudienceCreate.body.item.id;

    const childAudienceCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter1-audiences/items",
      {
        label: "Canada Segment",
        segmentKey: "ca",
        taxonomy: "region",
        parentAudienceId
      }
    );
    expect(childAudienceCreate.statusCode).toBe(201);

    const assetOneCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter1-assets/items",
      {
        name: "Primary Hero",
        type: "image",
        sourceUrl: "https://assets.example.invalid/hero.png"
      }
    );
    expect(assetOneCreate.statusCode).toBe(201);
    const assetOneId = assetOneCreate.body.item.id;

    const assetTwoCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter1-assets/items",
      {
        name: "Campaign Body",
        type: "html",
        sourceUrl: "https://assets.example.invalid/body.html"
      }
    );
    expect(assetTwoCreate.statusCode).toBe(201);
    const assetTwoId = assetTwoCreate.body.item.id;

    const dispatchWorkspace = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter1-dispatches/workspace"
    );
    expect(dispatchWorkspace.statusCode).toBe(200);
    expect(dispatchWorkspace.body.ok).toBe(true);
    const dispatchRemoteId = resolveRemoteId(dispatchWorkspace.body);
    expect(dispatchRemoteId).toBeTruthy();

    const campaignCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter1-campaigns/items",
      {
        title: "Iteration One Readiness Campaign",
        ownerAuthorId,
        primaryAudienceId: parentAudienceId,
        assetIds: [assetOneId, assetTwoId],
        status: "ready"
      }
    );
    expect(campaignCreate.statusCode).toBe(201);
    expect(campaignCreate.body.item.slug.length).toBeLessThanOrEqual(16);
    const campaignId = campaignCreate.body.item.id;

    const dispatchCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter1-dispatches/items",
      {
        title: "Dispatch One",
        campaignId,
        remoteId: dispatchRemoteId,
        state: "queued",
        jobId: null
      }
    );
    expect(dispatchCreate.statusCode).toBe(201);
    const dispatchId = dispatchCreate.body.item.id;

    const missionsRead = await injectJson(ephemeral, "GET", "/api/reference/missions");
    expect(missionsRead.statusCode).toBe(200);
    expect(missionsRead.body.ok).toBe(true);
    expect(
      (missionsRead.body.items ?? []).some(
        (mission) => mission?.missionId === "iter1-dispatch-mission"
      )
    ).toBe(true);

    const missionJobCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/missions/iter1-dispatch-mission/jobs",
      {
        dispatchId,
        remoteId: dispatchRemoteId,
        shouldFail: false
      }
    );
    expect(missionJobCreate.statusCode).toBe(202);
    expect(missionJobCreate.body.ok).toBe(true);
    const missionJobId = missionJobCreate.body.job.id;

    const missionJob = await waitForMissionJob(ephemeral, missionJobId);
    expect(missionJob.status).toBe("succeeded");

    const dispatchUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter1-dispatches/items/${dispatchId}`,
      {
        title: "Dispatch One",
        campaignId,
        remoteId: dispatchRemoteId,
        state: "succeeded",
        jobId: missionJobId
      }
    );
    expect(dispatchUpdate.statusCode).toBe(200);
    expect(dispatchUpdate.body.ok).toBe(true);

    const restrictDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter1-audiences/items/${parentAudienceId}`
    );
    expect(restrictDelete.statusCode).toBe(409);
    expect(restrictDelete.body.ok).toBe(false);
    expect(restrictDelete.body.error.code).toBe("REFERENCE_DELETE_RESTRICTED");

    const nullifyDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter1-assets/items/${assetOneId}`
    );
    expect(nullifyDelete.statusCode).toBe(200);
    expect(nullifyDelete.body.ok).toBe(true);
    expect(nullifyDelete.body.cleanup.policy).toBe("nullify");

    const campaignAfterNullify = await injectJson(
      ephemeral,
      "GET",
      `/api/reference/collections/iter1-campaigns/items/${campaignId}`
    );
    expect(campaignAfterNullify.statusCode).toBe(200);
    expect(campaignAfterNullify.body.ok).toBe(true);
    expect(campaignAfterNullify.body.item.assetIds).toEqual([assetTwoId]);

    const disableResponse = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter1-dispatches", "disable")
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
        (collection) => collection?.id === "iter1-dispatches"
      )
    ).toBe(false);

    const enableResponse = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter1-dispatches", "enable")
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
        (collection) => collection?.id === "iter1-dispatches"
      )
    ).toBe(true);

    return {
      collectionIds: sortedIds(collectionsAfterEnable.body.items),
      dispatchWorkspaceRemoteOptionCount:
        dispatchWorkspace.body.referenceOptions?.remotes?.items?.length ?? 0,
      campaignSlug: campaignCreate.body.item.slug,
      missionJobType: missionJob.type,
      missionJobStatus: missionJob.status,
      restrictCode: restrictDelete.body.error.code,
      nullifyPolicy: nullifyDelete.body.cleanup.policy,
      campaignAssetsAfterNullify: [...(campaignAfterNullify.body.item.assetIds ?? [])],
      disableState: disableResponse.body.state.after,
      enableState: enableResponse.body.state.after
    };
  } finally {
    await ephemeral.close();
  }
}

export function registerReferenceSliceIter1AssignmentSuite() {
  test(
    "iter1 assignment flow replays deterministically x3 with stable outcomes",
    async () => {
      const snapshots = [];
      for (let runIndex = 0; runIndex < 3; runIndex += 1) {
        snapshots.push(await runIter1Scenario());
      }

      expect(snapshots[1]).toEqual(snapshots[0]);
      expect(snapshots[2]).toEqual(snapshots[0]);
    },
    60_000
  );
}


registerReferenceSliceSuiteWithServer(registerReferenceSliceIter1AssignmentSuite);
