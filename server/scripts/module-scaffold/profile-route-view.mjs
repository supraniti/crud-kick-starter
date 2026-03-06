import {
  SUPPORTED_PROFILE_ROUTE_VIEW_QUICK_ACTIONS,
  isKebabCaseIdentifier
} from "./shared.mjs";
import {
  isBuiltinRouteViewKind,
  isNonCollectionBuiltinRouteViewKind,
  normalizeRouteViewAction,
  normalizeRouteViewKind,
  normalizeRouteViewEntrypoint,
  normalizeRouteViewQuickAction
} from "../../src/core/module-registry-helpers/route-view-contract.js";

const ROUTE_VIEW_QUICK_ACTIONS_LABEL = [
  ...SUPPORTED_PROFILE_ROUTE_VIEW_QUICK_ACTIONS
].join(", ");

function defaultProfileRouteView({ moduleId, moduleLabel }) {
  return {
    kind: "collections",
    entrypoint: null,
    viewId: moduleId,
    bannerMessage: `Module-owned view entrypoint: ${moduleLabel}`,
    quickActions: [],
    actions: [],
    capabilities: {
      usesCollectionsDomain: true
    }
  };
}

function normalizeProfileRouteView(rawRouteView, options) {
  const { moduleId, moduleLabel, details } = options;
  const defaults = defaultProfileRouteView({
    moduleId,
    moduleLabel
  });

  if (rawRouteView === undefined) {
    return defaults;
  }

  if (!rawRouteView || typeof rawRouteView !== "object" || Array.isArray(rawRouteView)) {
    details.push("profile.routeView must be an object when provided");
    return defaults;
  }

  let kind = defaults.kind;
  let isBuiltinRouteKind = true;
  let isBuiltinNonCollectionsKind = false;
  if (rawRouteView.kind !== undefined) {
    if (typeof rawRouteView.kind !== "string") {
      details.push("profile.routeView.kind must be a string when provided");
    } else {
      const normalizedKind = normalizeRouteViewKind(rawRouteView.kind);
      if (normalizedKind.length === 0) {
        details.push("profile.routeView.kind must be lowercase kebab-case");
      } else {
        kind = normalizedKind;
        isBuiltinRouteKind = isBuiltinRouteViewKind(normalizedKind);
        isBuiltinNonCollectionsKind = isNonCollectionBuiltinRouteViewKind(normalizedKind);
      }
    }
  }
  if (rawRouteView.kind === undefined) {
    isBuiltinRouteKind = isBuiltinRouteViewKind(kind);
    isBuiltinNonCollectionsKind = isNonCollectionBuiltinRouteViewKind(kind);
  }

  let entrypoint = defaults.entrypoint;
  if (rawRouteView.entrypoint !== undefined) {
    if (typeof rawRouteView.entrypoint !== "string") {
      details.push("profile.routeView.entrypoint must be a string when provided");
    } else {
      entrypoint = rawRouteView.entrypoint.trim();
    }
  }

  let viewId = defaults.viewId;
  if (rawRouteView.viewId !== undefined) {
    if (typeof rawRouteView.viewId !== "string") {
      details.push("profile.routeView.viewId must be a string when provided");
    } else {
      viewId = rawRouteView.viewId.trim();
      if (!isKebabCaseIdentifier(viewId)) {
        details.push("profile.routeView.viewId must match kebab-case pattern");
      }
    }
  }

  let bannerMessage = defaults.bannerMessage;
  if (rawRouteView.bannerMessage !== undefined) {
    if (typeof rawRouteView.bannerMessage !== "string") {
      details.push("profile.routeView.bannerMessage must be a string when provided");
    } else {
      bannerMessage = rawRouteView.bannerMessage.trim();
    }
  }

  let quickActions = [...defaults.quickActions];
  if (rawRouteView.quickActions !== undefined) {
    if (!Array.isArray(rawRouteView.quickActions)) {
      details.push("profile.routeView.quickActions must be an array when provided");
    } else {
      const normalizedQuickActions = [];
      const seenQuickActions = new Set();
      rawRouteView.quickActions.forEach((action, actionIndex) => {
        if (typeof action !== "string") {
          details.push(
            `profile.routeView.quickActions[${actionIndex}] must be a string`
          );
          return;
        }

        const normalizedAction = normalizeRouteViewQuickAction(action);
        if (normalizedAction.length === 0) {
          details.push(
            `profile.routeView.quickActions[${actionIndex}] must be lowercase kebab-case (legacy built-ins: ${ROUTE_VIEW_QUICK_ACTIONS_LABEL})`
          );
          return;
        }

        if (seenQuickActions.has(normalizedAction)) {
          return;
        }

        seenQuickActions.add(normalizedAction);
        normalizedQuickActions.push(normalizedAction);
      });
      quickActions = normalizedQuickActions;
    }
  }

  let actions = [...defaults.actions];
  if (rawRouteView.actions !== undefined) {
    if (!Array.isArray(rawRouteView.actions)) {
      details.push("profile.routeView.actions must be an array when provided");
    } else {
      const normalizedActions = [];
      const seenActionIds = new Set();
      rawRouteView.actions.forEach((action, actionIndex) => {
        const actionValidation = normalizeRouteViewAction(action);
        if (!actionValidation.ok) {
          const actionField =
            typeof actionValidation.field === "string" && actionValidation.field.length > 0
              ? `.${actionValidation.field}`
              : "";
          details.push(
            `profile.routeView.actions[${actionIndex}]${actionField} ${actionValidation.error}`
          );
          return;
        }

        if (seenActionIds.has(actionValidation.value.id)) {
          return;
        }

        seenActionIds.add(actionValidation.value.id);
        normalizedActions.push(actionValidation.value);
      });

      actions = normalizedActions;
    }
  }

  let usesCollectionsDomain = defaults.capabilities.usesCollectionsDomain;
  if (rawRouteView.capabilities !== undefined) {
    if (
      !rawRouteView.capabilities ||
      typeof rawRouteView.capabilities !== "object" ||
      Array.isArray(rawRouteView.capabilities)
    ) {
      details.push("profile.routeView.capabilities must be an object when provided");
    } else if (rawRouteView.capabilities.usesCollectionsDomain !== undefined) {
      if (typeof rawRouteView.capabilities.usesCollectionsDomain !== "boolean") {
        details.push(
          "profile.routeView.capabilities.usesCollectionsDomain must be a boolean when provided"
        );
      } else {
        usesCollectionsDomain = rawRouteView.capabilities.usesCollectionsDomain;
      }
    }
  }

  if (kind === "custom") {
    if (typeof entrypoint !== "string" || entrypoint.length === 0) {
      details.push("profile.routeView.entrypoint is required when profile.routeView.kind='custom'");
    } else {
      const normalizedEntrypoint = normalizeRouteViewEntrypoint(entrypoint);
      if (!normalizedEntrypoint.ok) {
        details.push(
          normalizedEntrypoint.error.replace(/^Route view entrypoint/, "profile.routeView.entrypoint")
        );
      } else {
        entrypoint = normalizedEntrypoint.value;
      }
    }
  }

  if (kind !== "custom" && isBuiltinRouteKind && typeof rawRouteView.entrypoint === "string") {
    details.push("profile.routeView.entrypoint is only supported when profile.routeView.kind='custom'");
  }
  if (kind !== "custom" && !isBuiltinRouteKind) {
    if (typeof entrypoint !== "string" || entrypoint.length === 0) {
      details.push(
        "profile.routeView.entrypoint is required when profile.routeView.kind is module-contributed"
      );
    } else {
      const normalizedEntrypoint = normalizeRouteViewEntrypoint(entrypoint);
      if (!normalizedEntrypoint.ok) {
        details.push(
          normalizedEntrypoint.error.replace(
            /^Route view entrypoint/,
            "profile.routeView.entrypoint"
          )
        );
      } else {
        entrypoint = normalizedEntrypoint.value;
      }
    }
  }
  if (kind !== "custom" && isBuiltinRouteKind) {
    entrypoint = null;
  }

  if (kind === "collections" && usesCollectionsDomain !== true) {
    details.push(
      "profile.routeView.capabilities.usesCollectionsDomain must be true when profile.routeView.kind='collections'"
    );
  }

  if (kind === "collections") {
    // Collections route composition always requires collections domain behavior.
    usesCollectionsDomain = true;
  }

  if (
    isBuiltinNonCollectionsKind &&
    usesCollectionsDomain !== false
  ) {
    details.push(
      `profile.routeView.capabilities.usesCollectionsDomain must be false when profile.routeView.kind='${kind}'`
    );
  }

  if (isBuiltinNonCollectionsKind) {
    usesCollectionsDomain = false;
  }

  return {
    kind,
    entrypoint,
    viewId,
    bannerMessage,
    quickActions,
    actions,
    capabilities: {
      usesCollectionsDomain
    }
  };
}


export { defaultProfileRouteView, normalizeProfileRouteView };
