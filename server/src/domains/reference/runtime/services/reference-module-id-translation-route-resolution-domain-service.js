function normalizeTranslationMode(value) {
  const token = typeof value === "string" ? value.trim().toLowerCase() : "";
  return token.length > 0 ? token : "off";
}

function resolveRouteModuleIdErrorStatus(code) {
  if (code === "MODULE_ID_TRANSLATION_AMBIGUOUS" || code === "MODULE_ID_ALIAS_DISABLED") {
    return 409;
  }

  if (
    code === "MODULE_NOT_DISCOVERED" ||
    code === "MODULE_ID_TRANSLATION_NOT_DISCOVERED" ||
    code === "MODULE_ID_TRANSLATION_DISABLED"
  ) {
    return 404;
  }

  return 400;
}

function resolveRouteModuleIdErrorMessage(code, requestedModuleId) {
  if (code === "MODULE_ID_ALIAS_DISABLED") {
    return `Module ID alias '${requestedModuleId}' is disabled in current translation mode`;
  }

  if (code === "MODULE_ID_TRANSLATION_AMBIGUOUS") {
    return `Module ID '${requestedModuleId}' resolves to multiple candidates`;
  }

  if (code === "MODULE_NOT_DISCOVERED" || code === "MODULE_ID_TRANSLATION_NOT_DISCOVERED") {
    return `Module '${requestedModuleId}' was not found`;
  }

  return `Module '${requestedModuleId}' could not be resolved`;
}

function createRouteModuleIdErrorPayload({
  code,
  requestedModuleId,
  canonicalModuleId = null,
  aliasKind = null,
  candidates = []
}) {
  return {
    ok: false,
    error: {
      code,
      message: resolveRouteModuleIdErrorMessage(code, requestedModuleId)
    },
    moduleId: requestedModuleId,
    canonicalModuleId,
    aliasKind,
    candidates: Array.isArray(candidates) ? [...candidates] : [],
    timestamp: new Date().toISOString()
  };
}

function shouldBypassTranslation(moduleIdTranslation) {
  if (!moduleIdTranslation || typeof moduleIdTranslation.resolveModuleId !== "function") {
    return true;
  }

  return normalizeTranslationMode(moduleIdTranslation.mode) === "off";
}

export function resolveRouteModuleId({
  requestedModuleId,
  moduleIdTranslation
}) {
  const token = typeof requestedModuleId === "string" ? requestedModuleId.trim() : "";
  if (token.length === 0) {
    return {
      ok: false,
      statusCode: 404,
      payload: createRouteModuleIdErrorPayload({
        code: "MODULE_NOT_DISCOVERED",
        requestedModuleId: token
      })
    };
  }

  if (shouldBypassTranslation(moduleIdTranslation)) {
    return {
      ok: true,
      moduleId: token
    };
  }

  const resolution = moduleIdTranslation.resolveModuleId(token);
  if (resolution?.ok) {
    return {
      ok: true,
      moduleId:
        typeof resolution.canonicalModuleId === "string" && resolution.canonicalModuleId.length > 0
          ? resolution.canonicalModuleId
          : token
    };
  }

  const code = resolution?.code ?? "MODULE_ID_TRANSLATION_RESOLUTION_FAILED";
  return {
    ok: false,
    statusCode: resolveRouteModuleIdErrorStatus(code),
    payload: createRouteModuleIdErrorPayload({
      code,
      requestedModuleId: token,
      canonicalModuleId: resolution?.canonicalModuleId ?? null,
      aliasKind: resolution?.aliasKind ?? null,
      candidates: resolution?.candidates ?? []
    })
  };
}
