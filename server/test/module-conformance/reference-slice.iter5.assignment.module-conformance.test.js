import { registerReferenceSliceSuiteWithServer } from './helpers/reference-slice-suite-host.js';
import { expect, test } from "vitest";
import { runIter5Scenario } from "./helpers/reference-slice-iter5-assignment-scenario.js";
import { registerReferenceSliceIter5CapabilityPackConformanceSuite } from "./reference-slice.iter5.capability-pack.module-conformance.test.js";

function registerReferenceSliceIter5AssignmentReplaySuite() {
  test(
    "iter5 assignment replay sentinel remains deterministic x3",
    async () => {
      const snapshots = [];
      for (let runIndex = 0; runIndex < 3; runIndex += 1) {
        snapshots.push(await runIter5Scenario());
      }

      expect(snapshots[1]).toEqual(snapshots[0]);
      expect(snapshots[2]).toEqual(snapshots[0]);
    },
    60_000
  );

  registerReferenceSliceIter5CapabilityPackConformanceSuite();
}

export { registerReferenceSliceIter5AssignmentReplaySuite };


registerReferenceSliceSuiteWithServer(registerReferenceSliceIter5AssignmentReplaySuite);
