import { describe, expect, test } from "vitest";
import { runEditorialCapabilityApiRunner } from "../../scripts/editorial-capability-api-runner.mjs";

describe("Editorial capability API runner baseline", () => {
  test("executes deterministic Step-B baseline scenarios for articles, authors, publishers, editors, reviews, briefs, digests, and preserved lane coverage", async () => {
    const result = await runEditorialCapabilityApiRunner({
      writeReports: false,
      moduleIdMode: "dual-compat"
    });

    expect(result.ok).toBe(true);
    expect(result.report.packId).toBe("editorial-capability-baseline");
    expect(result.report.scenarioCount).toBe(8);
    expect(result.report.failedCount).toBe(0);
    expect(result.report.scenarios.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining([
        "articles-settings-and-crud-contract",
        "authors-settings-and-crud-contract",
        "publishers-settings-and-crud-contract",
        "editors-settings-and-crud-contract",
        "reviews-behavior-descriptor-proof",
        "briefs-non-slug-computed-resolver-proof",
        "digests-multi-resolver-catalog-proof",
        "preserved-records-mission-lane"
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

