function normalizeFieldOption(option) {
  if (typeof option === "string") {
    const value = option.trim();
    if (value.length > 0) {
      return {
        value,
        label: value
      };
    }
    return null;
  }

  if (!option || typeof option !== "object") {
    return null;
  }

  const rawValue = typeof option.value === "string" ? option.value.trim() : "";
  if (rawValue.length === 0) {
    return null;
  }

  const rawLabel = typeof option.label === "string" ? option.label.trim() : "";
  return {
    value: rawValue,
    label: rawLabel.length > 0 ? rawLabel : rawValue
  };
}

function findSchemaField(schemaCollection, fieldId) {
  if (!Array.isArray(schemaCollection?.fields)) {
    return null;
  }

  return schemaCollection.fields.find((field) => field?.id === fieldId) ?? null;
}

function resolveEnumFieldOptions(schemaCollection, fieldId, fallbackValues = []) {
  const field = findSchemaField(schemaCollection, fieldId);
  if (!Array.isArray(field?.options)) {
    return fallbackValues.map((value) => ({
      value,
      label: value
    }));
  }

  const normalizedOptions = field.options
    .map(normalizeFieldOption)
    .filter((option) => option !== null);

  if (normalizedOptions.length > 0) {
    return normalizedOptions;
  }

  return fallbackValues.map((value) => ({
    value,
    label: value
  }));
}

function resolveNumericFieldRange(schemaCollection, fieldId, fallbackRange) {
  const field = findSchemaField(schemaCollection, fieldId);
  const min =
    typeof field?.min === "number" && Number.isFinite(field.min) ? field.min : fallbackRange.min;
  const max =
    typeof field?.max === "number" && Number.isFinite(field.max) ? field.max : fallbackRange.max;

  return {
    min,
    max
  };
}

export { resolveEnumFieldOptions, resolveNumericFieldRange };
