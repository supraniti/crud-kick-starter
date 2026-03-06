import {
  resolveCollectionFieldTypePlugin
} from "../../../collection-field-type-plugin-registry.mjs";
import {
  valuesEqual
} from "../../../value-contract-utils.mjs";

function resolveRawFieldDefaultValue(field = {}) {
  const hasDefault = Object.prototype.hasOwnProperty.call(field, "default");
  const hasDefaultValue = Object.prototype.hasOwnProperty.call(field, "defaultValue");

  if (!hasDefault && !hasDefaultValue) {
    return {
      ok: true,
      hasDefault: false,
      value: undefined
    };
  }

  if (hasDefault && hasDefaultValue && !valuesEqual(field.default, field.defaultValue)) {
    return {
      ok: false,
      reason: "default and defaultValue must match when both are provided"
    };
  }

  return {
    ok: true,
    hasDefault: true,
    value: hasDefaultValue ? field.defaultValue : field.default
  };
}

function normalizeNullDefaultValue(descriptor) {
  if (descriptor.required === true) {
    return {
      ok: false,
      reason: "required fields cannot use null as defaultValue"
    };
  }
  return {
    ok: true,
    value: null
  };
}

function normalizeTextDefaultValue(descriptor, rawValue) {
  if (typeof rawValue !== "string") {
    return {
      ok: false,
      reason: "defaultValue must be a string or null"
    };
  }
  const normalized = rawValue.trim();
  if (descriptor.required === true && normalized.length === 0) {
    return {
      ok: false,
      reason: "defaultValue cannot be empty when field is required"
    };
  }
  if (Number.isInteger(descriptor.minLength) && normalized.length < descriptor.minLength) {
    return {
      ok: false,
      reason: `defaultValue must be at least ${descriptor.minLength} characters`
    };
  }
  if (Number.isInteger(descriptor.maxLength) && normalized.length > descriptor.maxLength) {
    return {
      ok: false,
      reason: `defaultValue must be at most ${descriptor.maxLength} characters`
    };
  }
  return {
    ok: true,
    value: normalized
  };
}

function normalizePluginDefaultValue(descriptor, rawValue) {
  const fieldTypePlugin = resolveCollectionFieldTypePlugin(descriptor.type);
  if (!fieldTypePlugin || typeof fieldTypePlugin.normalizeDefaultValue !== "function") {
    return null;
  }

  const normalizedDefault = fieldTypePlugin.normalizeDefaultValue(descriptor, rawValue);
  if (!normalizedDefault || normalizedDefault.ok !== true) {
    return {
      ok: false,
      reason: normalizedDefault?.reason ?? "defaultValue must be a string or null"
    };
  }

  return {
    ok: true,
    value: normalizedDefault.value
  };
}

function normalizeNumberDefaultValue(descriptor, rawValue) {
  if (!Number.isFinite(rawValue)) {
    return {
      ok: false,
      reason: "defaultValue must be a finite number or null"
    };
  }
  if (Number.isFinite(descriptor.min) && rawValue < descriptor.min) {
    return {
      ok: false,
      reason: `defaultValue must be >= ${descriptor.min}`
    };
  }
  if (Number.isFinite(descriptor.max) && rawValue > descriptor.max) {
    return {
      ok: false,
      reason: `defaultValue must be <= ${descriptor.max}`
    };
  }
  return {
    ok: true,
    value: rawValue
  };
}

function normalizeBooleanDefaultValue(_, rawValue) {
  if (typeof rawValue !== "boolean") {
    return {
      ok: false,
      reason: "defaultValue must be a boolean or null"
    };
  }
  return {
    ok: true,
    value: rawValue
  };
}

function normalizeEnumDefaultValue(descriptor, rawValue) {
  if (typeof rawValue !== "string") {
    return {
      ok: false,
      reason: "defaultValue must be a string or null"
    };
  }
  const normalized = rawValue.trim().toLowerCase();
  if (!descriptor.optionSet?.has(normalized)) {
    return {
      ok: false,
      reason: `defaultValue '${normalized}' is not in options`
    };
  }
  return {
    ok: true,
    value: normalized
  };
}

