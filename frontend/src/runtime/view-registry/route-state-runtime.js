import {
  BUILTIN_ROUTE_STATE_ADAPTERS_BY_MODULE_ID,
  DEFAULT_MODULE_ID,
  DEFAULT_ROUTE_STATE_ADAPTER,
  normalizeRouteStateValue,
  setQueryParam
} from "./registration-primitives.js";
import { resolveViewRegistration } from "./view-descriptor-resolution.js";

const ROUTE_SEGMENT_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

function normalizeRouteSegment(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  return ROUTE_SEGMENT_PATTERN.test(normalized) ? normalized : "";
}

function buildRouteSegmentMaps(moduleRuntimeItems = []) {
  const moduleIds = new Set();
  const routeSegmentByModuleId = new Map();
  const moduleIdByRouteSegment = new Map();

  for (const moduleItem of moduleRuntimeItems ?? []) {
    const moduleId = normalizeRouteSegment(moduleItem?.id ?? "");
    if (moduleId.length === 0) {
      continue;
    }

    moduleIds.add(moduleId);

    const routeSegment = normalizeRouteSegment(moduleItem?.ui?.navigation?.routeSegment ?? "");
    if (routeSegment.length === 0 || routeSegment === moduleId) {
      continue;
    }

    if (!routeSegmentByModuleId.has(moduleId)) {
      routeSegmentByModuleId.set(moduleId, routeSegment);
    }
    if (!moduleIdByRouteSegment.has(routeSegment)) {
      moduleIdByRouteSegment.set(routeSegment, moduleId);
    }
  }

  return {
    moduleIds,
    routeSegmentByModuleId,
    moduleIdByRouteSegment
  };
}

function resolveModuleIdFromPathSegment(pathSegment, options = {}) {
  const normalizedPathSegment = normalizeRouteSegment(pathSegment);
  if (normalizedPathSegment.length === 0) {
    return DEFAULT_MODULE_ID;
  }

  const { moduleIds, moduleIdByRouteSegment } = buildRouteSegmentMaps(options.moduleRuntimeItems);
  if (moduleIds.has(normalizedPathSegment)) {
    return normalizedPathSegment;
  }

  return moduleIdByRouteSegment.get(normalizedPathSegment) ?? normalizedPathSegment;
}

function resolvePathSegmentForModuleId(moduleId, options = {}) {
  const normalizedModuleId = normalizeRouteSegment(moduleId);
  if (normalizedModuleId.length === 0) {
    return DEFAULT_MODULE_ID;
  }

  const { routeSegmentByModuleId } = buildRouteSegmentMaps(options.moduleRuntimeItems);
  return routeSegmentByModuleId.get(normalizedModuleId) ?? normalizedModuleId;
}

function resolveRouteStateAdapter(moduleId, options = {}) {
  const registration = resolveViewRegistration(moduleId, options);
  const routeStateAdapterCandidate =
    registration?.routeStateAdapter ?? BUILTIN_ROUTE_STATE_ADAPTERS_BY_MODULE_ID[moduleId] ?? null;

  return {
    parseQuery:
      typeof routeStateAdapterCandidate?.parseQuery === "function"
        ? routeStateAdapterCandidate.parseQuery
        : DEFAULT_ROUTE_STATE_ADAPTER.parseQuery,
    normalizeRoute:
      typeof routeStateAdapterCandidate?.normalizeRoute === "function"
        ? routeStateAdapterCandidate.normalizeRoute
        : DEFAULT_ROUTE_STATE_ADAPTER.normalizeRoute,
    buildQuery:
      typeof routeStateAdapterCandidate?.buildQuery === "function"
        ? routeStateAdapterCandidate.buildQuery
        : DEFAULT_ROUTE_STATE_ADAPTER.buildQuery
  };
}

function normalizeRoute(input, options = {}) {
  const moduleId =
    typeof input?.moduleId === "string" && input.moduleId.length > 0
      ? input.moduleId
      : DEFAULT_MODULE_ID;
  const routeStateAdapter = resolveRouteStateAdapter(moduleId, options);
  const normalizedRouteState = normalizeRouteStateValue(
    routeStateAdapter.normalizeRoute(input ?? {})
  );

  return {
    moduleId,
    ...normalizedRouteState
  };
}

function parseRouteFromLocation(options = {}) {
  const pathMatch = window.location.pathname.match(/^\/app\/([^/]+)\/?$/);
  const moduleId = resolveModuleIdFromPathSegment(pathMatch?.[1] ?? DEFAULT_MODULE_ID, options);
  const routeStateAdapter = resolveRouteStateAdapter(moduleId, options);
  const query = new URLSearchParams(window.location.search);
  const parsedRouteState = normalizeRouteStateValue(routeStateAdapter.parseQuery(query));

  return normalizeRoute(
    {
      moduleId,
      ...parsedRouteState
    },
    options
  );
}

function buildRouteUrl(route, options = {}) {
  const normalized = normalizeRoute(route, options);
  const routeStateAdapter = resolveRouteStateAdapter(normalized.moduleId, options);
  const queryState = normalizeRouteStateValue(routeStateAdapter.buildQuery(normalized));
  const params = new URLSearchParams();
  const routePathSegment = resolvePathSegmentForModuleId(normalized.moduleId, options);

  for (const [key, value] of Object.entries(queryState)) {
    setQueryParam(params, key, value);
  }

  const query = params.toString();
  return `/app/${routePathSegment}${query.length > 0 ? `?${query}` : ""}`;
}

function buildRouteForModuleSelection(nextModuleId, options = {}) {
  const normalizedCurrentRoute = normalizeRoute(options.currentRoute, options);
  if (normalizedCurrentRoute.moduleId === nextModuleId) {
    return normalizedCurrentRoute;
  }

  return normalizeRoute({ moduleId: nextModuleId }, options);
}

export { buildRouteForModuleSelection, buildRouteUrl, normalizeRoute, parseRouteFromLocation };
