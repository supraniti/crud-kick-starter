import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CURRENT_FILE = fileURLToPath(import.meta.url);
const SCRIPTS_DIR = path.dirname(CURRENT_FILE);
const REPO_ROOT = path.resolve(SCRIPTS_DIR, "..");
const DEFAULT_MODULE_ID_MAP_FILE = path.resolve(
  REPO_ROOT,
  "docs",
  "contracts",
  "artifacts",
  "module-id-alias-map-v1.json"
);

const MODULE_ID_MODE_OFF = "off";
const MODULE_ID_MODE_DUAL_COMPAT = "dual-compat";
const MODULE_ID_MODE_NEW_ID_AUTHORITATIVE = "new-id-authoritative";
const VALID_MODULE_ID_MODES = new Set([
  MODULE_ID_MODE_OFF,
  MODULE_ID_MODE_DUAL_COMPAT,
  MODULE_ID_MODE_NEW_ID_AUTHORITATIVE
]);

function toNormalizedModeToken(value) {
  const token = typeof value === "string" ? value.trim().toLowerCase() : "";
  return VALID_MODULE_ID_MODES.has(token) ? token : MODULE_ID_MODE_OFF;
}

function normalizeAliasMapping(mapping) {
  if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) {
    return {};
  }

  const normalized = {};
  for (const [aliasIdRaw, targetIdRaw] of Object.entries(mapping)) {
    const aliasId = typeof aliasIdRaw === "string" ? aliasIdRaw.trim() : "";
    const targetId = typeof targetIdRaw === "string" ? targetIdRaw.trim() : "";
    if (aliasId.length === 0 || targetId.length === 0) {
      continue;
    }
    normalized[aliasId] = targetId;
  }

  return normalized;
}

export function normalizeModuleIdMode(value) {
  return toNormalizedModeToken(
    value ?? process.env.REFERENCE_MODULE_ID_TRANSLATION_MODE ?? MODULE_ID_MODE_OFF
  );
}

export function resolveModuleIdMapFilePath(value) {
  const token = typeof value === "string" ? value.trim() : "";
  if (token.length === 0) {
    return DEFAULT_MODULE_ID_MAP_FILE;
  }
  return path.resolve(REPO_ROOT, token);
}

export function loadModuleIdAliasMap(mapPath = DEFAULT_MODULE_ID_MAP_FILE) {
  try {
    const payload = JSON.parse(fs.readFileSync(mapPath, "utf8"));
    return normalizeAliasMapping(payload?.mapping);
  } catch {
    return {};
  }
}

export function resolveScenarioModuleIdBindings(options = {}) {
  const mode = normalizeModuleIdMode(options.mode);
  const mapPath = resolveModuleIdMapFilePath(options.mapPath);
  const aliasToTarget = loadModuleIdAliasMap(mapPath);
  const moduleIds = {};
  const targetModuleIds = {};

  for (const [aliasId, targetId] of Object.entries(aliasToTarget)) {
    targetModuleIds[aliasId] = targetId;
    moduleIds[aliasId] = mode === MODULE_ID_MODE_NEW_ID_AUTHORITATIVE ? targetId : aliasId;
  }

  return {
    mode,
    mapPath,
    mappingCount: Object.keys(aliasToTarget).length,
    aliasToTarget,
    targetModuleIds,
    moduleIds
  };
}

export {
  DEFAULT_MODULE_ID_MAP_FILE,
  MODULE_ID_MODE_DUAL_COMPAT,
  MODULE_ID_MODE_NEW_ID_AUTHORITATIVE,
  MODULE_ID_MODE_OFF
};
