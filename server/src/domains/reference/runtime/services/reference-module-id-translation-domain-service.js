import fs from "node:fs/promises";

const DEFAULT_MODE = "off";
const MODE_DUAL_COMPAT = "dual-compat";
const MODE_NEW_ID_AUTHORITATIVE = "new-id-authoritative";
const VALID_MODES = new Set([DEFAULT_MODE, MODE_DUAL_COMPAT, MODE_NEW_ID_AUTHORITATIVE]);

function toSortedUniqueStrings(values) {
  return [...new Set((values ?? []).filter((value) => typeof value === "string" && value.length > 0))]
    .sort((left, right) => left.localeCompare(right));
}

function normalizeTranslationMode(value) {
  const token = typeof value === "string" ? value.trim().toLowerCase() : "";
  return VALID_MODES.has(token) ? token : DEFAULT_MODE;
}

function normalizeLegacyToTargetMap(rawMapping) {
  const normalized = {};
  if (!rawMapping || typeof rawMapping !== "object" || Array.isArray(rawMapping)) {
    return normalized;
  }

  for (const [legacyIdRaw, targetIdRaw] of Object.entries(rawMapping)) {
    const legacyId = typeof legacyIdRaw === "string" ? legacyIdRaw.trim() : "";
    const targetId = typeof targetIdRaw === "string" ? targetIdRaw.trim() : "";
    if (legacyId.length === 0 || targetId.length === 0) {
      continue;
    }
    normalized[legacyId] = targetId;
  }

  return normalized;
}

function buildTargetToLegacyMap(legacyToTarget) {
  const targetToLegacy = {};
  for (const [legacyId, targetId] of Object.entries(legacyToTarget)) {
    if (!Array.isArray(targetToLegacy[targetId])) {
      targetToLegacy[targetId] = [];
    }
    targetToLegacy[targetId].push(legacyId);
  }
  for (const targetId of Object.keys(targetToLegacy)) {
    targetToLegacy[targetId] = toSortedUniqueStrings(targetToLegacy[targetId]);
  }
  return targetToLegacy;
}

function collectDiscoveredModuleIds(moduleRegistry) {
  if (!moduleRegistry || typeof moduleRegistry.list !== "function") {
    return [];
  }

  return toSortedUniqueStrings(
    moduleRegistry.list().map((entry) => entry?.manifest?.id)
  );
}

function resolveSingleCandidate(candidates) {
  if (candidates.length === 1) {
    return {
      ok: true,
      value: candidates[0]
    };
  }
  if (candidates.length === 0) {
    return {
      ok: false,
      code: "MODULE_ID_TRANSLATION_NOT_DISCOVERED"
    };
  }
  return {
    ok: false,
    code: "MODULE_ID_TRANSLATION_AMBIGUOUS",
    candidates
  };
}

function createDisabledResolution(moduleId) {
  return {
    ok: false,
    code: "MODULE_ID_TRANSLATION_DISABLED",
    requestedModuleId: moduleId,
    canonicalModuleId: null,
    aliasKind: null,
    candidates: []
  };
}

function createNotFoundResolution(moduleId) {
  return {
    ok: false,
    code: "MODULE_NOT_DISCOVERED",
    requestedModuleId: moduleId,
    canonicalModuleId: null,
    aliasKind: null,
    candidates: []
  };
}

function createAliasDisabledResolution(moduleId, candidateModuleId) {
  return {
    ok: false,
    code: "MODULE_ID_ALIAS_DISABLED",
    requestedModuleId: moduleId,
    canonicalModuleId: candidateModuleId,
    aliasKind: "legacy-to-target",
    candidates: []
  };
}

function createAmbiguousResolution(moduleId, candidates) {
  return {
    ok: false,
    code: "MODULE_ID_TRANSLATION_AMBIGUOUS",
    requestedModuleId: moduleId,
    canonicalModuleId: null,
    aliasKind: "target-to-legacy",
    candidates: [...candidates]
  };
}

function createResolvedResponse(moduleId, canonicalModuleId, aliasKind) {
  return {
    ok: true,
    requestedModuleId: moduleId,
    canonicalModuleId,
    aliasKind,
    translated: moduleId !== canonicalModuleId
  };
}