function normalizeStringArrayTokens(rawValue, options = {}) {
  if (!Array.isArray(rawValue)) {
    return {
      ok: false,
      reason: options.arrayTypeErrorReason
    };
  }
  const normalized = [];
  const seen = new Set();
  for (const [index, entry] of rawValue.entries()) {
    if (typeof entry !== "string") {
      return {
        ok: false,
        reason: `defaultValue[${index}] must be a string`
      };
    }
    const token = options.transformToken(entry);
    if (options.isInvalidToken(token)) {
      return {
        ok: false,
        reason: options.invalidTokenReason(token)
      };
    }
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    normalized.push(token);
  }
  return {
    ok: true,
    value: normalized
  };
}

function normalizeEnumMultiDefaultValue(descriptor, rawValue) {
  const normalizedResult = normalizeStringArrayTokens(rawValue, {
    arrayTypeErrorReason: "defaultValue must be an array of strings or null",
    transformToken: (entry) => entry.trim().toLowerCase(),
    isInvalidToken: (token) => !descriptor.optionSet?.has(token),
    invalidTokenReason: (token) => `defaultValue '${token}' is not in options`
  });
  if (!normalizedResult.ok) {
    return normalizedResult;
  }
  if (descriptor.required === true && normalizedResult.value.length === 0) {
    return {
      ok: false,
      reason: "defaultValue must include at least one value when field is required"
    };
  }
  return normalizedResult;
}

function normalizeReferenceDefaultValue(descriptor, rawValue) {
  if (typeof rawValue !== "string") {
    return {
      ok: false,
      reason: "defaultValue must be a string id or null"
    };
  }
  const normalized = rawValue.trim();
  if (descriptor.required === true && normalized.length === 0) {
    return {
      ok: false,
      reason: "defaultValue cannot be empty when field is required"
    };
  }
  return {
    ok: true,
    value: normalized.length > 0 ? normalized : null
  };
}

function normalizeReferenceMultiDefaultValue(descriptor, rawValue) {
  if (!Array.isArray(rawValue)) {
    return {
      ok: false,
      reason: "defaultValue must be an array of string ids or null"
    };
  }
  const normalized = [];
  const seen = new Set();
  for (const [index, entry] of rawValue.entries()) {
    if (typeof entry !== "string") {
      return {
        ok: false,
        reason: `defaultValue[${index}] must be a string`
      };
    }
    const token = entry.trim();
    if (token.length === 0 || seen.has(token)) {
      continue;
    }
    seen.add(token);
    normalized.push(token);
  }
  if (descriptor.required === true && normalized.length === 0) {
    return {
      ok: false,
      reason: "defaultValue must include at least one id when field is required"
    };
  }
  return {
    ok: true,
    value: normalized
  };
}

const DESCRIPTOR_DEFAULT_VALUE_NORMALIZERS = Object.freeze({
  text: normalizeTextDefaultValue,
  number: normalizeNumberDefaultValue,
  boolean: normalizeBooleanDefaultValue,
  enum: normalizeEnumDefaultValue,
  "enum-multi": normalizeEnumMultiDefaultValue,
  reference: normalizeReferenceDefaultValue,
  "reference-multi": normalizeReferenceMultiDefaultValue
});

function normalizeDescriptorDefaultValue(descriptor, rawValue) {
  if (!descriptor || typeof descriptor !== "object") {
    return {
      ok: false,
      reason: "field descriptor is invalid"
    };
  }

  if (descriptor.type === "computed") {
    return {
      ok: false,
      reason: "computed fields do not support defaultValue/default"
    };
  }

  if (rawValue === null) {
    return normalizeNullDefaultValue(descriptor);
  }

  const pluginDefaultValue = normalizePluginDefaultValue(descriptor, rawValue);
  if (pluginDefaultValue) {
    return pluginDefaultValue;
  }

  const normalizer = DESCRIPTOR_DEFAULT_VALUE_NORMALIZERS[descriptor.type];
  if (typeof normalizer === "function") {
    return normalizer(descriptor, rawValue);
  }

  return {
    ok: true,
    value: rawValue
  };
}

export { normalizeDescriptorDefaultValue, resolveRawFieldDefaultValue };
