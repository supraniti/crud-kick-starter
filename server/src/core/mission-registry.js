function createDiagnostic(code, message, details = {}) {
  return {
    code,
    message,
    ...details
  };
}

const MISSION_PAYLOAD_FIELD_TYPES = new Set(["text", "number", "boolean", "enum"]);

function normalizeDiagnosticEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries.filter((entry) => entry && typeof entry === "object").map((entry) => ({ ...entry }));
}

function cloneMissionPayloadField(field) {
  const cloned = { ...field };
  if (Array.isArray(field.options)) {
    cloned.options = field.options.map((option) => ({ ...option }));
  }
  return cloned;
}

function cloneMissionPayload(payload) {
  return {
    ...payload,
    fields: Array.isArray(payload.fields)
      ? payload.fields.map((field) => cloneMissionPayloadField(field))
      : []
  };
}

function cloneMission(mission) {
  const cloned = { ...mission };
  if (mission && typeof mission.payload === "object" && mission.payload !== null) {
    cloned.payload = cloneMissionPayload(mission.payload);
  }
  return cloned;
}

function createRegistrationError(missionId, moduleId, message, details = {}) {
  return createDiagnostic("MISSION_REGISTRATION_INVALID", message, {
    missionId,
    moduleId,
    ...details
  });
}

function normalizePayloadFieldOptions(missionId, moduleId, fieldId, options) {
  if (!Array.isArray(options) || options.length === 0) {
    throw createRegistrationError(
      missionId,
      moduleId,
      `Mission '${missionId}' payload field '${fieldId}' enum options must be a non-empty array`,
      {
        fieldId
      }
    );
  }

  const seenValues = new Set();
  return options.map((option, optionIndex) => {
    if (!option || typeof option !== "object") {
      throw createRegistrationError(
        missionId,
        moduleId,
        `Mission '${missionId}' payload field '${fieldId}' enum option at index ${optionIndex} must be an object`,
        {
          fieldId,
          optionIndex
        }
      );
    }

    const value = typeof option.value === "string" ? option.value.trim() : "";
    if (value.length === 0) {
      throw createRegistrationError(
        missionId,
        moduleId,
        `Mission '${missionId}' payload field '${fieldId}' enum option at index ${optionIndex} requires a non-empty string value`,
        {
          fieldId,
          optionIndex
        }
      );
    }

    if (seenValues.has(value)) {
      throw createRegistrationError(
        missionId,
        moduleId,
        `Mission '${missionId}' payload field '${fieldId}' enum option '${value}' is duplicated`,
        {
          fieldId,
          optionIndex,
          optionValue: value
        }
      );
    }
    seenValues.add(value);

    return {
      value,
      label: typeof option.label === "string" && option.label.trim().length > 0 ? option.label : value
    };
  });
}

function normalizePayloadFieldDefaultValue(
  missionId,
  moduleId,
  fieldId,
  fieldType,
  defaultValue,
  options = []
) {
  if (defaultValue === undefined) {
    if (fieldType === "boolean") {
      return false;
    }
    return null;
  }

  if (defaultValue === null) {
    return null;
  }

  if (fieldType === "text") {
    if (typeof defaultValue !== "string") {
      throw createRegistrationError(
        missionId,
        moduleId,
        `Mission '${missionId}' payload field '${fieldId}' defaultValue must be a string or null`,
        {
          fieldId
        }
      );
    }
    return defaultValue;
  }

  if (fieldType === "number") {
    if (typeof defaultValue !== "number" || !Number.isFinite(defaultValue)) {
      throw createRegistrationError(
        missionId,
        moduleId,
        `Mission '${missionId}' payload field '${fieldId}' defaultValue must be a finite number or null`,
        {
          fieldId
        }
      );
    }
    return defaultValue;
  }

  if (fieldType === "boolean") {
    if (typeof defaultValue !== "boolean") {
      throw createRegistrationError(
        missionId,
        moduleId,
        `Mission '${missionId}' payload field '${fieldId}' defaultValue must be a boolean or null`,
        {
          fieldId
        }
      );
    }
    return defaultValue;
  }

  if (fieldType === "enum") {
    if (typeof defaultValue !== "string") {
      throw createRegistrationError(
        missionId,
        moduleId,
        `Mission '${missionId}' payload field '${fieldId}' defaultValue must be a string or null`,
        {
          fieldId
        }
      );
    }

    const optionValues = new Set(options.map((option) => option.value));
    if (!optionValues.has(defaultValue)) {
      throw createRegistrationError(
        missionId,
        moduleId,
        `Mission '${missionId}' payload field '${fieldId}' defaultValue '${defaultValue}' is not in enum options`,
        {
          fieldId,
          defaultValue
        }
      );
    }

    return defaultValue;
  }

  return null;
}

