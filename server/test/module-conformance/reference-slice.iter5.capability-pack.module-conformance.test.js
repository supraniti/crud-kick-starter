import { expect, test } from "vitest";
import { runIter5Scenario } from "./helpers/reference-slice-iter5-assignment-scenario.js";

function registerReferenceSliceIter5CapabilityPackConformanceSuite() {
  test(
    "iter5 capability pack preserves nested payload and plugin normalization contracts",
    async () => {
    const snapshot = await runIter5Scenario();

    expect(snapshot.missionJob.status).toBe("succeeded");
    expect(snapshot.missionJob.type).toBe("mission:iter5-playbook-run-mission");

    expect(snapshot.nestedRoundTrip).toEqual(
      expect.objectContaining({
        runEnvelopeEndpoint: "ssh://iter5.invalid/run",
        findingEvidenceScore: 92,
        analysisBundleStage: "resolved",
        playbookStepCount: 2
      })
    );
    },
    30_000
  );
}

export { registerReferenceSliceIter5CapabilityPackConformanceSuite };
