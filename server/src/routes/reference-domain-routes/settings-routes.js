import {
  registerReferenceModuleSettingsRouteHandlers
} from "../../domains/reference/settings/services/module-settings-route-registration-domain-service.js";

export function registerReferenceModuleSettingsRoutes({
  fastify,
  moduleRegistry,
  resolveModuleSettingsResolution,
  resolveSettingsRepository,
  moduleIdTranslation
}) {
  registerReferenceModuleSettingsRouteHandlers({
    fastify,
    moduleRegistry,
    resolveModuleSettingsResolution,
    resolveSettingsRepository,
    moduleIdTranslation
  });
}