function normalizePayloadField(missionId, moduleId, field, fieldIndex) {
  if (!field || typeof field !== "object") {
    throw createRegistrationError(
      missionId,
      moduleId,
      `Mission '${missionId}' payload field at index ${fieldIndex} must be an object`,
      {
        fieldIndex
      }
    );
  }

  const fieldId = typeof field.id === "string" ? field.id.trim() : "";
  if (fieldId.length === 0) {
    throw createRegistrationError(
      missionId,
      moduleId,
      `Mission '${missionId}' payload field at index ${fieldIndex} requires a non-empty id`,
      {
        fieldIndex
      }
    );
  }

  const fieldType = typeof field.type === "string" ? field.type.trim() : "";
  if (!MISSION_PAYLOAD_FIELD_TYPES.has(fieldType)) {
    throw createRegistrationError(
      missionId,
      moduleId,
      `Mission '${missionId}' payload field '${fieldId}' type '${fieldType || "<empty>"}' is invalid`,
      {
        fieldId,
        fieldType
      }
    );
  }

  const normalizedOptions =
    fieldType === "enum"
      ? normalizePayloadFieldOptions(missionId, moduleId, fieldId, field.options)
      : [];

  return {
    id: fieldId,
    label: typeof field.label === "string" && field.label.trim().length > 0 ? field.label : fieldId,
    type: fieldType,
    required: field.required === true,
    description: typeof field.description === "string" ? field.description : "",
    placeholder: typeof field.placeholder === "string" ? field.placeholder : "",
    defaultValue: normalizePayloadFieldDefaultValue(
      missionId,
      moduleId,
      fieldId,
      fieldType,
      field.defaultValue,
      normalizedOptions
    ),
    ...(normalizedOptions.length > 0
      ? {
          options: normalizedOptions
        }
      : {})
  };
}

function normalizeMissionPayloadMetadata(missionId, moduleId, mission) {
  if (!Object.prototype.hasOwnProperty.call(mission, "payload")) {
    return null;
  }

  const payload = mission.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw createRegistrationError(
      missionId,
      moduleId,
      `Mission '${missionId}' payload metadata must be an object`
    );
  }

  const rawFields = payload.fields ?? [];
  if (!Array.isArray(rawFields)) {
    throw createRegistrationError(
      missionId,
      moduleId,
      `Mission '${missionId}' payload fields must be an array`
    );
  }

  const seenFieldIds = new Set();
  const fields = rawFields.map((field, fieldIndex) => {
    const normalizedField = normalizePayloadField(missionId, moduleId, field, fieldIndex);
    if (seenFieldIds.has(normalizedField.id)) {
      throw createRegistrationError(
        missionId,
        moduleId,
        `Mission '${missionId}' payload field '${normalizedField.id}' is duplicated`,
        {
          fieldId: normalizedField.id
        }
      );
    }
    seenFieldIds.add(normalizedField.id);
    return normalizedField;
  });

  return {
    fields
  };
}

function normalizeMissionDefinition(missionId, moduleId, mission) {
  const payload = normalizeMissionPayloadMetadata(missionId, moduleId, mission);

  return {
    ...mission,
    label: typeof mission.label === "string" && mission.label.length > 0 ? mission.label : missionId,
    description: typeof mission.description === "string" ? mission.description : "",
    payload,
    validatePayload: typeof mission.validatePayload === "function" ? mission.validatePayload : null
  };
}

