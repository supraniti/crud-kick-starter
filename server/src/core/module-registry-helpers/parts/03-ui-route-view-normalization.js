const ROUTE_VIEW_ALLOWED_KEYS = new Set([
  "kind",
  "entrypoint",
  "viewId",
  "bannerMessage",
  "capabilities",
  "quickActions",
  "actions"
]);

const ROUTE_VIEW_CAPABILITY_ALLOWED_KEYS = new Set(["usesCollectionsDomain"]);

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function buildRouteViewValidationError(validationError, message, path) {
  return {
    ok: false,
    error: validationError("MODULE_MANIFEST_INVALID", message, path)
  };
}

function initializeRouteViewDefinition({
  routeView,
  normalizeRouteViewKind,
  isNonCollectionBuiltinRouteViewKind,
  validationError
}) {
  if (routeView === undefined) {
    return {
      ok: true,
      value: null
    };
  }

  if (!routeView || typeof routeView !== "object" || Array.isArray(routeView)) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView definition must be an object",
      "ui.routeView"
    );
  }

  const unknownRouteViewKey = Object.keys(routeView).find((key) => !ROUTE_VIEW_ALLOWED_KEYS.has(key));
  if (unknownRouteViewKey) {
    return buildRouteViewValidationError(
      validationError,
      `UI routeView field '${unknownRouteViewKey}' is not supported`,
      `ui.routeView.${unknownRouteViewKey}`
    );
  }

  if (typeof routeView.kind !== "string" || routeView.kind.trim().length === 0) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView kind is required",
      "ui.routeView.kind"
    );
  }

  const routeViewKind = normalizeRouteViewKind(routeView.kind);
  if (routeViewKind.length === 0) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView kind must be lowercase kebab-case",
      "ui.routeView.kind"
    );
  }

  const isBuiltinNonCollectionsKind = isNonCollectionBuiltinRouteViewKind(routeViewKind);
  const isBuiltinRouteKind =
    routeViewKind === "collections" || routeViewKind === "custom" || isBuiltinNonCollectionsKind;

  return {
    ok: true,
    value: {
      routeView,
      routeViewKind,
      isBuiltinNonCollectionsKind,
      isBuiltinRouteKind,
      normalizedRouteView: {
        kind: routeViewKind
      }
    }
  };
}

function applyEntrypointField({ routeView, normalizedRouteView, normalizeRouteViewEntrypoint, validationError }) {
  if (!hasOwn(routeView, "entrypoint")) {
    return { ok: true };
  }

  if (typeof routeView.entrypoint !== "string" || routeView.entrypoint.trim().length === 0) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView entrypoint must be a non-empty string when provided",
      "ui.routeView.entrypoint"
    );
  }

  const normalizedEntrypoint = normalizeRouteViewEntrypoint(routeView.entrypoint);
  if (!normalizedEntrypoint.ok) {
    return buildRouteViewValidationError(
      validationError,
      normalizedEntrypoint.error,
      "ui.routeView.entrypoint"
    );
  }

  normalizedRouteView.entrypoint = normalizedEntrypoint.value;
  return { ok: true };
}

function validateEntrypointByKind({
  routeViewKind,
  isBuiltinRouteKind,
  normalizedRouteView,
  validationError
}) {
  if (routeViewKind === "custom" && !normalizedRouteView.entrypoint) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView entrypoint is required when kind is custom",
      "ui.routeView.entrypoint"
    );
  }

  if (routeViewKind !== "custom" && isBuiltinRouteKind && normalizedRouteView.entrypoint) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView entrypoint is only supported when kind is custom",
      "ui.routeView.entrypoint"
    );
  }

  if (routeViewKind !== "custom" && !isBuiltinRouteKind && !normalizedRouteView.entrypoint) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView entrypoint is required when kind is module-contributed",
      "ui.routeView.entrypoint"
    );
  }

  return { ok: true };
}

function applyViewIdField({ routeView, normalizedRouteView, routeSegmentPattern, validationError }) {
  if (!hasOwn(routeView, "viewId")) {
    return { ok: true };
  }

  if (typeof routeView.viewId !== "string" || routeView.viewId.trim().length === 0) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView viewId must be a non-empty string when provided",
      "ui.routeView.viewId"
    );
  }

  const normalizedViewId = routeView.viewId.trim();
  if (!routeSegmentPattern.test(normalizedViewId)) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView viewId must be lowercase kebab-case",
      "ui.routeView.viewId"
    );
  }

  normalizedRouteView.viewId = normalizedViewId;
  return { ok: true };
}

