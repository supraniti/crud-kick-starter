const MISSIONS_MODULE_ID = "missions";
const MISSION_PAYLOAD_FIELD_TYPES = new Set(["text", "number", "boolean", "enum"]);

function createDefaultMissionsState() {
  return {
    loading: false,
    errorMessage: null,
    items: []
  };
}

function createDefaultRunFormState() {
  return {
    missionId: "",
    payloadValues: {},
    submitting: false,
    errorMessage: null,
    successMessage: null
  };
}

function createDefaultJobsState() {
  return {
    loading: false,
    errorMessage: null,
    successMessage: null,
    cancellingJobId: null,
    items: []
  };
}

function createDefaultJobDetailState() {
  return {
    loading: false,
    errorMessage: null,
    job: null
  };
}

function normalizeMissionPayloadFields(mission) {
  const payload = mission?.payload;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }

  const fields = Array.isArray(payload.fields) ? payload.fields : [];
  return fields
    .filter((field) => field && typeof field === "object")
    .map((field) => {
      const fieldId = typeof field.id === "string" ? field.id.trim() : "";
      if (fieldId.length === 0) {
        return null;
      }

      const fieldType = typeof field.type === "string" ? field.type.trim() : "text";
      const normalizedType = MISSION_PAYLOAD_FIELD_TYPES.has(fieldType) ? fieldType : "text";
      const options =
        normalizedType === "enum" && Array.isArray(field.options)
          ? field.options
              .filter((option) => option && typeof option === "object")
              .map((option) => ({
                value: typeof option.value === "string" ? option.value : "",
                label:
                  typeof option.label === "string" && option.label.trim().length > 0
                    ? option.label
                    : typeof option.value === "string"
                      ? option.value
                      : ""
              }))
              .filter((option) => option.value.length > 0)
          : [];

      return {
        id: fieldId,
        label: typeof field.label === "string" && field.label.trim().length > 0 ? field.label : fieldId,
        type: normalizedType,
        required: field.required === true,
        description: typeof field.description === "string" ? field.description : "",
        placeholder: typeof field.placeholder === "string" ? field.placeholder : "",
        defaultValue: field.defaultValue ?? null,
        options
      };
    })
    .filter(Boolean);
}

function resolveSelectedMission(missions, missionId) {
  if (!Array.isArray(missions) || missions.length === 0) {
    return null;
  }

  return (
    missions.find((item) => item.missionId === missionId) ??
    missions.find((item) => item.active) ??
    missions[0]
  );
}

function createDefaultFieldValue(field) {
  if (field.type === "boolean") {
    return field.defaultValue === true;
  }

  if (field.type === "number") {
    if (typeof field.defaultValue === "number" && Number.isFinite(field.defaultValue)) {
      return field.defaultValue;
    }
    return "";
  }

  if (field.type === "enum") {
    if (typeof field.defaultValue === "string" && field.defaultValue.length > 0) {
      return field.defaultValue;
    }
    return "";
  }

  if (typeof field.defaultValue === "string") {
    return field.defaultValue;
  }

  return "";
}

function normalizeFieldInputValue(field, value) {
  if (field.type === "boolean") {
    return value === true;
  }

  if (field.type === "number") {
    if (value === "" || value === null || value === undefined) {
      return "";
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    return `${value}`;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return typeof value === "string" ? value : `${value}`;
}

function buildPayloadValues(fields, existingValues = null) {
  const values = {};
  for (const field of fields) {
    if (existingValues && Object.prototype.hasOwnProperty.call(existingValues, field.id)) {
      values[field.id] = normalizeFieldInputValue(field, existingValues[field.id]);
      continue;
    }
    values[field.id] = createDefaultFieldValue(field);
  }
  return values;
}

function haveSamePayloadValues(left = {}, right = {}) {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) {
    return false;
  }

  for (const key of leftKeys) {
    if (!Object.prototype.hasOwnProperty.call(right, key)) {
      return false;
    }
    if (left[key] !== right[key]) {
      return false;
    }
  }

  return true;
}

function buildMissionPayload(fields, payloadValues) {
  const payload = {};

  for (const field of fields) {
    const rawValue = payloadValues?.[field.id];

    if (field.type === "boolean") {
      payload[field.id] = rawValue === true;
      continue;
    }

    if (field.type === "number") {
      if (rawValue === "" || rawValue === null || rawValue === undefined) {
        payload[field.id] = null;
        continue;
      }

      if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
        payload[field.id] = rawValue;
        continue;
      }

      const parsed = Number(rawValue);
      payload[field.id] = Number.isFinite(parsed) ? parsed : rawValue;
      continue;
    }

    if (rawValue === null || rawValue === undefined) {
      payload[field.id] = null;
      continue;
    }

    const normalizedText = typeof rawValue === "string" ? rawValue : `${rawValue}`;
    payload[field.id] = normalizedText.length > 0 ? normalizedText : null;
  }

  return payload;
}

function formatSubmissionError(payload) {
  const errorCode = payload?.error?.code ?? "MISSION_SUBMIT_FAILED";
  const errorMessage = payload?.error?.message ?? "Mission execution was rejected";
  const validationCode = payload?.validation?.code;
  const validationSuffix =
    typeof validationCode === "string" && validationCode.length > 0 && validationCode !== errorCode
      ? ` (${validationCode})`
      : "";

  return `[${errorCode}] ${errorMessage}${validationSuffix}`;
}

export {
  MISSIONS_MODULE_ID,
  buildMissionPayload,
  buildPayloadValues,
  createDefaultJobDetailState,
  createDefaultJobsState,
  createDefaultMissionsState,
  createDefaultRunFormState,
  formatSubmissionError,
  haveSamePayloadValues,
  normalizeMissionPayloadFields,
  resolveSelectedMission
};
