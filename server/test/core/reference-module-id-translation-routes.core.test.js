import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import {
  createEphemeralReferenceServer,
  createModuleManifestWithoutCollections,
  injectJson
} from "../module-conformance/helpers/reference-slice-runtime-test-helpers.js";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const REPO_ROOT_DIR = path.resolve(CURRENT_DIR, "..", "..", "..");
const FREEZE_MAP_PATH = path.resolve(
  REPO_ROOT_DIR,
  "docs",
  "contracts",
  "artifacts",
  "module-id-alias-map-v1.json"
);

async function createTranslationMapFile(mapping) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-s3-translation-map-"));
  const mapPath = path.join(root, "map.json");
  await fs.writeFile(
    mapPath,
    JSON.stringify(
      {
        mapping
      },
      null,
      2
    ),
    "utf8"
  );
  return {
    root,
    mapPath
  };
}

test("dual-compat routes resolve target module IDs for lifecycle and settings endpoints", async () => {
  const translationMap = await createTranslationMapFile({
    remotes: "test-modules-remotes-publish"
  });
  const server = await createEphemeralReferenceServer({
    moduleIdTranslationMode: "dual-compat",
    moduleIdTranslationMapFile: translationMap.mapPath
  });

  try {
    const disableResponse = await injectJson(
      server,
      "POST",
      "/api/reference/modules/test-modules-remotes-publish/disable"
    );
    expect(disableResponse.statusCode).toBe(200);
    expect(disableResponse.body.ok).toBe(true);
    expect(disableResponse.body.moduleId).toBe("test-modules-remotes-publish");
    expect(disableResponse.body.state.after).toBe("disabled");

    const settingsResponse = await injectJson(
      server,
      "GET",
      "/api/reference/settings/modules/test-modules-remotes-publish"
    );
    expect(settingsResponse.statusCode).toBe(200);
    expect(settingsResponse.body.ok).toBe(true);
    expect(settingsResponse.body.moduleId).toBe("test-modules-remotes-publish");
    expect(settingsResponse.body.state).toBe("disabled");
  } finally {
    await server.close();
    await fs.rm(translationMap.root, {
      recursive: true,
      force: true
    });
  }
});

test("dual-compat routes resolve grouped target IDs deterministically without ambiguity", async () => {
  const server = await createEphemeralReferenceServer({
    moduleIdTranslationMode: "dual-compat",
    moduleIdTranslationMapFile: FREEZE_MAP_PATH
  });

  try {
    const targetResponse = await injectJson(
      server,
      "POST",
      "/api/reference/modules/test-modules-crud-core/disable"
    );
    expect(targetResponse.statusCode).toBe(200);
    expect(targetResponse.body.ok).toBe(true);
    expect(targetResponse.body.moduleId).toBe("test-modules-crud-core");
    expect(targetResponse.body.state.after).toBe("disabled");

    const legacyAliasResponse = await injectJson(
      server,
      "POST",
      "/api/reference/modules/records/enable"
    );
    expect(legacyAliasResponse.statusCode).toBe(200);
    expect(legacyAliasResponse.body.ok).toBe(true);
    expect(legacyAliasResponse.body.moduleId).toBe("test-modules-crud-core");
    expect(legacyAliasResponse.body.state.after).toBe("enabled");
  } finally {
    await server.close();
  }
});

test("new-id-authoritative routes reject legacy aliases", async () => {
  const translationMap = await createTranslationMapFile({
    remotes: "test-modules-remotes-publish"
  });
  const modulesRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-s3-modules-"));
  const moduleDir = path.join(modulesRoot, "test-modules-remotes-publish");
  await fs.mkdir(moduleDir, {
    recursive: true
  });
  await fs.writeFile(
    path.join(moduleDir, "module.json"),
    JSON.stringify(
      createModuleManifestWithoutCollections({
        moduleId: "test-modules-remotes-publish",
        moduleName: "Test Modules Remotes Publish"
      }),
      null,
      2
    ),
    "utf8"
  );
  const server = await createEphemeralReferenceServer({
    modulesDir: modulesRoot,
    moduleIdTranslationMode: "new-id-authoritative",
    moduleIdTranslationMapFile: translationMap.mapPath
  });

  try {
    const lifecycleResponse = await injectJson(
      server,
      "POST",
      "/api/reference/modules/remotes/disable"
    );
    expect(lifecycleResponse.statusCode).toBe(409);
    expect(lifecycleResponse.body.ok).toBe(false);
    expect(lifecycleResponse.body.error.code).toBe("MODULE_ID_ALIAS_DISABLED");

    const settingsResponse = await injectJson(
      server,
      "GET",
      "/api/reference/settings/modules/remotes"
    );
    expect(settingsResponse.statusCode).toBe(409);
    expect(settingsResponse.body.ok).toBe(false);
    expect(settingsResponse.body.error.code).toBe("MODULE_ID_ALIAS_DISABLED");
  } finally {
    await server.close();
    await fs.rm(modulesRoot, {
      recursive: true,
      force: true
    });
    await fs.rm(translationMap.root, {
      recursive: true,
      force: true
    });
  }
});

