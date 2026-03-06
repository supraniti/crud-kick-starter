const ROUTE_VIEW_KIND_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ROUTE_VIEW_CORE_KIND_LIST = Object.freeze(["collections", "custom"]);
const ROUTE_VIEW_NON_COLLECTION_BUILTIN_KIND_LIST = Object.freeze([
  "products",
  "missions",
  "taxonomies",
  "remotes"
]);
const ROUTE_VIEW_KIND_LIST = Object.freeze([
  ...ROUTE_VIEW_CORE_KIND_LIST,
  ...ROUTE_VIEW_NON_COLLECTION_BUILTIN_KIND_LIST
]);
const ROUTE_VIEW_KIND_SET = new Set(ROUTE_VIEW_KIND_LIST);

const ROUTE_VIEW_NON_COLLECTION_BUILTIN_KIND_SET = new Set(
  ROUTE_VIEW_NON_COLLECTION_BUILTIN_KIND_LIST
);

const ROUTE_VIEW_ENTRYPOINT_PATTERN = /^\.\/frontend\/[A-Za-z0-9._/-]+\.(?:js|mjs|jsx)$/;
const ROUTE_VIEW_QUICK_ACTION_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

const ROUTE_VIEW_QUICK_ACTION_LIST = Object.freeze([
  "open-products",
  "open-taxonomies",
  "open-remotes",
  "open-missions"
]);

