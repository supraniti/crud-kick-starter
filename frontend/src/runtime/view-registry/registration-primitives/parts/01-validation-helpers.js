import {
  normalizeRouteViewAction,
  ROUTE_VIEW_QUICK_ACTION_LIST,
  ROUTE_VIEW_QUICK_ACTION_PATTERN
} from "../../../shared-capability-bridges/route-view-catalog.mjs";
import {
  ROUTE_STATE_ADAPTER_ALLOWED_KEYS,
  VIEW_DESCRIPTOR_ALLOWED_KEYS,
  VIEW_REGISTRATION_CODES,
  VIEW_REQUIRED_DOMAIN_LIST,
  VIEW_REQUIRED_DOMAIN_SET
} from "./00-route-state-and-constants.js";

function firstUnknownDescriptorField(descriptor) {
  return Object.keys(descriptor ?? {}).find((key) => !VIEW_DESCRIPTOR_ALLOWED_KEYS.has(key));
}

function firstUnknownRouteStateAdapterField(routeStateAdapter) {
  return Object.keys(routeStateAdapter ?? {}).find(
    (key) => !ROUTE_STATE_ADAPTER_ALLOWED_KEYS.has(key)
  );
}

function validateRouteStateAdapter(routeStateAdapter, { index, moduleId }) {
  if (routeStateAdapter === undefined || routeStateAdapter === null) {
    return {
      ok: true,
      value: null
    };
  }

  if (
    !routeStateAdapter ||
    typeof routeStateAdapter !== "object" ||
    Array.isArray(routeStateAdapter)
  ) {
    return {
      ok: false,
      error: {
        code: VIEW_REGISTRATION_CODES.ROUTE_STATE_ADAPTER_INVALID,
        message: `View registration '${moduleId || "unknown"}' routeStateAdapter must be an object`,
        index,
        moduleId,
        field: "routeStateAdapter"
      }
    };
  }

  const unknownField = firstUnknownRouteStateAdapterField(routeStateAdapter);
  if (unknownField) {
    return {
      ok: false,
      error: {
        code: VIEW_REGISTRATION_CODES.ROUTE_STATE_ADAPTER_INVALID,
        message: `View registration '${moduleId || "unknown"}' routeStateAdapter field '${unknownField}' is not supported`,
        index,
        moduleId,
        field: `routeStateAdapter.${unknownField}`
      }
    };
  }

  for (const adapterField of ROUTE_STATE_ADAPTER_ALLOWED_KEYS) {
    if (
      routeStateAdapter[adapterField] !== undefined &&
      typeof routeStateAdapter[adapterField] !== "function"
    ) {
      return {
        ok: false,
        error: {
          code: VIEW_REGISTRATION_CODES.ROUTE_STATE_ADAPTER_INVALID,
          message: `View registration '${moduleId || "unknown"}' routeStateAdapter '${adapterField}' must be a function`,
          index,
          moduleId,
          field: `routeStateAdapter.${adapterField}`
        }
      };
    }
  }

  return {
    ok: true,
    value: {
      parseQuery:
        typeof routeStateAdapter.parseQuery === "function"
          ? routeStateAdapter.parseQuery
          : undefined,
      normalizeRoute:
        typeof routeStateAdapter.normalizeRoute === "function"
          ? routeStateAdapter.normalizeRoute
          : undefined,
      buildQuery:
        typeof routeStateAdapter.buildQuery === "function"
          ? routeStateAdapter.buildQuery
          : undefined
    }
  };
}