function createReferenceModuleIdTranslationLayer({
  mode = DEFAULT_MODE,
  mapPath = null,
  legacyToTarget = {},
  moduleRegistry = null
}) {
  const normalizedMode = normalizeTranslationMode(mode);
  const normalizedLegacyToTarget = normalizeLegacyToTargetMap(legacyToTarget);
  const targetToLegacy = buildTargetToLegacyMap(normalizedLegacyToTarget);
  const discoveredModuleIds = collectDiscoveredModuleIds(moduleRegistry);
  const discoveredModuleSet = new Set(discoveredModuleIds);
  const targetModuleIds = toSortedUniqueStrings(Object.values(normalizedLegacyToTarget));
  const legacyModuleIds = toSortedUniqueStrings(Object.keys(normalizedLegacyToTarget));
  const discoveredLegacyModuleIds = legacyModuleIds.filter((id) => discoveredModuleSet.has(id));
  const discoveredTargetModuleIds = targetModuleIds.filter((id) => discoveredModuleSet.has(id));

  function resolveModuleId(moduleId) {
    const token = typeof moduleId === "string" ? moduleId.trim() : "";
    if (token.length === 0) {
      return createNotFoundResolution(token);
    }

    if (discoveredModuleSet.has(token)) {
      return createResolvedResponse(token, token, null);
    }

    if (normalizedMode === DEFAULT_MODE) {
      return createDisabledResolution(token);
    }

    const targetCandidate = normalizedLegacyToTarget[token];
    if (typeof targetCandidate === "string" && targetCandidate.length > 0) {
      if (normalizedMode === MODE_NEW_ID_AUTHORITATIVE) {
        return createAliasDisabledResolution(token, targetCandidate);
      }
      if (discoveredModuleSet.has(targetCandidate)) {
        return createResolvedResponse(token, targetCandidate, "legacy-to-target");
      }
      return createNotFoundResolution(token);
    }

    const legacyCandidates = targetToLegacy[token] ?? [];
    if (legacyCandidates.length === 0) {
      return createNotFoundResolution(token);
    }

    const discoveredCandidates = legacyCandidates.filter((candidate) =>
      discoveredModuleSet.has(candidate)
    );
    const singleCandidate = resolveSingleCandidate(discoveredCandidates);
    if (!singleCandidate.ok) {
      if (singleCandidate.code === "MODULE_ID_TRANSLATION_AMBIGUOUS") {
        return createAmbiguousResolution(token, singleCandidate.candidates);
      }
      return createNotFoundResolution(token);
    }
    return createResolvedResponse(token, singleCandidate.value, "target-to-legacy");
  }

  function summarize() {
    return {
      enabled: normalizedMode !== DEFAULT_MODE,
      mode: normalizedMode,
      mapPath,
      mappingCount: legacyModuleIds.length,
      discoveredModuleCount: discoveredModuleIds.length,
      discoveredLegacyModuleCount: discoveredLegacyModuleIds.length,
      discoveredTargetModuleCount: discoveredTargetModuleIds.length,
      discoveredModuleIds,
      discoveredLegacyModuleIds,
      discoveredTargetModuleIds
    };
  }

  return {
    mode: normalizedMode,
    mapPath,
    legacyToTarget: normalizedLegacyToTarget,
    targetToLegacy,
    resolveModuleId,
    summarize
  };
}

async function loadReferenceModuleIdTranslationMap(mapPath) {
  if (typeof mapPath !== "string" || mapPath.trim().length === 0) {
    return {
      ok: false,
      code: "MODULE_ID_TRANSLATION_MAP_PATH_MISSING",
      legacyToTarget: {}
    };
  }

  try {
    const payload = JSON.parse(await fs.readFile(mapPath, "utf8"));
    return {
      ok: true,
      code: null,
      legacyToTarget: normalizeLegacyToTargetMap(payload?.mapping),
      payload
    };
  } catch (error) {
    return {
      ok: false,
      code: "MODULE_ID_TRANSLATION_MAP_READ_FAILED",
      error,
      legacyToTarget: {}
    };
  }
}

export async function createReferenceModuleIdTranslationLayerFromFile({
  mode = DEFAULT_MODE,
  mapPath = null,
  moduleRegistry = null
}) {
  const mapLoad = await loadReferenceModuleIdTranslationMap(mapPath);
  const translation = createReferenceModuleIdTranslationLayer({
    mode,
    mapPath,
    legacyToTarget: mapLoad.legacyToTarget,
    moduleRegistry
  });

  const summary = translation.summarize();
  const diagnostics = [];
  if (!mapLoad.ok && normalizeTranslationMode(mode) !== DEFAULT_MODE) {
    diagnostics.push({
      code: mapLoad.code,
      message:
        mapLoad.error?.message ??
        `Module ID translation map could not be loaded from '${mapPath ?? "<unset>"}'`,
      mapPath: mapPath ?? null
    });
  }

  return {
    ...translation,
    diagnostics,
    summary: {
      ...summary,
      mapLoadOk: mapLoad.ok,
      mapLoadCode: mapLoad.code ?? null
    }
  };
}

export {
  DEFAULT_MODE as REFERENCE_MODULE_ID_TRANSLATION_MODE_OFF,
  MODE_DUAL_COMPAT as REFERENCE_MODULE_ID_TRANSLATION_MODE_DUAL_COMPAT,
  MODE_NEW_ID_AUTHORITATIVE as REFERENCE_MODULE_ID_TRANSLATION_MODE_NEW_ID_AUTHORITATIVE,
  createReferenceModuleIdTranslationLayer,
  normalizeTranslationMode as normalizeReferenceModuleIdTranslationMode
};