const ROUTE_VIEW_QUICK_ACTION_SET = new Set(ROUTE_VIEW_QUICK_ACTION_LIST);
const ROUTE_VIEW_ACTION_TYPE_LIST = Object.freeze(["navigate", "external", "module"]);
const ROUTE_VIEW_ACTION_TYPE_SET = new Set(ROUTE_VIEW_ACTION_TYPE_LIST);
const ROUTE_VIEW_ACTION_MODULE_VARIANT_PATTERN = /^module:[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ROUTE_VIEW_ACTION_TYPE_LABEL = `${ROUTE_VIEW_ACTION_TYPE_LIST.join(", ")}, module:<token>`;
const ROUTE_VIEW_ACTION_TARGET_LIST = Object.freeze(["self", "blank"]);
const ROUTE_VIEW_ACTION_TARGET_SET = new Set(ROUTE_VIEW_ACTION_TARGET_LIST);
const ROUTE_VIEW_ACTION_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ROUTE_VIEW_ACTION_MODULE_ID_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ROUTE_VIEW_ACTION_ROUTE_ALLOWED_KEYS = new Set(["moduleId", "state"]);
const ROUTE_VIEW_ACTION_ALLOWED_KEYS = new Set([
  "id",
  "label",
  "type",
  "route",
  "href",
  "target",
  "commandId",
  "payload"
]);

function isHttpUrlValue(value) {
  if (typeof value !== "string") {
    return false;
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function normalizeRouteViewEntrypoint(value) {
  if (typeof value !== "string") {
    return {
      ok: false,
      error: "Route view entrypoint must be a string"
    };
  }

  const normalized = value.trim().replace(/\\/g, "/");
  if (normalized.length === 0) {
    return {
      ok: false,
      error: "Route view entrypoint must be a non-empty string"
    };
  }

  if (!ROUTE_VIEW_ENTRYPOINT_PATTERN.test(normalized)) {
    return {
      ok: false,
      error:
        "Route view entrypoint must be a relative frontend module path like './frontend/view-entrypoint.jsx'"
    };
  }

  const relativePath = normalized.replace(/^\.\//, "");
  const segments = relativePath.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    return {
      ok: false,
      error:
        "Route view entrypoint must not include empty, current (.), or parent (..) path segments"
    };
  }

  return {
    ok: true,
    value: `./${relativePath}`
  };
}

function normalizeRouteViewQuickAction(action) {
  if (typeof action !== "string") {
    return "";
  }

  const normalized = action.trim().toLowerCase();
  return ROUTE_VIEW_QUICK_ACTION_PATTERN.test(normalized) ? normalized : "";
}

function dedupeRouteViewQuickActions(actions) {
  if (!Array.isArray(actions)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();
  for (const action of actions) {
    const token = normalizeRouteViewQuickAction(action);
    if (!token || seen.has(token)) {
      continue;
    }
    seen.add(token);
    normalized.push(token);
  }

  return normalized;
}

function normalizeRouteViewActionType(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  if (ROUTE_VIEW_ACTION_TYPE_SET.has(normalized)) {
    return normalized;
  }

  if (ROUTE_VIEW_ACTION_MODULE_VARIANT_PATTERN.test(normalized)) {
    return normalized;
  }

  return "";
}

function normalizeRouteViewKind(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  return ROUTE_VIEW_KIND_PATTERN.test(normalized) ? normalized : "";
}

function isBuiltinRouteViewKind(value) {
  return ROUTE_VIEW_KIND_SET.has(normalizeRouteViewKind(value));
}

function isNonCollectionBuiltinRouteViewKind(value) {
  return ROUTE_VIEW_NON_COLLECTION_BUILTIN_KIND_SET.has(normalizeRouteViewKind(value));
}

function isModuleRouteViewActionType(value) {
  const normalized = normalizeRouteViewActionType(value);
  return normalized === "module" || normalized.startsWith("module:");
}

function normalizeRouteViewActionStateValue(value) {
  if (value === null) {
    return {
      ok: true,
      value: null
    };
  }

  if (typeof value === "string") {
    return {
      ok: true,
      value: value.trim()
    };
  }

  if (typeof value === "boolean") {
    return {
      ok: true,
      value
    };
  }

  if (Number.isFinite(value)) {
    return {
      ok: true,
      value
    };
  }

  if (Array.isArray(value)) {
    const normalizedValues = [];
    for (const entry of value) {
      if (typeof entry === "string") {
        normalizedValues.push(entry.trim());
        continue;
      }
      if (typeof entry === "boolean" || Number.isFinite(entry)) {
        normalizedValues.push(entry);
        continue;
      }
      return {
        ok: false,
        error:
          "Route view action route.state values must be string, number, boolean, null, or arrays of these scalar values"
      };
    }

    return {
      ok: true,
      value: normalizedValues
    };
  }

  return {
    ok: false,
    error:
      "Route view action route.state values must be string, number, boolean, null, or arrays of these scalar values"
  };
}

function normalizeRouteViewActionPayload(payloadValue) {
  if (!isPlainObject(payloadValue)) {
    return {
      ok: false,
      error: "Route view action payload must be an object when provided",
      field: "payload"
    };
  }

  const normalizedPayload = {};
  for (const [key, value] of Object.entries(payloadValue)) {
    if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(key)) {
      return {
        ok: false,
        error: `Route view action payload key '${key}' is not supported`,
        field: `payload.${key}`
      };
    }

    const normalizedValue = normalizeRouteViewActionStateValue(value);
    if (!normalizedValue.ok) {
      return {
        ok: false,
        error: normalizedValue.error,
        field: `payload.${key}`
      };
    }

    normalizedPayload[key] = normalizedValue.value;
  }

  return {
    ok: true,
    value: normalizedPayload
  };
}

function normalizeRouteViewActionRoute(routeValue) {
  if (!isPlainObject(routeValue)) {
    return {
      ok: false,
      error: "Route view action route must be an object",
      field: "route"
    };
  }

  const unknownRouteKey = Object.keys(routeValue).find(
    (key) => !ROUTE_VIEW_ACTION_ROUTE_ALLOWED_KEYS.has(key)
  );
  if (unknownRouteKey) {
    return {
      ok: false,
      error: `Route view action route field '${unknownRouteKey}' is not supported`,
      field: `route.${unknownRouteKey}`
    };
  }

  const moduleId =
    typeof routeValue.moduleId === "string" ? routeValue.moduleId.trim().toLowerCase() : "";
  if (!ROUTE_VIEW_ACTION_MODULE_ID_PATTERN.test(moduleId)) {
    return {
      ok: false,
      error: "Route view action route.moduleId must be lowercase kebab-case",
      field: "route.moduleId"
    };
  }

  if (routeValue.state !== undefined && !isPlainObject(routeValue.state)) {
    return {
      ok: false,
      error: "Route view action route.state must be an object when provided",
      field: "route.state"
    };
  }

  const normalizedRoute = {
    moduleId
  };

  if (isPlainObject(routeValue.state)) {
    const normalizedState = {};
    for (const [key, value] of Object.entries(routeValue.state)) {
      if (!/^[A-Za-z][A-Za-z0-9-]*$/.test(key)) {
        return {
          ok: false,
          error: `Route view action route.state key '${key}' is not supported`,
          field: `route.state.${key}`
        };
      }

      const normalizedValue = normalizeRouteViewActionStateValue(value);
      if (!normalizedValue.ok) {
        return {
          ok: false,
          error: normalizedValue.error,
          field: `route.state.${key}`
        };
      }

      normalizedState[key] = normalizedValue.value;
    }

    normalizedRoute.state = normalizedState;
  }

  return {
    ok: true,
    value: normalizedRoute
  };
}

function rejectRouteViewActionField(field, error) {
  return {
    ok: false,
    error,
    field
  };
}

function validateRouteViewActionBase(action) {
  if (!isPlainObject(action)) {
    return rejectRouteViewActionField("", "Route view action must be an object");
  }

  const unknownActionKey = Object.keys(action).find((key) => !ROUTE_VIEW_ACTION_ALLOWED_KEYS.has(key));
  if (unknownActionKey) {
    return rejectRouteViewActionField(
      unknownActionKey,
      `Route view action field '${unknownActionKey}' is not supported`
    );
  }

  const actionId = typeof action.id === "string" ? action.id.trim().toLowerCase() : "";
  if (!ROUTE_VIEW_ACTION_ID_PATTERN.test(actionId)) {
    return rejectRouteViewActionField("id", "Route view action id must be lowercase kebab-case");
  }

  const label = typeof action.label === "string" ? action.label.trim() : "";
  if (label.length === 0) {
    return rejectRouteViewActionField("label", "Route view action label is required");
  }

  const actionType = normalizeRouteViewActionType(action.type);
  if (actionType.length === 0) {
    return rejectRouteViewActionField(
      "type",
      `Route view action type must be one of: ${ROUTE_VIEW_ACTION_TYPE_LABEL}`
    );
  }

  return {
    ok: true,
    value: {
      actionId,
      label,
      actionType
    }
  };
}

function normalizeNavigateRouteViewAction(action, actionId, label) {
  if (action.href !== undefined) {
    return rejectRouteViewActionField(
      "href",
      "Route view action href is only supported when type is external"
    );
  }
  if (action.target !== undefined) {
    return rejectRouteViewActionField(
      "target",
      "Route view action target is only supported when type is external"
    );
  }
  if (action.commandId !== undefined) {
    return rejectRouteViewActionField(
      "commandId",
      "Route view action commandId is only supported when type is module or module:<token>"
    );
  }
  if (action.payload !== undefined) {
    return rejectRouteViewActionField(
      "payload",
      "Route view action payload is only supported when type is module or module:<token>"
    );
  }

  const routeValidation = normalizeRouteViewActionRoute(action.route);
  if (!routeValidation.ok) {
    return routeValidation;
  }

  return {
    ok: true,
    value: {
      id: actionId,
      label,
      type: "navigate",
      route: routeValidation.value
    }
  };
}

function normalizeModuleRouteViewAction(action, actionId, label, actionType) {
  if (action.route !== undefined) {
    return rejectRouteViewActionField(
      "route",
      "Route view action route is only supported when type is navigate"
    );
  }
  if (action.href !== undefined) {
    return rejectRouteViewActionField(
      "href",
      "Route view action href is only supported when type is external"
    );
  }
  if (action.target !== undefined) {
    return rejectRouteViewActionField(
      "target",
      "Route view action target is only supported when type is external"
    );
  }

  const commandId = typeof action.commandId === "string" ? action.commandId.trim().toLowerCase() : "";
  if (!ROUTE_VIEW_ACTION_ID_PATTERN.test(commandId)) {
    return rejectRouteViewActionField(
      "commandId",
      "Route view action commandId must be lowercase kebab-case"
    );
  }

  if (action.payload === undefined) {
    return {
      ok: true,
      value: {
        id: actionId,
        label,
        type: actionType,
        commandId
      }
    };
  }

  const payloadValidation = normalizeRouteViewActionPayload(action.payload);
  if (!payloadValidation.ok) {
    return payloadValidation;
  }

  return {
    ok: true,
    value: {
      id: actionId,
      label,
      type: actionType,
      commandId,
      payload: payloadValidation.value
    }
  };
}

function normalizeExternalRouteViewAction(action, actionId, label) {
  if (action.commandId !== undefined) {
    return rejectRouteViewActionField(
      "commandId",
      "Route view action commandId is only supported when type is module or module:<token>"
    );
  }
  if (action.payload !== undefined) {
    return rejectRouteViewActionField(
      "payload",
      "Route view action payload is only supported when type is module or module:<token>"
    );
  }

  const href = typeof action.href === "string" ? action.href.trim() : "";
  if (!isHttpUrlValue(href)) {
    return rejectRouteViewActionField("href", "Route view action href must be a valid http(s) URL");
  }

  const target =
    action.target === undefined
      ? "blank"
      : typeof action.target === "string"
        ? action.target.trim().toLowerCase()
        : "";
  if (!ROUTE_VIEW_ACTION_TARGET_SET.has(target)) {
    return rejectRouteViewActionField(
      "target",
      `Route view action target must be one of: ${ROUTE_VIEW_ACTION_TARGET_LIST.join(", ")}`
    );
  }

  return {
    ok: true,
    value: {
      id: actionId,
      label,
      type: "external",
      href,
      target
    }
  };
}

function normalizeRouteViewAction(action) {
  const baseValidation = validateRouteViewActionBase(action);
  if (!baseValidation.ok) {
    return baseValidation;
  }

  const { actionId, label, actionType } = baseValidation.value;
  if (actionType === "navigate") {
    return normalizeNavigateRouteViewAction(action, actionId, label);
  }
  if (isModuleRouteViewActionType(actionType)) {
    return normalizeModuleRouteViewAction(action, actionId, label, actionType);
  }
  return normalizeExternalRouteViewAction(action, actionId, label);
}

function dedupeRouteViewActions(actions) {
  if (!Array.isArray(actions)) {
    return [];
  }

  const normalized = [];
  const seen = new Set();
  for (const action of actions) {
    const normalizedAction = normalizeRouteViewAction(action);
    if (!normalizedAction.ok || seen.has(normalizedAction.value.id)) {
      continue;
    }

    seen.add(normalizedAction.value.id);
    normalized.push(normalizedAction.value);
  }

  return normalized;
}

export {
  ROUTE_VIEW_ACTION_ID_PATTERN,
  ROUTE_VIEW_ACTION_MODULE_ID_PATTERN,
  ROUTE_VIEW_ACTION_TARGET_LIST,
  ROUTE_VIEW_ACTION_TARGET_SET,
  ROUTE_VIEW_ACTION_TYPE_LABEL,
  ROUTE_VIEW_ACTION_TYPE_LIST,
  ROUTE_VIEW_ACTION_TYPE_SET,
  ROUTE_VIEW_CORE_KIND_LIST,
  ROUTE_VIEW_ENTRYPOINT_PATTERN,
  ROUTE_VIEW_KIND_PATTERN,
  ROUTE_VIEW_KIND_LIST,
  ROUTE_VIEW_KIND_SET,
  ROUTE_VIEW_NON_COLLECTION_BUILTIN_KIND_LIST,
  ROUTE_VIEW_NON_COLLECTION_BUILTIN_KIND_SET,
  ROUTE_VIEW_QUICK_ACTION_PATTERN,
  ROUTE_VIEW_QUICK_ACTION_LIST,
  ROUTE_VIEW_QUICK_ACTION_SET,
  dedupeRouteViewActions,
  dedupeRouteViewQuickActions,
  isBuiltinRouteViewKind,
  isNonCollectionBuiltinRouteViewKind,
  isModuleRouteViewActionType,
  normalizeRouteViewAction,
  normalizeRouteViewActionType,
  normalizeRouteViewKind,
  normalizeRouteViewEntrypoint,
  normalizeRouteViewQuickAction
};