function validateRequiredDomains(requiredDomains, { index, moduleId, usesCollectionsDomain }) {
  if (requiredDomains === undefined) {
    return {
      ok: true,
      value: usesCollectionsDomain === true ? ["collections"] : []
    };
  }

  if (!Array.isArray(requiredDomains)) {
    return {
      ok: false,
      error: {
        code: VIEW_REGISTRATION_CODES.DOMAINS_INVALID,
        message: `View registration '${moduleId || "unknown"}' requiredDomains must be an array when provided`,
        index,
        moduleId,
        field: "requiredDomains"
      }
    };
  }

  const normalizedDomains = [];
  const seenDomains = new Set();
  for (const [domainIndex, domainToken] of requiredDomains.entries()) {
    if (typeof domainToken !== "string") {
      return {
        ok: false,
        error: {
          code: VIEW_REGISTRATION_CODES.DOMAINS_INVALID,
          message: `View registration '${moduleId || "unknown"}' requiredDomains entries must be strings`,
          index,
          moduleId,
          field: `requiredDomains.${domainIndex}`
        }
      };
    }

    const normalizedToken = domainToken.trim().toLowerCase();
    if (!VIEW_REQUIRED_DOMAIN_SET.has(normalizedToken)) {
      return {
        ok: false,
        error: {
          code: VIEW_REGISTRATION_CODES.DOMAINS_INVALID,
          message: `View registration '${moduleId || "unknown"}' requiredDomains must use one of: ${VIEW_REQUIRED_DOMAIN_LIST.join(", ")}`,
          index,
          moduleId,
          field: `requiredDomains.${domainIndex}`
        }
      };
    }

    if (seenDomains.has(normalizedToken)) {
      continue;
    }
    seenDomains.add(normalizedToken);
    normalizedDomains.push(normalizedToken);
  }

  if (usesCollectionsDomain === true && !normalizedDomains.includes("collections")) {
    normalizedDomains.unshift("collections");
  }

  return {
    ok: true,
    value: normalizedDomains
  };
}

function validateQuickActions(quickActions, { index, moduleId }) {
  if (quickActions === undefined) {
    return {
      ok: true,
      value: []
    };
  }

  if (!Array.isArray(quickActions)) {
    return {
      ok: false,
      error: {
        code: VIEW_REGISTRATION_CODES.QUICK_ACTIONS_INVALID,
        message: `View registration '${moduleId || "unknown"}' quickActions must be an array`,
        index,
        moduleId,
        field: "quickActions"
      }
    };
  }

  const normalizedQuickActions = [];
  const seenQuickActions = new Set();
  for (const [quickActionIndex, action] of quickActions.entries()) {
    if (typeof action !== "string") {
      return {
        ok: false,
        error: {
          code: VIEW_REGISTRATION_CODES.QUICK_ACTIONS_INVALID,
          message: `View registration '${moduleId || "unknown"}' quickActions must contain string tokens`,
          index,
          moduleId,
          field: `quickActions.${quickActionIndex}`
        }
      };
    }

    const normalizedAction = action.trim().toLowerCase();
    if (!ROUTE_VIEW_QUICK_ACTION_PATTERN.test(normalizedAction)) {
      return {
        ok: false,
        error: {
          code: VIEW_REGISTRATION_CODES.QUICK_ACTIONS_INVALID,
          message: `View registration '${moduleId || "unknown"}' quickActions must be lowercase kebab-case tokens (legacy built-ins: ${ROUTE_VIEW_QUICK_ACTION_LIST.join(", ")})`,
          index,
          moduleId,
          field: `quickActions.${quickActionIndex}`
        }
      };
    }

    if (seenQuickActions.has(normalizedAction)) {
      continue;
    }

    seenQuickActions.add(normalizedAction);
    normalizedQuickActions.push(normalizedAction);
  }

  return {
    ok: true,
    value: normalizedQuickActions
  };
}

function validateActions(actions, { index, moduleId }) {
  if (actions === undefined) {
    return {
      ok: true,
      value: []
    };
  }

  if (!Array.isArray(actions)) {
    return {
      ok: false,
      error: {
        code: VIEW_REGISTRATION_CODES.ACTIONS_INVALID,
        message: `View registration '${moduleId || "unknown"}' actions must be an array`,
        index,
        moduleId,
        field: "actions"
      }
    };
  }

  const normalizedActions = [];
  const seenActionIds = new Set();
  for (const [actionIndex, action] of actions.entries()) {
    const actionValidation = normalizeRouteViewAction(action);
    if (!actionValidation.ok) {
      const actionField =
        typeof actionValidation.field === "string" && actionValidation.field.length > 0
          ? `.${actionValidation.field}`
          : "";
      return {
        ok: false,
        error: {
          code: VIEW_REGISTRATION_CODES.ACTIONS_INVALID,
          message: actionValidation.error,
          index,
          moduleId,
          field: `actions.${actionIndex}${actionField}`
        }
      };
    }

    if (seenActionIds.has(actionValidation.value.id)) {
      continue;
    }

    seenActionIds.add(actionValidation.value.id);
    normalizedActions.push(actionValidation.value);
  }

  return {
    ok: true,
    value: normalizedActions
  };
}

export {
  firstUnknownDescriptorField,
  validateActions,
  validateQuickActions,
  validateRequiredDomains,
  validateRouteStateAdapter
};
