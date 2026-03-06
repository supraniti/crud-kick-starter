function buildModuleSettingsNotFoundPayload(moduleId) {
  return {
    ok: false,
    error: {
      code: "MODULE_SETTINGS_NOT_FOUND",
      message: `Module '${moduleId}' does not declare settings`
    },
    timestamp: new Date().toISOString()
  };
}

function buildModuleSettingsRepositoryUnavailablePayload(moduleId) {
  return {
    ok: false,
    error: {
      code: "MODULE_SETTINGS_REPOSITORY_UNAVAILABLE",
      message: `Module '${moduleId}' settings repository is unavailable`
    },
    timestamp: new Date().toISOString()
  };
}

function buildModuleSettingsModuleNotReadyPayload(moduleId, state) {
  return {
    ok: false,
    error: {
      code: "MODULE_SETTINGS_MODULE_NOT_READY",
      message: `Module '${moduleId}' settings are unavailable while module state is '${state ?? "unknown"}'`
    },
    timestamp: new Date().toISOString()
  };
}

function buildModuleSettingsPersistenceErrorPayload(moduleId, action, error) {
  return {
    ok: false,
    error: {
      code: error?.code ?? "REFERENCE_STATE_PERSISTENCE_FAILED",
      message:
        error?.message ??
        `Module '${moduleId}' settings persistence failed while handling '${action}'`
    },
    timestamp: new Date().toISOString()
  };
}

function buildModuleSettingsValidationFailurePayload(validation) {
  const firstError = validation.errors[0];
  return {
    ok: false,
    error: {
      code: firstError.code,
      message: firstError.message
    },
    validation: firstError,
    timestamp: new Date().toISOString()
  };
}

function asModuleSettingsState(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isModuleSettingsStateReady(moduleState) {
  return moduleState === "installed" || moduleState === "enabled" || moduleState === "disabled";
}

export function resolveModuleSettingsContext({
  moduleId,
  moduleRegistry,
  resolveModuleSettingsResolution,
  resolveSettingsRepository,
  getModuleSettingsDefinition
}) {
  const moduleState = moduleRegistry.getState(moduleId);
  if (moduleState === null) {
    return {
      ok: false,
      statusCode: 404,
      payload: buildModuleSettingsNotFoundPayload(moduleId)
    };
  }
  if (!isModuleSettingsStateReady(moduleState)) {
    return {
      ok: false,
      statusCode: 409,
      payload: buildModuleSettingsModuleNotReadyPayload(moduleId, moduleState)
    };
  }

  const settingsResolution = resolveModuleSettingsResolution();
  const definition = getModuleSettingsDefinition(settingsResolution.definitions, moduleId);
  if (!definition) {
    return {
      ok: false,
      statusCode: 404,
      payload: buildModuleSettingsNotFoundPayload(moduleId)
    };
  }

  const repository = resolveSettingsRepository(moduleId);
  if (!repository) {
    return {
      ok: false,
      statusCode: 409,
      payload: buildModuleSettingsRepositoryUnavailablePayload(moduleId)
    };
  }

  return {
    ok: true,
    context: {
      moduleId,
      moduleState,
      definition,
      repository
    }
  };
}

export function resolveModuleSettingsListData({
  moduleRegistry,
  resolveModuleSettingsResolution
}) {
  const settingsResolution = resolveModuleSettingsResolution();
  const items = Object.values(settingsResolution.definitions)
    .map((definition) => {
      const moduleState = moduleRegistry.getState(definition.moduleId);
      return {
        moduleId: definition.moduleId,
        state: moduleState,
        fieldCount: definition.fields.length
      };
    })
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId));

  return {
    items,
    diagnostics: settingsResolution.diagnostics ?? []
  };
}

export async function runModuleSettingsRead({
  moduleId,
  moduleRegistry,
  resolveModuleSettingsResolution,
  resolveSettingsRepository,
  getModuleSettingsDefinition,
  normalizeModuleSettingsStateForRead,
  buildModuleSettingsReadPayload
}) {
  const resolution = resolveModuleSettingsContext({
    moduleId,
    moduleRegistry,
    resolveModuleSettingsResolution,
    resolveSettingsRepository,
    getModuleSettingsDefinition
  });
  if (!resolution.ok) {
    return resolution;
  }

  const { moduleState, definition, repository } = resolution.context;

  let settingsState;
  try {
    settingsState = await repository.readState();
  } catch (error) {
    return {
      ok: false,
      statusCode: 500,
      payload: buildModuleSettingsPersistenceErrorPayload(moduleId, "read", error)
    };
  }

  const moduleSettings = normalizeModuleSettingsStateForRead(
    definition,
    asModuleSettingsState(settingsState[moduleId])
  );
  const readPayload = buildModuleSettingsReadPayload(definition, moduleSettings);

  return {
    ok: true,
    value: {
      moduleId,
      state: moduleState,
      settings: readPayload
    }
  };
}

export async function runModuleSettingsWrite({
  moduleId,
  payload,
  moduleRegistry,
  resolveModuleSettingsResolution,
  resolveSettingsRepository,
  getModuleSettingsDefinition,
  validateModuleSettingsPatch,
  normalizeModuleSettingsStateForRead,
  mergeModuleSettingsPatch,
  buildModuleSettingsReadPayload,
  createDefaultModuleSettings
}) {
  const resolution = resolveModuleSettingsContext({
    moduleId,
    moduleRegistry,
    resolveModuleSettingsResolution,
    resolveSettingsRepository,
    getModuleSettingsDefinition
  });
  if (!resolution.ok) {
    return resolution;
  }

  const { moduleState, definition, repository } = resolution.context;
  const validation = validateModuleSettingsPatch(definition, payload);
  if (!validation.ok) {
    return {
      ok: false,
      statusCode: 400,
      payload: buildModuleSettingsValidationFailurePayload(validation)
    };
  }

  let writeResult;
  try {
    writeResult = await repository.transact(async (workingState) => {
      const currentSettings = normalizeModuleSettingsStateForRead(
        definition,
        asModuleSettingsState(workingState[moduleId])
      );
      const mergedSettings = mergeModuleSettingsPatch(
        definition,
        currentSettings,
        validation.value
      );
      if (!mergedSettings.ok) {
        return {
          commit: false,
          value: {
            ok: false,
            statusCode: 400,
            error: mergedSettings.error
          }
        };
      }

      workingState[moduleId] = mergedSettings.value;
      return {
        commit: true,
        value: {
          ok: true,
          settings: mergedSettings.value
        }
      };
    });
  } catch (error) {
    return {
      ok: false,
      statusCode: 500,
      payload: buildModuleSettingsPersistenceErrorPayload(moduleId, "write", error)
    };
  }

  if (!writeResult?.ok) {
    return {
      ok: false,
      statusCode: writeResult?.statusCode ?? 400,
      payload: {
        ok: false,
        error: {
          code: writeResult?.error?.code ?? "MODULE_SETTINGS_WRITE_INVALID",
          message: writeResult?.error?.message ?? "Module settings update failed"
        },
        validation: writeResult?.error ?? null,
        timestamp: new Date().toISOString()
      }
    };
  }

  const normalizedSettings = normalizeModuleSettingsStateForRead(
    definition,
    writeResult.settings ?? createDefaultModuleSettings(definition)
  );
  const readPayload = buildModuleSettingsReadPayload(definition, normalizedSettings);

  return {
    ok: true,
    value: {
      moduleId,
      state: moduleState,
      settings: readPayload
    }
  };
}
