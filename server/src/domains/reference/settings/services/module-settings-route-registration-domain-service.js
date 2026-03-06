import {
  buildModuleSettingsReadPayload,
  createDefaultModuleSettings,
  getModuleSettingsDefinition,
  mergeModuleSettingsPatch,
  normalizeModuleSettingsStateForRead,
  validateModuleSettingsPatch
} from "./reference-module-settings-runtime-domain-service.js";
import {
  resolveModuleSettingsListData,
  runModuleSettingsRead,
  runModuleSettingsWrite
} from "./module-settings-domain-service.js";
import {
  resolveRouteModuleId
} from "../../runtime/services/reference-module-id-translation-route-resolution-domain-service.js";

function registerModuleSettingsListRoute({
  fastify,
  moduleRegistry,
  resolveModuleSettingsResolution
}) {
  fastify.get("/api/reference/settings/modules", async () => {
    const listing = resolveModuleSettingsListData({
      moduleRegistry,
      resolveModuleSettingsResolution
    });

    return {
      ok: true,
      items: listing.items,
      diagnostics: listing.diagnostics,
      timestamp: new Date().toISOString()
    };
  });
}

function registerModuleSettingsReadRoute({
  fastify,
  moduleRegistry,
  resolveModuleSettingsResolution,
  resolveSettingsRepository,
  moduleIdTranslation
}) {
  fastify.get("/api/reference/settings/modules/:moduleId", async (request, reply) => {
    const moduleIdResolution = resolveRouteModuleId({
      requestedModuleId: request.params?.moduleId,
      moduleIdTranslation
    });
    if (!moduleIdResolution.ok) {
      reply.code(moduleIdResolution.statusCode);
      return moduleIdResolution.payload;
    }

    const moduleId = moduleIdResolution.moduleId;
    const readResult = await runModuleSettingsRead({
      moduleId,
      moduleRegistry,
      resolveModuleSettingsResolution,
      resolveSettingsRepository,
      getModuleSettingsDefinition,
      normalizeModuleSettingsStateForRead,
      buildModuleSettingsReadPayload
    });

    if (!readResult.ok) {
      reply.code(readResult.statusCode);
      return readResult.payload;
    }

    return {
      ok: true,
      moduleId: readResult.value.moduleId,
      state: readResult.value.state,
      settings: readResult.value.settings,
      timestamp: new Date().toISOString()
    };
  });
}

function registerModuleSettingsWriteRoute({
  fastify,
  moduleRegistry,
  resolveModuleSettingsResolution,
  resolveSettingsRepository,
  moduleIdTranslation
}) {
  fastify.put("/api/reference/settings/modules/:moduleId", async (request, reply) => {
    const moduleIdResolution = resolveRouteModuleId({
      requestedModuleId: request.params?.moduleId,
      moduleIdTranslation
    });
    if (!moduleIdResolution.ok) {
      reply.code(moduleIdResolution.statusCode);
      return moduleIdResolution.payload;
    }

    const moduleId = moduleIdResolution.moduleId;
    const writeResult = await runModuleSettingsWrite({
      moduleId,
      payload: request.body ?? {},
      moduleRegistry,
      resolveModuleSettingsResolution,
      resolveSettingsRepository,
      getModuleSettingsDefinition,
      validateModuleSettingsPatch,
      normalizeModuleSettingsStateForRead,
      mergeModuleSettingsPatch,
      buildModuleSettingsReadPayload,
      createDefaultModuleSettings
    });

    if (!writeResult.ok) {
      reply.code(writeResult.statusCode);
      return writeResult.payload;
    }

    return {
      ok: true,
      moduleId: writeResult.value.moduleId,
      state: writeResult.value.state,
      settings: writeResult.value.settings,
      timestamp: new Date().toISOString()
    };
  });
}

export function registerReferenceModuleSettingsRouteHandlers({
  fastify,
  moduleRegistry,
  resolveModuleSettingsResolution,
  resolveSettingsRepository,
  moduleIdTranslation
}) {
  registerModuleSettingsListRoute({
    fastify,
    moduleRegistry,
    resolveModuleSettingsResolution
  });
  registerModuleSettingsReadRoute({
    fastify,
    moduleRegistry,
    resolveModuleSettingsResolution,
    resolveSettingsRepository,
    moduleIdTranslation
  });
  registerModuleSettingsWriteRoute({
    fastify,
    moduleRegistry,
    resolveModuleSettingsResolution,
    resolveSettingsRepository,
    moduleIdTranslation
  });
}
