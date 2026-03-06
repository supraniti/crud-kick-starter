import { expect, test } from "vitest";
import {
  buildReferenceModuleLifecyclePath,
  createEphemeralReferenceServer,
  injectJson,
  resolveReferenceModuleId
} from "./helpers/reference-slice-runtime-test-helpers.js";

const REFERENCE_OPTIONS_PROVIDER_LIFECYCLE_TIMEOUT_MS = 30_000;
const MISSIONS_MODULE_ID = resolveReferenceModuleId("missions");
const REMOTES_MODULE_ID = resolveReferenceModuleId("remotes");
const ITER3_DRILL_RUNS_MODULE_ID = resolveReferenceModuleId("iter3-drill-runs");
const MISSIONS_COLOCATED_WITH_ITER3 =
  MISSIONS_MODULE_ID.length > 0 && MISSIONS_MODULE_ID === ITER3_DRILL_RUNS_MODULE_ID;

test(
  "reference options provider lifecycle follows module state deterministically",
  async () => {
    const ephemeral = await createEphemeralReferenceServer();

  try {
    const runtimeInitial = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
    expect(runtimeInitial.statusCode).toBe(200);
    expect(runtimeInitial.body.ok).toBe(true);
    expect(runtimeInitial.body.runtime.referenceOptionsProviderPolicy.lifecycle).toBe(
      "enabled-only"
    );
    expect(runtimeInitial.body.runtime.registeredReferenceOptionsProviderCollectionIds).toEqual(
      expect.arrayContaining(["remotes", "missions"])
    );
    expect(runtimeInitial.body.runtime.activeRegisteredReferenceOptionsProviderCollectionIds).toEqual(
      expect.arrayContaining(["remotes", "missions"])
    );

    const disableMissions = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("missions", "disable")
    );
    expect(disableMissions.statusCode).toBe(200);
    expect(disableMissions.body.ok).toBe(true);

    const iter3WorkspaceWithMissionsDisabled = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter3-drill-runs/workspace"
    );
    if (MISSIONS_COLOCATED_WITH_ITER3) {
      expect(iter3WorkspaceWithMissionsDisabled.statusCode).toBe(404);
      expect(iter3WorkspaceWithMissionsDisabled.body.ok).toBe(false);
      expect(iter3WorkspaceWithMissionsDisabled.body.error?.code).toBe("COLLECTION_NOT_FOUND");
    } else {
      expect(iter3WorkspaceWithMissionsDisabled.statusCode).toBe(200);
      expect(iter3WorkspaceWithMissionsDisabled.body.ok).toBe(true);
      expect(iter3WorkspaceWithMissionsDisabled.body.referenceOptions?.missions?.errorMessage).toContain(
        `module '${MISSIONS_MODULE_ID}' is 'disabled'`
      );
    }

    const runtimeAfterMissionsDisable = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
    expect(runtimeAfterMissionsDisable.statusCode).toBe(200);
    expect(runtimeAfterMissionsDisable.body.ok).toBe(true);
    expect(
      runtimeAfterMissionsDisable.body.runtime.activeRegisteredReferenceOptionsProviderCollectionIds
    ).not.toContain("missions");

    const enableMissions = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("missions", "enable")
    );
    expect(enableMissions.statusCode).toBe(200);
    expect(enableMissions.body.ok).toBe(true);

    const disableRemotes = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("remotes", "disable")
    );
    expect(disableRemotes.statusCode).toBe(200);
    expect(disableRemotes.body.ok).toBe(true);

    const iter4WorkspaceWithRemotesDisabled = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter4-dispatch-runs/workspace"
    );
    expect(iter4WorkspaceWithRemotesDisabled.statusCode).toBe(200);
    expect(iter4WorkspaceWithRemotesDisabled.body.ok).toBe(true);
    expect(iter4WorkspaceWithRemotesDisabled.body.referenceOptions?.remotes?.errorMessage).toContain(
      `module '${REMOTES_MODULE_ID}' is 'disabled'`
    );

    const runtimeAfterRemotesDisable = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
    expect(runtimeAfterRemotesDisable.statusCode).toBe(200);
    expect(runtimeAfterRemotesDisable.body.ok).toBe(true);
    expect(
      runtimeAfterRemotesDisable.body.runtime.activeRegisteredReferenceOptionsProviderCollectionIds
    ).not.toContain("remotes");

    const enableRemotes = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("remotes", "enable")
    );
    expect(enableRemotes.statusCode).toBe(200);
    expect(enableRemotes.body.ok).toBe(true);

    const iter4WorkspaceAfterEnable = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter4-dispatch-runs/workspace"
    );
    expect(iter4WorkspaceAfterEnable.statusCode).toBe(200);
    expect(iter4WorkspaceAfterEnable.body.ok).toBe(true);
    expect(iter4WorkspaceAfterEnable.body.referenceOptions?.remotes?.errorMessage).toBeNull();
    expect(iter4WorkspaceAfterEnable.body.referenceOptions?.missions?.errorMessage).toBeNull();

    const runtimeAfterEnable = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
    expect(runtimeAfterEnable.statusCode).toBe(200);
    expect(runtimeAfterEnable.body.ok).toBe(true);
    expect(runtimeAfterEnable.body.runtime.activeRegisteredReferenceOptionsProviderCollectionIds).toEqual(
      expect.arrayContaining(["remotes", "missions"])
    );
    } finally {
      await ephemeral.close();
    }
  },
  REFERENCE_OPTIONS_PROVIDER_LIFECYCLE_TIMEOUT_MS
);
