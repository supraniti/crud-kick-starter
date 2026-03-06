import {
  dedupeRouteViewActions,
  dedupeRouteViewQuickActions,
  isModuleRouteViewActionType
} from "../../../runtime/shared-capability-bridges/route-view-catalog.mjs";

const DISPATCH_COLLECTION_ID = "dispatches";
const STATUS_OPTIONS = ["draft", "review", "published"];
const COLLECTION_ID_PATTERN = /^[a-z0-9-]+$/;
const MODULE_ACTION_RESET_FILTERS = "reset-filters";

function normalizeStatus(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  return STATUS_OPTIONS.includes(normalized) ? normalized : "";
}

function normalizeCollectionId(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    return "";
  }

  return COLLECTION_ID_PATTERN.test(normalized) ? normalized : "";
}

const DISPATCHES_ROUTE_STATE_ADAPTER = Object.freeze({
  parseQuery: (query) => ({
    status: normalizeStatus(query?.get?.("status") ?? ""),
    collectionId: normalizeCollectionId(query?.get?.("collectionId") ?? "")
  }),
  normalizeRoute: (route) => ({
    status: normalizeStatus(route?.status ?? ""),
    collectionId: normalizeCollectionId(route?.collectionId ?? "")
  }),
  buildQuery: (route) => ({
    status: normalizeStatus(route?.status ?? "") || null,
    collectionId: normalizeCollectionId(route?.collectionId ?? "") || null
  })
});

function runDispatchesModuleAction({ action, route, navigate } = {}) {
  if (
    !action ||
    typeof action !== "object" ||
    !isModuleRouteViewActionType(action.type) ||
    typeof navigate !== "function"
  ) {
    return;
  }

  const commandId =
    typeof action.commandId === "string" ? action.commandId.trim().toLowerCase() : "";
  if (commandId !== MODULE_ACTION_RESET_FILTERS) {
    return;
  }

  const payload = action.payload && typeof action.payload === "object" ? action.payload : {};
  const nextStatus = normalizeStatus(payload.status ?? "");
  const nextCollectionId = normalizeCollectionId(payload.collectionId ?? DISPATCH_COLLECTION_ID);
  const moduleId = typeof route?.moduleId === "string" && route.moduleId.length > 0
    ? route.moduleId
    : DISPATCH_COLLECTION_ID;

  navigate(
    {
      moduleId,
      status: nextStatus,
      collectionId: nextCollectionId || DISPATCH_COLLECTION_ID
    },
    { replace: false }
  );
}

function registerModuleViews({ createCollectionsRouteViewDescriptor, routeView } = {}) {
  if (typeof createCollectionsRouteViewDescriptor !== "function") {
    return [];
  }

  const quickActions = dedupeRouteViewQuickActions(routeView?.quickActions);
  const actions = dedupeRouteViewActions(routeView?.actions);
  const baseDescriptor = createCollectionsRouteViewDescriptor({
    moduleId: DISPATCH_COLLECTION_ID,
    bannerMessage: "Dispatches custom route-state workspace",
    quickActions,
    actions,
    runAction: runDispatchesModuleAction
  });

  return [
    {
      ...baseDescriptor,
      quickActions,
      actions,
      runAction: runDispatchesModuleAction,
      routeStateAdapter: DISPATCHES_ROUTE_STATE_ADAPTER,
      render: (context) => baseDescriptor.render(context)
    }
  ];
}

export { registerModuleViews };