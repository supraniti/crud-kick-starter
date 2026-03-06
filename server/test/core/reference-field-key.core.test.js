import { expect, test } from "vitest";
import {
  stripReferenceMultiSuffix,
  stripReferenceSingleSuffix,
  toReferenceMultiQueryKey,
  toReferenceTitleKey,
  toReferenceTitlesKey
} from "../../src/core/shared/capability-contracts/local-kernel/reference-field-key-utils.mjs";

test("reference field key helpers resolve single reference title keys across naming styles", () => {
  expect(stripReferenceSingleSuffix("ownerId")).toBe("owner");
  expect(stripReferenceSingleSuffix("owner-id")).toBe("owner");
  expect(stripReferenceSingleSuffix("owner")).toBe("owner");
  expect(toReferenceTitleKey("ownerId")).toBe("ownerTitle");
  expect(toReferenceTitleKey("owner-id")).toBe("owner-title");
});

test("reference field key helpers resolve multi reference title keys across naming styles", () => {
  expect(stripReferenceMultiSuffix("collaboratorIds")).toBe("collaborator");
  expect(stripReferenceMultiSuffix("collaborator-ids")).toBe("collaborator");
  expect(stripReferenceMultiSuffix("collaborators")).toBe("collaborators");
  expect(toReferenceTitlesKey("collaboratorIds")).toBe("collaboratorTitles");
  expect(toReferenceTitlesKey("collaborator-ids")).toBe("collaborator-titles");
});

test("reference field key helpers derive singular query keys for multi-reference fields", () => {
  expect(toReferenceMultiQueryKey("noteIds")).toBe("noteId");
  expect(toReferenceMultiQueryKey("note-ids")).toBe("note-id");
  expect(toReferenceMultiQueryKey("note-id")).toBe("note-id");
  expect(toReferenceMultiQueryKey("noteId")).toBe("noteId");
});