function applyBannerMessageField({ routeView, normalizedRouteView, validationError }) {
  if (!hasOwn(routeView, "bannerMessage")) {
    return { ok: true };
  }

  if (typeof routeView.bannerMessage !== "string") {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView bannerMessage must be a string when provided",
      "ui.routeView.bannerMessage"
    );
  }

  normalizedRouteView.bannerMessage = routeView.bannerMessage.trim();
  return { ok: true };
}
function applyQuickActionsField({
  routeView,
  normalizedRouteView,
  routeViewQuickActionList,
  routeViewQuickActionPattern,
  validationError
}) {
  if (!hasOwn(routeView, "quickActions")) {
    return { ok: true };
  }

  if (!Array.isArray(routeView.quickActions)) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView quickActions must be an array when provided",
      "ui.routeView.quickActions"
    );
  }

  const normalizedQuickActions = [];
  const seenQuickActions = new Set();
  for (const [index, action] of routeView.quickActions.entries()) {
    if (typeof action !== "string") {
      return buildRouteViewValidationError(
        validationError,
        "UI routeView quickActions entries must be strings",
        `ui.routeView.quickActions.${index}`
      );
    }

    const normalizedAction = action.trim().toLowerCase();
    if (!routeViewQuickActionPattern.test(normalizedAction)) {
      return buildRouteViewValidationError(
        validationError,
        `UI routeView quickActions must be lowercase kebab-case tokens (legacy built-ins: ${routeViewQuickActionList.join(", ")})`,
        `ui.routeView.quickActions.${index}`
      );
    }

    if (seenQuickActions.has(normalizedAction)) {
      continue;
    }

    seenQuickActions.add(normalizedAction);
    normalizedQuickActions.push(normalizedAction);
  }

  normalizedRouteView.quickActions = normalizedQuickActions;
  return { ok: true };
}

function applyActionsField({ routeView, normalizedRouteView, normalizeRouteViewAction, validationError }) {
  if (!hasOwn(routeView, "actions")) {
    return { ok: true };
  }

  if (!Array.isArray(routeView.actions)) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView actions must be an array when provided",
      "ui.routeView.actions"
    );
  }

  const normalizedActions = [];
  const seenActions = new Set();
  for (const [index, action] of routeView.actions.entries()) {
    const actionValidation = normalizeRouteViewAction(action);
    if (!actionValidation.ok) {
      const actionField =
        typeof actionValidation.field === "string" && actionValidation.field.length > 0
          ? `.${actionValidation.field}`
          : "";
      return buildRouteViewValidationError(
        validationError,
        actionValidation.error,
        `ui.routeView.actions.${index}${actionField}`
      );
    }

    const actionId = actionValidation.value.id;
    if (seenActions.has(actionId)) {
      continue;
    }

    seenActions.add(actionId);
    normalizedActions.push(actionValidation.value);
  }

  normalizedRouteView.actions = normalizedActions;
  return { ok: true };
}

function applyCapabilitiesField({ routeView, normalizedRouteView, validationError }) {
  if (!hasOwn(routeView, "capabilities")) {
    return { ok: true };
  }

  if (
    !routeView.capabilities ||
    typeof routeView.capabilities !== "object" ||
    Array.isArray(routeView.capabilities)
  ) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView capabilities must be an object when provided",
      "ui.routeView.capabilities"
    );
  }

  const unknownCapabilityKey = Object.keys(routeView.capabilities).find(
    (key) => !ROUTE_VIEW_CAPABILITY_ALLOWED_KEYS.has(key)
  );
  if (unknownCapabilityKey) {
    return buildRouteViewValidationError(
      validationError,
      `UI routeView capability '${unknownCapabilityKey}' is not supported`,
      `ui.routeView.capabilities.${unknownCapabilityKey}`
    );
  }

  if (
    hasOwn(routeView.capabilities, "usesCollectionsDomain") &&
    typeof routeView.capabilities.usesCollectionsDomain !== "boolean"
  ) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView capabilities.usesCollectionsDomain must be a boolean when provided",
      "ui.routeView.capabilities.usesCollectionsDomain"
    );
  }

  normalizedRouteView.capabilities = {
    ...(hasOwn(routeView.capabilities, "usesCollectionsDomain")
      ? { usesCollectionsDomain: routeView.capabilities.usesCollectionsDomain }
      : {})
  };

  return { ok: true };
}

