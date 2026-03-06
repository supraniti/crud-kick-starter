import { describe, expect, test } from "vitest";
import { normalizeCollectionDefinitions } from "../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime/collection-definition-helpers.mjs";
import { normalizeWorkingState } from "../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime/state-and-item-helpers.mjs";
import { singularFromValue } from "../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime/shared-utils.mjs";

describe("generated runtime singularization contract", () => {
  test("derives deterministic singular labels for common plural patterns", () => {
    expect(singularFromValue("dispatches")).toBe("dispatch");
    expect(singularFromValue("stories")).toBe("story");
    expect(singularFromValue("categories")).toBe("category");
    expect(singularFromValue("glass")).toBe("glass");
    expect(singularFromValue("news")).toBe("news");
  });

  test("normalizes dispatches sequence key using corrected singularization", () => {
    const [definition] = normalizeCollectionDefinitions(
      [
        {
          collectionId: "dispatches",
          idPrefix: "dispatch"
        }
      ],
      "dispatches"
    );

    expect(definition.entitySingular).toBe("dispatch");
    expect(definition.sequenceKey).toBe("nextDispatchNumber");
    expect(definition.sequenceKeyAliases).toEqual(["nextDispatcheNumber"]);
  });

  test("accepts legacy sequence key aliases for deterministic state migration", () => {
    const [definition] = normalizeCollectionDefinitions(
      [
        {
          collectionId: "dispatches",
          idPrefix: "dispatch"
        }
      ],
      "dispatches"
    );

    const normalized = normalizeWorkingState(
      {
        dispatches: [],
        nextDispatcheNumber: 8
      },
      [definition]
    );

    expect(normalized.nextDispatchNumber).toBe(8);
    expect(Object.prototype.hasOwnProperty.call(normalized, "nextDispatcheNumber")).toBe(false);
  });
});
