import { expect } from "vitest";
import {
  buildReferenceModuleLifecyclePath,
  buildReferenceModuleSettingsPath,
  createEphemeralReferenceServer,
  injectJson,
  resolveReferenceModuleId,
  waitForMissionJob
} from "./reference-slice-runtime-test-helpers.js";

const ITER5_PLAYBOOK_RUNS_MODULE_ID = resolveReferenceModuleId("iter5-playbook-runs");

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

async function runIter5Scenario() {
  const ephemeral = await createEphemeralReferenceServer();

  try {
    const runtimeResponse = await injectJson(ephemeral, "GET", "/api/reference/modules/runtime");
    expect(runtimeResponse.statusCode).toBe(200);
    expect(runtimeResponse.body.ok).toBe(true);
    expect(runtimeResponse.body.runtime.ok).toBe(true);

    const runtimeItems = runtimeResponse.body.runtime?.items ?? [];
    const runtimeModuleMap = new Map(runtimeItems.map((item) => [item.id, item]));
    const requiredModuleIds = [
      "iter5-playbooks",
      "iter5-playbook-runs",
      "iter5-findings",
      "iter5-retro-actions"
    ].map((moduleId) => resolveReferenceModuleId(moduleId));
    for (const moduleId of requiredModuleIds) {
      expect(runtimeModuleMap.has(moduleId)).toBe(true);
      expect(runtimeModuleMap.get(moduleId)?.state).toBe("enabled");
    }

    const playbookRunsRouteView = runtimeModuleMap.get(ITER5_PLAYBOOK_RUNS_MODULE_ID)?.ui?.routeView;
    expect(["custom", "collections"]).toContain(playbookRunsRouteView?.kind ?? "");
    if (playbookRunsRouteView?.kind === "custom") {
      expect(Array.isArray(playbookRunsRouteView?.actions)).toBe(true);
      expect(
        (playbookRunsRouteView.actions ?? []).some(
          (action) => action?.id === "iter5-focus-succeeded" && action?.type === "module:filters"
        )
      ).toBe(true);
    }

    const playbookSettingsRead = await injectJson(
      ephemeral,
      "GET",
      buildReferenceModuleSettingsPath("iter5-playbooks")
    );
    expect(playbookSettingsRead.statusCode).toBe(200);
    expect(playbookSettingsRead.body.ok).toBe(true);
    expect(playbookSettingsRead.body.settings.values.naming.slug.maxLength).toBe(32);

    const playbookSettingsUpdateShort = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter5-playbooks"),
      {
        naming: {
          slug: {
            maxLength: 12,
            prefix: "pbk"
          }
        }
      }
    );
    expect(playbookSettingsUpdateShort.statusCode).toBe(200);
    expect(playbookSettingsUpdateShort.body.ok).toBe(true);
    expect(playbookSettingsUpdateShort.body.settings.values.naming.slug.maxLength).toBe(12);

    const findingsSettingsSeed = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter5-findings"),
      {
        defaultSeverityPolicy: {
          defaultSeverity: "high",
          autoEscalate: true
        },
        runDeletePolicy: "restrict"
      }
    );
    expect(findingsSettingsSeed.statusCode).toBe(200);
    expect(findingsSettingsSeed.body.ok).toBe(true);
    expect(findingsSettingsSeed.body.settings.values.defaultSeverityPolicy.defaultSeverity).toBe(
      "high"
    );
    expect(findingsSettingsSeed.body.settings.values.runDeletePolicy).toBe("restrict");

    const authorCreate = await injectJson(ephemeral, "POST", "/api/reference/collections/authors/items", {
      title: "Iter5 Author Owner",
      status: "review",
      category: "ops"
    });
    expect(authorCreate.statusCode).toBe(201);
    const ownerAuthorId = authorCreate.body.item.id;

    const parentPlaybookCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter5-playbooks/items",
      {
        title: "Iter5 Parent Playbook",
        ownerAuthorId,
        parentPlaybookId: null,
        stepBlueprints: [
          {
            label: "Parent step",
            mode: "manual",
            script: "echo parent",
            checks: {
              mustPass: true,
              labels: ["parent"]
            }
          }
        ],
        status: "ready"
      }
    );
    expect(parentPlaybookCreate.statusCode).toBe(201);
    const parentPlaybookId = parentPlaybookCreate.body.item.id;

    const childPlaybookCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter5-playbooks/items",
      {
        title: "Iter5 Child Playbook",
        ownerAuthorId,
        parentPlaybookId,
        stepBlueprints: [
          {
            label: "Collect data",
            mode: "auto",
            script: "collect --fast",
            checks: {
              mustPass: true,
              labels: ["collect", "critical"]
            }
          }
        ],
        status: "ready"
      }
    );
    expect(childPlaybookCreate.statusCode).toBe(201);
    const childPlaybookId = childPlaybookCreate.body.item.id;

    const playbookSettingsUpdateLong = await injectJson(
      ephemeral,
      "PUT",
      buildReferenceModuleSettingsPath("iter5-playbooks"),
      {
        naming: {
          slug: {
            maxLength: 28,
            prefix: "pbk"
          }
        }
      }
    );
    expect(playbookSettingsUpdateLong.statusCode).toBe(200);
    expect(playbookSettingsUpdateLong.body.ok).toBe(true);
    expect(playbookSettingsUpdateLong.body.settings.values.naming.slug.maxLength).toBe(28);

    const childPlaybookUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter5-playbooks/items/${childPlaybookId}`,
      {
        title: "Iter5 Child Playbook For Deterministic Routing Validation",
        ownerAuthorId,
        parentPlaybookId,
        stepBlueprints: [
          {
            label: "Collect data",
            mode: "auto",
            script: "collect --fast",
            checks: {
              mustPass: true,
              labels: ["collect", "critical"]
            }
          },
          {
            label: "Validate evidence",
            mode: "manual",
            script: "validate --strict",
            checks: {
              mustPass: false,
              labels: ["review"]
            }
          }
        ],
        status: "active"
      }
    );
    expect(childPlaybookUpdate.statusCode).toBe(200);
    expect(childPlaybookUpdate.body.ok).toBe(true);

    const playbookRunsWorkspace = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter5-playbook-runs/workspace"
    );
    expect(playbookRunsWorkspace.statusCode).toBe(200);
    expect(playbookRunsWorkspace.body.ok).toBe(true);

    const remoteOption = findReferenceOption(
      playbookRunsWorkspace.body.referenceOptions?.remotes?.items ?? [],
      (item) => typeof item?.id === "string" && item.id.length > 0
    );
    expect(remoteOption).toBeTruthy();

    const missionOption = findReferenceOption(
      playbookRunsWorkspace.body.referenceOptions?.missions?.items ?? [],
      (item) => item?.id === "iter5-playbook-run-mission"
    );
    expect(missionOption).toBeTruthy();

    const playbookRunCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter5-playbook-runs/items",
      {
        title: "Iter5 Playbook Run One",
        traceCode: "run-alpha",
        analysisBundle: {
          stage: "triage",
          confidence: 64,
          notes: "Initial triage run",
          tags: ["core"]
        },
        playbookId: childPlaybookId,
        remoteId: remoteOption.id,
        missionId: missionOption.id,
        executionEnvelope: {
          trigger: "manual kickoff",
          environment: "staging",
          retries: 1,
          notifyOnFailure: true,
          channels: ["slack", "email"],
          transport: {
            protocol: "http",
            endpoint: "https://iter5.invalid/hooks/run"
          }
        },
        status: "ready",
        jobId: null
      }
    );
    expect(playbookRunCreate.statusCode).toBe(201);
    const playbookRunId = playbookRunCreate.body.item.id;
    expect(playbookRunCreate.body.item.traceCode).toBe("RUN-ALPHA");
    expect(playbookRunCreate.body.item.analysisBundle.stage).toBe("triage");
    expect(playbookRunCreate.body.item.playbookId).toBe(childPlaybookId);
    expect(playbookRunCreate.body.item.remoteId).toBe(remoteOption.id);
    expect(playbookRunCreate.body.item.missionId).toBe(missionOption.id);
    expect(typeof playbookRunCreate.body.item.playbookTitle).toBe("string");
    expect(typeof playbookRunCreate.body.item.remoteTitle).toBe("string");
    expect(typeof playbookRunCreate.body.item.missionTitle).toBe("string");

    const playbookRunRead = await injectJson(
      ephemeral,
      "GET",
      `/api/reference/collections/iter5-playbook-runs/items/${playbookRunId}`
    );
    expect(playbookRunRead.statusCode).toBe(200);
    expect(playbookRunRead.body.ok).toBe(true);
    expect(playbookRunRead.body.item.executionEnvelope.transport.endpoint).toBe(
      "https://iter5.invalid/hooks/run"
    );
    expect(playbookRunRead.body.item.analysisBundle.confidence).toBe(64);

    const playbookRunUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter5-playbook-runs/items/${playbookRunId}`,
      {
        title: "Iter5 Playbook Run One",
        traceCode: "run-alpha",
        analysisBundle: {
          stage: "investigation",
          confidence: 82,
          notes: "Second pass diagnostics",
          tags: ["core", "retry"]
        },
        playbookId: childPlaybookId,
        remoteId: remoteOption.id,
        missionId: missionOption.id,
        executionEnvelope: {
          trigger: "manual kickoff",
          environment: "staging",
          retries: 2,
          notifyOnFailure: true,
          channels: ["slack", "email", "pager"],
          transport: {
            protocol: "ssh",
            endpoint: "ssh://iter5.invalid/run"
          }
        },
        status: "running",
        jobId: null
      }
    );
    expect(playbookRunUpdate.statusCode).toBe(200);
    expect(playbookRunUpdate.body.ok).toBe(true);

    const unsupportedStructuredFilter = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter5-playbook-runs/items?executionEnvelope=probe"
    );
    expect(unsupportedStructuredFilter.statusCode).toBe(400);
    expect(unsupportedStructuredFilter.body.ok).toBe(false);
    expect(unsupportedStructuredFilter.body.error.conflicts[0].fieldId).toBe("executionEnvelope");
    expect(unsupportedStructuredFilter.body.error.conflicts[0].code).toContain("FILTER_UNSUPPORTED");

    const unsupportedPluginFilter = await injectJson(
      ephemeral,
      "GET",
      "/api/reference/collections/iter5-playbook-runs/items?analysisBundle=probe"
    );
    expect(unsupportedPluginFilter.statusCode).toBe(400);
    expect(unsupportedPluginFilter.body.ok).toBe(false);
    expect(unsupportedPluginFilter.body.error.conflicts[0].fieldId).toBe("analysisBundle");
    expect(unsupportedPluginFilter.body.error.conflicts[0].code).toContain("FILTER_UNSUPPORTED");

    const missionJobCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/missions/iter5-playbook-run-mission/jobs",
      {
        playbookRunId,
        playbookId: childPlaybookId,
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
    expect(missionJob.type).toBe("mission:iter5-playbook-run-mission");

    const playbookRunUpdateSucceeded = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter5-playbook-runs/items/${playbookRunId}`,
      {
        title: "Iter5 Playbook Run One",
        traceCode: "run-alpha",
        analysisBundle: {
          stage: "resolved",
          confidence: 91,
          notes: "Run closed",
          tags: ["core", "mission"]
        },
        playbookId: childPlaybookId,
        remoteId: remoteOption.id,
        missionId: missionOption.id,
        executionEnvelope: {
          trigger: "manual kickoff",
          environment: "staging",
          retries: 2,
          notifyOnFailure: true,
          channels: ["slack", "email", "pager"],
          transport: {
            protocol: "ssh",
            endpoint: "ssh://iter5.invalid/run"
          }
        },
        status: "succeeded",
        jobId: missionJobId
      }
    );
    expect(playbookRunUpdateSucceeded.statusCode).toBe(200);
    expect(playbookRunUpdateSucceeded.body.ok).toBe(true);

    const findingCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter5-findings/items",
      {
        title: "Iter5 Finding One",
        traceCode: "find-one",
        analysisBundle: {
          stage: "investigation",
          confidence: 72,
          notes: "Initial finding triage",
          tags: ["finding", "mission"]
        },
        runId: playbookRunId,
        relatedMissionIds: [missionOption.id],
        evidenceItems: [
          {
            label: "Execution log",
            kind: "log",
            uri: "artifact://run/log",
            metrics: {
              score: 87,
              labels: ["primary"]
            }
          }
        ],
        severity: "high",
        status: "open"
      }
    );
    expect(findingCreate.statusCode).toBe(201);
    const findingId = findingCreate.body.item.id;
    expect(findingCreate.body.item.traceCode).toBe("FIND-ONE");
    expect(findingCreate.body.item.analysisBundle.stage).toBe("investigation");
    expect(typeof findingCreate.body.item.runTitle).toBe("string");
    expect(Array.isArray(findingCreate.body.item.relatedMissionTitles)).toBe(true);

    const findingUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter5-findings/items/${findingId}`,
      {
        title: "Iter5 Finding One",
        traceCode: "find-one",
        analysisBundle: {
          stage: "resolved",
          confidence: 93,
          notes: "Finding resolved after replay",
          tags: ["finding", "closed"]
        },
        runId: playbookRunId,
        relatedMissionIds: [missionOption.id],
        evidenceItems: [
          {
            label: "Execution log",
            kind: "log",
            uri: "artifact://run/log",
            metrics: {
              score: 92,
              labels: ["primary", "updated"]
            }
          }
        ],
        severity: "high",
        status: "investigating"
      }
    );
    expect(findingUpdate.statusCode).toBe(200);
    expect(findingUpdate.body.ok).toBe(true);
    expect(findingUpdate.body.item.analysisBundle.confidence).toBe(93);

    const retroActionCreate = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter5-retro-actions/items",
      {
        title: "Iter5 Retro Action One",
        findingId,
        ownerAuthorId,
        actionPlan: {
          summary: "Harden mission replay stability",
          priority: "high",
          checklist: ["draft fix", "run QA"]
        },
        status: "open"
      }
    );
    expect(retroActionCreate.statusCode).toBe(201);
    const retroActionId = retroActionCreate.body.item.id;

    const retroActionUpdate = await injectJson(
      ephemeral,
      "PUT",
      `/api/reference/collections/iter5-retro-actions/items/${retroActionId}`,
      {
        title: "Iter5 Retro Action One",
        findingId,
        ownerAuthorId,
        actionPlan: {
          summary: "Harden mission replay stability",
          priority: "high",
          checklist: ["draft fix", "run QA", "verify"]
        },
        status: "done"
      }
    );
    expect(retroActionUpdate.statusCode).toBe(200);
    expect(retroActionUpdate.body.ok).toBe(true);

    const mixedInvalidFinding = await injectJson(
      ephemeral,
      "POST",
      "/api/reference/collections/iter5-findings/items",
      {
        title: "Iter5 Mixed Invalid Finding",
        traceCode: "invalid code !",
        runId: "i5r-missing",
        relatedMissionIds: [missionOption.id],
        evidenceItems: [
          {
            label: "",
            kind: "log"
          }
        ],
        severity: "medium",
        status: "open"
      }
    );
    expect(mixedInvalidFinding.statusCode).toBe(400);
    expect(mixedInvalidFinding.body.ok).toBe(false);
    expect(Array.isArray(mixedInvalidFinding.body.error.conflicts)).toBe(true);

    const retroActionDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter5-retro-actions/items/${retroActionId}`
    );
    expect(retroActionDelete.statusCode).toBe(200);
    expect(retroActionDelete.body.ok).toBe(true);

    const findingDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter5-findings/items/${findingId}`
    );
    expect(findingDelete.statusCode).toBe(200);
    expect(findingDelete.body.ok).toBe(true);

    const playbookRunDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter5-playbook-runs/items/${playbookRunId}`
    );
    expect(playbookRunDelete.statusCode).toBe(200);
    expect(playbookRunDelete.body.ok).toBe(true);

    const childPlaybookDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter5-playbooks/items/${childPlaybookId}`
    );
    expect(childPlaybookDelete.statusCode).toBe(200);
    expect(childPlaybookDelete.body.ok).toBe(true);

    const parentPlaybookDelete = await injectJson(
      ephemeral,
      "DELETE",
      `/api/reference/collections/iter5-playbooks/items/${parentPlaybookId}`
    );
    expect(parentPlaybookDelete.statusCode).toBe(200);
    expect(parentPlaybookDelete.body.ok).toBe(true);

    const disablePlaybookRunsModule = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter5-playbook-runs", "disable")
    );
    expect(disablePlaybookRunsModule.statusCode).toBe(200);
    expect(disablePlaybookRunsModule.body.ok).toBe(true);
    expect(disablePlaybookRunsModule.body.state.after).toBe("disabled");

    const collectionsAfterDisable = await injectJson(ephemeral, "GET", "/api/reference/collections");
    expect(collectionsAfterDisable.statusCode).toBe(200);
    expect(collectionsAfterDisable.body.ok).toBe(true);
    expect(
      (collectionsAfterDisable.body.items ?? []).some(
        (collection) => collection?.id === "iter5-playbook-runs"
      )
    ).toBe(false);

    const enablePlaybookRunsModule = await injectJson(
      ephemeral,
      "POST",
      buildReferenceModuleLifecyclePath("iter5-playbook-runs", "enable")
    );
    expect(enablePlaybookRunsModule.statusCode).toBe(200);
    expect(enablePlaybookRunsModule.body.ok).toBe(true);
    expect(enablePlaybookRunsModule.body.state.after).toBe("enabled");

    const collectionsAfterEnable = await injectJson(ephemeral, "GET", "/api/reference/collections");
    expect(collectionsAfterEnable.statusCode).toBe(200);
    expect(collectionsAfterEnable.body.ok).toBe(true);
    expect(
      (collectionsAfterEnable.body.items ?? []).some(
        (collection) => collection?.id === "iter5-playbook-runs"
      )
    ).toBe(true);

    return {
      collectionIds: sortedIds(collectionsAfterEnable.body.items),
      referenceOptions: {
        remoteOptionId: remoteOption.id,
        missionOptionId: missionOption.id
      },
      missionJob: {
        id: missionJobId,
        type: missionJob.type,
        status: missionJob.status
      },
      nestedRoundTrip: {
        runEnvelopeEndpoint: playbookRunUpdateSucceeded.body.item.executionEnvelope.transport.endpoint,
        findingEvidenceScore: findingUpdate.body.item.evidenceItems[0].metrics.score,
        analysisBundleStage: findingUpdate.body.item.analysisBundle.stage,
        playbookStepCount: childPlaybookUpdate.body.item.stepBlueprints.length
      },
      lifecycle: {
        playbookRuns: {
          disableState: disablePlaybookRunsModule.body.state.after,
          enableState: enablePlaybookRunsModule.body.state.after
        }
      }
    };
  } finally {
    await ephemeral.close();
  }
}

export { runIter5Scenario };