function validateCapabilitiesForKind({
  routeViewKind,
  isBuiltinNonCollectionsKind,
  normalizedRouteView,
  validationError
}) {
  const hasUsesCollectionsDomain =
    hasOwn(normalizedRouteView, "capabilities") &&
    hasOwn(normalizedRouteView.capabilities, "usesCollectionsDomain");
  const usesCollectionsDomain = hasUsesCollectionsDomain
    ? normalizedRouteView.capabilities.usesCollectionsDomain
    : null;

  if (routeViewKind === "collections" && hasUsesCollectionsDomain && usesCollectionsDomain !== true) {
    return buildRouteViewValidationError(
      validationError,
      "UI routeView capabilities.usesCollectionsDomain must be true when kind is collections",
      "ui.routeView.capabilities.usesCollectionsDomain"
    );
  }

  if (isBuiltinNonCollectionsKind && hasUsesCollectionsDomain && usesCollectionsDomain !== false) {
    return buildRouteViewValidationError(
      validationError,
      `UI routeView capabilities.usesCollectionsDomain must be false when kind is ${routeViewKind}`,
      "ui.routeView.capabilities.usesCollectionsDomain"
    );
  }

  return { ok: true };
}

function normalizeUiRouteViewDefinitionWithDependencies(dependencies, routeView) {
  const initializedRouteView = initializeRouteViewDefinition({
    routeView,
    normalizeRouteViewKind: dependencies.normalizeRouteViewKind,
    isNonCollectionBuiltinRouteViewKind: dependencies.isNonCollectionBuiltinRouteViewKind,
    validationError: dependencies.validationError
  });
  if (!initializedRouteView.ok || initializedRouteView.value === null) {
    return initializedRouteView;
  }

  const {
    routeView: sourceRouteView,
    routeViewKind,
    isBuiltinNonCollectionsKind,
    isBuiltinRouteKind,
    normalizedRouteView
  } = initializedRouteView.value;

  const entrypointValidation = applyEntrypointField({
    routeView: sourceRouteView,
    normalizedRouteView,
    normalizeRouteViewEntrypoint: dependencies.normalizeRouteViewEntrypoint,
    validationError: dependencies.validationError
  });
  if (!entrypointValidation.ok) {
    return entrypointValidation;
  }

  const kindEntrypointValidation = validateEntrypointByKind({
    routeViewKind,
    isBuiltinRouteKind,
    normalizedRouteView,
    validationError: dependencies.validationError
  });
  if (!kindEntrypointValidation.ok) {
    return kindEntrypointValidation;
  }

  const viewIdValidation = applyViewIdField({
    routeView: sourceRouteView,
    normalizedRouteView,
    routeSegmentPattern: dependencies.routeSegmentPattern,
    validationError: dependencies.validationError
  });
  if (!viewIdValidation.ok) {
    return viewIdValidation;
  }

  const bannerValidation = applyBannerMessageField({
    routeView: sourceRouteView,
    normalizedRouteView,
    validationError: dependencies.validationError
  });
  if (!bannerValidation.ok) {
    return bannerValidation;
  }

  const quickActionsValidation = applyQuickActionsField({
    routeView: sourceRouteView,
    normalizedRouteView,
    routeViewQuickActionList: dependencies.routeViewQuickActionList,
    routeViewQuickActionPattern: dependencies.routeViewQuickActionPattern,
    validationError: dependencies.validationError
  });
  if (!quickActionsValidation.ok) {
    return quickActionsValidation;
  }

  const actionsValidation = applyActionsField({
    routeView: sourceRouteView,
    normalizedRouteView,
    normalizeRouteViewAction: dependencies.normalizeRouteViewAction,
    validationError: dependencies.validationError
  });
  if (!actionsValidation.ok) {
    return actionsValidation;
  }

  const capabilitiesValidation = applyCapabilitiesField({
    routeView: sourceRouteView,
    normalizedRouteView,
    validationError: dependencies.validationError
  });
  if (!capabilitiesValidation.ok) {
    return capabilitiesValidation;
  }

  const kindCapabilitiesValidation = validateCapabilitiesForKind({
    routeViewKind,
    isBuiltinNonCollectionsKind,
    normalizedRouteView,
    validationError: dependencies.validationError
  });
  if (!kindCapabilitiesValidation.ok) {
    return kindCapabilitiesValidation;
  }

  return {
    ok: true,
    value: normalizedRouteView
  };
}

function createUiRouteViewDefinitionNormalizer({
  routeSegmentPattern,
  routeViewQuickActionList,
  routeViewQuickActionPattern,
  normalizeRouteViewKind,
  isNonCollectionBuiltinRouteViewKind,
  normalizeRouteViewEntrypoint,
  normalizeRouteViewAction,
  validationError
}) {
  const dependencies = {
    routeSegmentPattern,
    routeViewQuickActionList,
    routeViewQuickActionPattern,
    normalizeRouteViewKind,
    isNonCollectionBuiltinRouteViewKind,
    normalizeRouteViewEntrypoint,
    normalizeRouteViewAction,
    validationError
  };

  function normalizeUiRouteViewDefinition(routeView) {
    return normalizeUiRouteViewDefinitionWithDependencies(dependencies, routeView);
  }

  return {
    normalizeUiRouteViewDefinition
  };
}

export { createUiRouteViewDefinitionNormalizer };
