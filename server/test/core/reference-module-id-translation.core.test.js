import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  createReferenceModuleIdTranslationLayer,
  createReferenceModuleIdTranslationLayerFromFile
} from "../../src/domains/reference/runtime/services/reference-module-id-translation-domain-service.js";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const REPO_ROOT_DIR = path.resolve(CURRENT_DIR, "..", "..", "..");

function createMockRegistry(moduleIds) {
  return {
    list() {
      return moduleIds.map((moduleId) => ({
        manifest: {
          id: moduleId
        },
        state: "enabled"
      }));
    }
  };
}

const LEGACY_TO_TARGET = {
  articles: "test-modules-crud-core",
  products: "test-modules-crud-core",
  remotes: "test-modules-remotes-publish"
};

test("dual-compat resolves legacy aliases to discovered target modules", () => {
  const translation = createReferenceModuleIdTranslationLayer({
    mode: "dual-compat",
    legacyToTarget: LEGACY_TO_TARGET,
    moduleRegistry: createMockRegistry([
      "test-modules-crud-core",
      "test-modules-remotes-publish"
    ])
  });

  const articlesResolution = translation.resolveModuleId("articles");
  expect(articlesResolution).toEqual({
    ok: true,
    requestedModuleId: "articles",
    canonicalModuleId: "test-modules-crud-core",
    aliasKind: "legacy-to-target",
    translated: true
  });

  const remotesResolution = translation.resolveModuleId("remotes");
  expect(remotesResolution).toEqual({
    ok: true,
    requestedModuleId: "remotes",
    canonicalModuleId: "test-modules-remotes-publish",
    aliasKind: "legacy-to-target",
    translated: true
  });
});

test("new-id-authoritative rejects legacy aliases while allowing discovered target IDs", () => {
  const translation = createReferenceModuleIdTranslationLayer({
    mode: "new-id-authoritative",
    legacyToTarget: LEGACY_TO_TARGET,
    moduleRegistry: createMockRegistry(["test-modules-crud-core"])
  });

  const targetResolution = translation.resolveModuleId("test-modules-crud-core");
  expect(targetResolution).toEqual({
    ok: true,
    requestedModuleId: "test-modules-crud-core",
    canonicalModuleId: "test-modules-crud-core",
    aliasKind: null,
    translated: false
  });

  const legacyResolution = translation.resolveModuleId("articles");
  expect(legacyResolution).toEqual({
    ok: false,
    code: "MODULE_ID_ALIAS_DISABLED",
    requestedModuleId: "articles",
    canonicalModuleId: "test-modules-crud-core",
    aliasKind: "legacy-to-target",
    candidates: []
  });
});

test("dual-compat returns deterministic ambiguity when target maps to multiple discovered legacy modules", () => {
  const translation = createReferenceModuleIdTranslationLayer({
    mode: "dual-compat",
    legacyToTarget: LEGACY_TO_TARGET,
    moduleRegistry: createMockRegistry(["articles", "products"])
  });

  const resolution = translation.resolveModuleId("test-modules-crud-core");
  expect(resolution).toEqual({
    ok: false,
    code: "MODULE_ID_TRANSLATION_AMBIGUOUS",
    requestedModuleId: "test-modules-crud-core",
    canonicalModuleId: null,
    aliasKind: "target-to-legacy",
    candidates: ["articles", "products"]
  });
});

test("file-backed translation layer loads freeze map and exposes summary", async () => {
  const mapPath = path.resolve(
    REPO_ROOT_DIR,
    "docs",
    "contracts",
    "artifacts",
    "module-id-alias-map-v1.json"
  );
  const translation = await createReferenceModuleIdTranslationLayerFromFile({
    mode: "dual-compat",
    mapPath,
    moduleRegistry: createMockRegistry([
      "test-modules-crud-core",
      "test-modules-relations-taxonomy",
      "test-modules-settings-policy",
      "test-modules-operations-dispatch",
      "test-modules-remotes-publish"
    ])
  });

  expect(translation.summary.mapLoadOk).toBe(true);
  expect(translation.summary.mappingCount).toBe(38);
  expect(translation.summary.discoveredTargetModuleCount).toBe(5);
  expect(translation.diagnostics).toEqual([]);
});