function registerMissionEntry(missions, registrationDiagnostics, { missionId, moduleId, mission }) {
  if (typeof missionId !== "string" || missionId.length === 0) {
    const diagnostic = createDiagnostic(
      "MISSION_REGISTRATION_INVALID",
      "Mission registration requires a non-empty missionId",
      {
        moduleId: moduleId ?? null
      }
    );
    registrationDiagnostics.push(diagnostic);
    return {
      ok: false,
      error: diagnostic
    };
  }

  if (typeof moduleId !== "string" || moduleId.length === 0) {
    const diagnostic = createDiagnostic(
      "MISSION_REGISTRATION_INVALID",
      `Mission '${missionId}' registration requires a non-empty moduleId`,
      {
        missionId,
        moduleId: moduleId ?? null
      }
    );
    registrationDiagnostics.push(diagnostic);
    return {
      ok: false,
      error: diagnostic
    };
  }

  if (!mission || typeof mission !== "object") {
    const diagnostic = createDiagnostic(
      "MISSION_REGISTRATION_INVALID",
      `Mission '${missionId}' registration requires a mission definition object`,
      {
        missionId,
        moduleId
      }
    );
    registrationDiagnostics.push(diagnostic);
    return {
      ok: false,
      error: diagnostic
    };
  }

  if (missions.has(missionId)) {
    const existing = missions.get(missionId);
    const diagnostic = createDiagnostic(
      "MISSION_DUPLICATE",
      `Mission '${missionId}' is already registered`,
      {
        missionId,
        moduleId,
        firstModuleId: existing.moduleId
      }
    );
    registrationDiagnostics.push(diagnostic);
    return {
      ok: false,
      error: diagnostic
    };
  }

  try {
    missions.set(missionId, {
      missionId,
      moduleId,
      mission: normalizeMissionDefinition(missionId, moduleId, mission)
    });
    return {
      ok: true
    };
  } catch (error) {
    const diagnostic =
      error && typeof error === "object" && typeof error.code === "string"
        ? error
        : createDiagnostic(
            "MISSION_REGISTRATION_INVALID",
            `Mission '${missionId}' registration normalization failed`,
            {
              missionId,
              moduleId,
              errorMessage: error?.message ?? "Unknown normalization failure"
            }
          );
    registrationDiagnostics.push(diagnostic);
    return {
      ok: false,
      error: diagnostic
    };
  }
}

function getMissionEntry(missions, missionId) {
  const mission = missions.get(missionId)?.mission;
  if (!mission) {
    return null;
  }

  return cloneMission(mission);
}

function listMissionEntries(missions) {
  return [...missions.values()]
    .map((entry) => ({
      missionId: entry.missionId,
      moduleId: entry.moduleId,
      mission: cloneMission(entry.mission)
    }))
    .sort((left, right) => left.missionId.localeCompare(right.missionId));
}

function resolveMissionRegistryStatus(missions, registrationDiagnostics, options = {}) {
  const moduleRegistry = options.moduleRegistry ?? null;
  const extraDiagnostics = normalizeDiagnosticEntries(options.additionalDiagnostics);
  const entries = listMissionEntries(missions);
  const missionModuleMap = {};
  const activeMissionModuleMap = {};
  const diagnostics = [...registrationDiagnostics, ...extraDiagnostics];

  for (const entry of entries) {
    missionModuleMap[entry.missionId] = entry.moduleId;

    if (!moduleRegistry) {
      activeMissionModuleMap[entry.missionId] = entry.moduleId;
      continue;
    }

    const state = moduleRegistry.getState(entry.moduleId);
    if (state === null) {
      diagnostics.push(
        createDiagnostic(
          "MISSION_MODULE_NOT_DISCOVERED",
          `Mission '${entry.missionId}' module '${entry.moduleId}' is not discovered`,
          {
            missionId: entry.missionId,
            moduleId: entry.moduleId
          }
        )
      );
      continue;
    }

    if (state === "enabled") {
      activeMissionModuleMap[entry.missionId] = entry.moduleId;
    }
  }

  return {
    registeredMissionIds: entries.map((entry) => entry.missionId),
    activeRegisteredMissionIds: Object.keys(activeMissionModuleMap).sort(),
    missionModuleMap,
    activeMissionModuleMap,
    diagnostics
  };
}

export function createMissionRegistry() {
  const missions = new Map();
  const registrationDiagnostics = [];

  const register = (input) => registerMissionEntry(missions, registrationDiagnostics, input);
  const get = (missionId) => getMissionEntry(missions, missionId);
  const list = () => listMissionEntries(missions);
  const resolveStatus = (options = {}) =>
    resolveMissionRegistryStatus(missions, registrationDiagnostics, options);

  return {
    register,
    get,
    list,
    resolveStatus
  };
}
