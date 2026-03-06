import { MODULE_VIEW_ENTRYPOINTS } from "../../../module-discovery-bridges/module-view-entrypoints.mjs";

const DEFAULT_MODULE_ID = "products";
const VIEW_DESCRIPTOR_ALLOWED_KEYS = new Set([
  "moduleId",
  "render",
  "usesCollectionsDomain",
  "routeStateAdapter",
  "requiredDomains",
  "quickActions",
  "actions",
  "runAction"
]);
const ROUTE_STATE_ADAPTER_ALLOWED_KEYS = new Set([
  "parseQuery",
  "normalizeRoute",
  "buildQuery"
]);
const VIEW_REGISTRATION_CODES = {
  INVALID_DESCRIPTOR: "FRONTEND_VIEW_REGISTRATION_INVALID",
  UNKNOWN_FIELD: "FRONTEND_VIEW_REGISTRATION_UNKNOWN_FIELD",
  DUPLICATE_MODULE: "FRONTEND_VIEW_REGISTRATION_DUPLICATE",
  MISSING_MODULE: "FRONTEND_VIEW_REGISTRATION_MISSING",
  ROUTE_KIND_INVALID: "FRONTEND_VIEW_ROUTE_KIND_INVALID",
  ROUTE_STATE_ADAPTER_INVALID: "FRONTEND_VIEW_ROUTE_STATE_ADAPTER_INVALID",
  DOMAINS_INVALID: "FRONTEND_VIEW_DOMAINS_INVALID",
  QUICK_ACTIONS_INVALID: "FRONTEND_VIEW_QUICK_ACTIONS_INVALID",
  ACTIONS_INVALID: "FRONTEND_VIEW_ACTIONS_INVALID",
  ACTION_RUNNER_INVALID: "FRONTEND_VIEW_ACTION_RUNNER_INVALID",
  RENDER_FAILED: "FRONTEND_VIEW_RENDER_FAILED",
  ENTRYPOINT_MISSING: "FRONTEND_VIEW_ENTRYPOINT_MISSING",
  ENTRYPOINT_INVALID: "FRONTEND_VIEW_ENTRYPOINT_INVALID",
  ENTRYPOINT_MODULE_MISMATCH: "FRONTEND_VIEW_ENTRYPOINT_MODULE_MISMATCH",
  ENTRYPOINT_DUPLICATE: "FRONTEND_VIEW_ENTRYPOINT_DUPLICATE"
};
function parseCategoryIds(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return [];
  }

  return [...new Set(rawValue.split(",").map((value) => value.trim()).filter(Boolean))];
}

function normalizeRouteStateValue(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return input;
}

function setQueryParam(params, key, value) {
  if (typeof key !== "string" || key.length === 0) {
    return;
  }

  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    const serialized = parseCategoryIds(value.join(",")).join(",");
    if (serialized.length > 0) {
      params.set(key, serialized);
    }
    return;
  }

  const serialized = `${value}`.trim();
  if (serialized.length > 0) {
    params.set(key, serialized);
  }
}

function normalizeCollectionsRouteState(input = {}) {
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(input ?? {})) {
    if (rawKey === "moduleId") {
      continue;
    }

    const key = typeof rawKey === "string" ? rawKey.trim() : "";
    if (key.length === 0) {
      continue;
    }

    if (Array.isArray(rawValue)) {
      const values = parseCategoryIds(rawValue.join(","));
      if (values.length > 0) {
        normalized[key] = values;
      }
      continue;
    }

    if (typeof rawValue === "string") {
      const value = rawValue.trim();
      if (value.length > 0) {
        normalized[key] = value;
      }
      continue;
    }

    if (typeof rawValue === "number" || typeof rawValue === "boolean") {
      normalized[key] = `${rawValue}`;
    }
  }

  return normalized;
}

const DEFAULT_ROUTE_STATE_ADAPTER = Object.freeze({
  parseQuery: () => ({}),
  normalizeRoute: () => ({}),
  buildQuery: () => ({})
});

const PRODUCTS_ROUTE_STATE_ADAPTER = Object.freeze({
  parseQuery: (query) => ({
    categoryIds: parseCategoryIds(query.get("categoryIds") ?? "")
  }),
  normalizeRoute: (route) => ({
    categoryIds: parseCategoryIds(Array.isArray(route?.categoryIds) ? route.categoryIds.join(",") : "")
  }),
  buildQuery: (route) => ({
    categoryIds:
      Array.isArray(route?.categoryIds) && route.categoryIds.length > 0
        ? route.categoryIds.join(",")
        : null
  })
});

const COLLECTIONS_ROUTE_STATE_ADAPTER = Object.freeze({
  parseQuery: (query) => {
    const parsed = {};
    if (!query || typeof query.entries !== "function") {
      return parsed;
    }

    for (const [rawKey, rawValue] of query.entries()) {
      const key = typeof rawKey === "string" ? rawKey.trim() : "";
      if (key.length === 0) {
        continue;
      }

      const value = typeof rawValue === "string" ? rawValue.trim() : "";
      if (value.length === 0) {
        continue;
      }

      if (value.includes(",")) {
        const values = parseCategoryIds(value);
        parsed[key] = values.length > 0 ? values : value;
        continue;
      }

      parsed[key] = value;
    }

    return parsed;
  },
  normalizeRoute: (route) => normalizeCollectionsRouteState(route),
  buildQuery: (route) => normalizeCollectionsRouteState(route)
});

const BUILTIN_ROUTE_STATE_ADAPTERS_BY_MODULE_ID = Object.freeze({
  products: PRODUCTS_ROUTE_STATE_ADAPTER
});
const VIEW_REQUIRED_DOMAIN_LIST = Object.freeze([
  "collections",
  "module-settings",
  "products-taxonomies",
  "mission-operator",
  "remotes-deploy"
]);
const VIEW_REQUIRED_DOMAIN_SET = new Set(VIEW_REQUIRED_DOMAIN_LIST);

export {
  BUILTIN_ROUTE_STATE_ADAPTERS_BY_MODULE_ID,
  COLLECTIONS_ROUTE_STATE_ADAPTER,
  DEFAULT_MODULE_ID,
  DEFAULT_ROUTE_STATE_ADAPTER,
  MODULE_VIEW_ENTRYPOINTS,
  PRODUCTS_ROUTE_STATE_ADAPTER,
  ROUTE_STATE_ADAPTER_ALLOWED_KEYS,
  VIEW_DESCRIPTOR_ALLOWED_KEYS,
  VIEW_REGISTRATION_CODES,
  VIEW_REQUIRED_DOMAIN_LIST,
  VIEW_REQUIRED_DOMAIN_SET,
  normalizeRouteStateValue,
  setQueryParam
};
