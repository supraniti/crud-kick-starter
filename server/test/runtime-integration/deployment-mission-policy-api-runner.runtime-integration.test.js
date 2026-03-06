import { describe, expect, test } from "vitest";
import { runDeploymentMissionPolicyApiRunner } from "../../scripts/deployment-mission-policy-api-runner.mjs";

describe("Deployment mission policy API runner baseline", () => {
  test("executes deterministic baseline scenarios for deploy parity, mission contract, and policy visibility", async () => {
    const result = await runDeploymentMissionPolicyApiRunner({
      writeReports: false,
      moduleIdMode: "dual-compat"
    });

    expect(result.ok).toBe(true);
    expect(result.report.packId).toBe("deployment-mission-policy-baseline");
    expect(result.report.scenarioCount).toBe(3);
    expect(result.report.failedCount).toBe(0);
    expect(result.report.scenarios.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining([
        "collection-mutation-deploy-parity",
        "mission-payload-contract-truthfulness",
        "persistence-policy-visibility"
      ])
    );

    for (const scenario of result.report.scenarios) {
      expect(scenario.ok).toBe(true);
      expect(Array.isArray(scenario.steps)).toBe(true);
      expect(scenario.steps.length).toBeGreaterThan(0);
      expect(scenario.steps.every((step) => step.ok)).toBe(true);
    }
  }, 45_000);
});

