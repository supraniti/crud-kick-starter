import {
  VIEW_REGISTRATION_CODES
} from "./registration-primitives.js";
import {
  buildRouteForModuleSelection,
  buildRouteUrl,
  normalizeRoute,
  parseRouteFromLocation
} from "./route-state-runtime.js";
import { renderRegistryFallback } from "./route-view-components.jsx";
import {
  MODULE_VIEW_REGISTRY_DIAGNOSTICS,
  createResolvedViewRegistry,
  isCollectionsRouteModule,
  resolveLegacyQuickActionRouteAction,
  resolveViewRegistration
} from "./view-descriptor-resolution.js";

function renderActiveModuleView(context) {
  const { route } = context;
  const { registrations, diagnostics } = createResolvedViewRegistry({
    moduleRuntimeItems: context?.moduleRuntimeItems ?? []
  });
  const registration = registrations.get(route.moduleId);
  if (!registration) {
    return renderRegistryFallback({
      route,
      diagnostics
    });
  }

  try {
    return registration.render(context);
  } catch (error) {
    return renderRegistryFallback({
      route,
      diagnostics: [
        {
          code: VIEW_REGISTRATION_CODES.RENDER_FAILED,
          message:
            error?.message ??
            `View render failed for module '${route.moduleId}'`,
          moduleId: route.moduleId
        }
      ]
    });
  }
}
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
};
