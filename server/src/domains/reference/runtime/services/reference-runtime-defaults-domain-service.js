import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const CURRENT_DIR = path.dirname(CURRENT_FILE);
const SERVER_ROOT_DIR = path.resolve(CURRENT_DIR, "..", "..", "..", "..", "..");
const REPO_ROOT_DIR = path.resolve(SERVER_ROOT_DIR, "..");
const MODULES_ROOT_DIR_OVERRIDE =
  process.env.REFERENCE_MODULES_ROOT_DIR ?? process.env.REFERENCE_MODULES_DIR ?? "";
const MODULES_ROOT_DIR = path.resolve(
  REPO_ROOT_DIR,
  typeof MODULES_ROOT_DIR_OVERRIDE === "string" && MODULES_ROOT_DIR_OVERRIDE.trim().length > 0
    ? MODULES_ROOT_DIR_OVERRIDE.trim()
    : "modules"
);
const MODULE_ID_TRANSLATION_MAP_FILE = path.resolve(
  REPO_ROOT_DIR,
  "docs",
  "contracts",
  "artifacts",
  "module-id-alias-map-v1.json"
);
const MODULE_ID_TRANSLATION_MODE_DEFAULT =
  process.env.REFERENCE_MODULE_ID_TRANSLATION_MODE ?? "off";
const DEPLOY_OUTPUT_ROOT = path.resolve(SERVER_ROOT_DIR, "runtime", "deploy", "reference");
const MODULE_RUNTIME_STATE_FILE_DEFAULT =
  process.env.NODE_ENV === "test"
    ? null
    : path.resolve(SERVER_ROOT_DIR, "runtime", "module-runtime", "reference-runtime.json");

export function resolveReferenceRuntimeDefaults() {
  return {
    modulesRootDir: MODULES_ROOT_DIR,
    moduleIdTranslationMapFile: MODULE_ID_TRANSLATION_MAP_FILE,
    moduleIdTranslationModeDefault: MODULE_ID_TRANSLATION_MODE_DEFAULT,
    moduleRuntimeStateFileDefault: MODULE_RUNTIME_STATE_FILE_DEFAULT,
    deployOutputRoot: DEPLOY_OUTPUT_ROOT
  };
}

