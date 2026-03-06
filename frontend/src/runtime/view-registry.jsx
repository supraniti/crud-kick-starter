export {
  DEFAULT_MODULE_ID,
  VIEW_REGISTRATION_CODES,
  createViewRegistry,
  validateViewDescriptor
} from "./view-registry/registration-primitives.js";

export {
  MODULE_VIEW_REGISTRY_DIAGNOSTICS,
  buildRouteForModuleSelection,
  buildRouteUrl,
  isCollectionsRouteModule,
  normalizeRoute,
  parseRouteFromLocation,
  renderActiveModuleView,
  resolveLegacyQuickActionRouteAction,
  resolveViewRegistration
} from "./view-registry/registry-runtime.jsx";
