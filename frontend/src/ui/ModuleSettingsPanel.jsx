import {
  Alert,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";

function ModuleSettingsPanel({
  moduleId,
  moduleSettingsState,
  moduleSettingsMeta = null,
  moduleSettingsPersistencePolicy = null,
  onChangeField,
  onSave
}) {
  if (!moduleId) {
    return null;
  }

  const toFieldPathToken = (fieldPath = "") =>
    `${fieldPath}`.replace(/[^a-zA-Z0-9_-]/g, "-");
  const toNestedFieldControlId = (fieldPath, suffix = "input") =>
    `${moduleId}-${toFieldPathToken(fieldPath)}-settings-${suffix}`;
  const resolveEnumOptionLabel = (field, value) => {
    return (field.options ?? []).find((option) => option.value === value)?.label ?? value;
  };
  const cloneValue = (value) => {
    if (value === null || value === undefined) {
      return value;
    }
    if (typeof value !== "object") {
      return value;
    }
    try {
      return structuredClone(value);
    } catch {
      return JSON.parse(JSON.stringify(value));
    }
  };
  const renderSettingsField = ({
    field,
    fieldPath,
    value,
    onChangeValue
  }) => {
    const fieldLabel = `${field.label}${field.sensitive ? " (sensitive)" : ""}`;
    const controlId = toNestedFieldControlId(fieldPath);

    if (field.type === "object") {
      const nestedValue =
        value && typeof value === "object" && !Array.isArray(value) ? value : {};
      return (
        <Paper key={fieldPath} variant="outlined" sx={{ p: 1.5 }}>
          <Stack spacing={1.25}>
            <Typography variant="subtitle2">{fieldLabel}</Typography>
            {(field.fields ?? []).map((nestedField) =>
              renderSettingsField({
                field: nestedField,
                fieldPath: `${fieldPath}.${nestedField.id}`,
                value: nestedValue[nestedField.id],
                onChangeValue: (nextNestedValue) =>
                  onChangeValue({
                    ...nestedValue,
                    [nestedField.id]: cloneValue(nextNestedValue)
                  })
              })
            )}
          </Stack>
        </Paper>
      );
    }

    if (field.type === "boolean") {
      return (
        <FormControlLabel
          key={fieldPath}
          sx={{ minHeight: 40 }}
          control={
            <Checkbox
              id={controlId}
              checked={value === true}
              onChange={(event) => onChangeValue(event.target.checked)}
              inputProps={{
                "aria-label": fieldLabel,
                name: fieldPath
              }}
            />
          }
          label={<Typography variant="body2">{fieldLabel}</Typography>}
        />
      );
    }

    if (field.type === "enum") {
      const labelId = toNestedFieldControlId(fieldPath, "label");
      return (
        <FormControl key={fieldPath} size="small" sx={{ minWidth: 220 }}>
          <InputLabel id={labelId}>{field.label}</InputLabel>
          <Select
            id={controlId}
            labelId={labelId}
            label={field.label}
            value={value ?? ""}
            onChange={(event) => onChangeValue(event.target.value)}
            inputProps={{
              name: fieldPath
            }}
          >
            {(field.options ?? []).map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }

    if (field.type === "enum-multi") {
      const labelId = toNestedFieldControlId(fieldPath, "label");
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <FormControl key={fieldPath} size="small" sx={{ minWidth: 220 }}>
          <InputLabel id={labelId}>{field.label}</InputLabel>
          <Select
            id={controlId}
            labelId={labelId}
            label={field.label}
            multiple
            value={selectedValues}
            onChange={(event) =>
              onChangeValue(
                Array.isArray(event.target.value)
                  ? event.target.value
                  : [event.target.value]
              )
            }
            renderValue={(selected) =>
              selected.map((entry) => resolveEnumOptionLabel(field, entry)).join(", ")
            }
            inputProps={{
              name: fieldPath
            }}
          >
            {(field.options ?? []).map((option) => {
              const selected = selectedValues.includes(option.value);
              return (
                <MenuItem key={option.value} value={option.value}>
                  <Checkbox checked={selected} />
                  {option.label}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      );
    }

    if (field.type === "number") {
      return (
        <TextField
          key={fieldPath}
          id={controlId}
          name={fieldPath}
          size="small"
          label={field.label}
          type="number"
          value={value ?? ""}
          onChange={(event) => onChangeValue(event.target.value)}
          inputProps={{ min: field.min, max: field.max }}
        />
      );
    }

    if (field.type === "date") {
      return (
        <TextField
          key={fieldPath}
          id={controlId}
          name={fieldPath}
          size="small"
          type="date"
          label={fieldLabel}
          value={value ?? ""}
          onChange={(event) => onChangeValue(event.target.value)}
          autoComplete="off"
          InputLabelProps={{ shrink: true }}
          helperText={field.description ?? ""}
        />
      );
    }

    if (field.type === "url") {
      return (
        <TextField
          key={fieldPath}
          id={controlId}
          name={fieldPath}
          size="small"
          type="url"
          label={fieldLabel}
          value={value ?? ""}
          onChange={(event) => onChangeValue(event.target.value)}
          autoComplete="off"
          placeholder="https://example.com"
          helperText={field.description ?? ""}
        />
      );
    }

    return (
      <TextField
        key={fieldPath}
        id={controlId}
        name={fieldPath}
        size="small"
        type={field.sensitive ? "password" : "text"}
        label={fieldLabel}
        value={value ?? ""}
        onChange={(event) => onChangeValue(event.target.value)}
        autoComplete={field.sensitive ? "new-password" : "off"}
        placeholder={
          field.sensitive
            ? "Leave blank to keep current value"
            : undefined
        }
        helperText={
          field.sensitive
            ? "Stored value is redacted. Enter a new value to rotate."
            : field.description ?? ""
        }
      />
    );
  };
  const handleSaveSubmit = (event) => {
    event.preventDefault();
    onSave();
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack component="form" spacing={1.5} onSubmit={handleSaveSubmit} noValidate>
        <Typography variant="subtitle2">Module Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure persisted settings for module <strong>{moduleId}</strong>.
        </Typography>

        {moduleSettingsMeta ? (
          <Alert severity={moduleSettingsMeta.state === "enabled" ? "info" : "warning"}>
            Module state: <strong>{moduleSettingsMeta.state ?? "unknown"}</strong>. Settings remain
            available in installed/enabled/disabled states.
          </Alert>
        ) : null}
        {moduleSettingsPersistencePolicy ? (
          <Alert severity={moduleSettingsPersistencePolicy.active ? "info" : "warning"}>
            Settings persistence mode:{" "}
            <strong>{moduleSettingsPersistencePolicy.runtimeMode ?? "unknown"}</strong> (configured:{" "}
            <strong>{moduleSettingsPersistencePolicy.configuredMode ?? "unknown"}</strong>, source:{" "}
            <strong>{moduleSettingsPersistencePolicy.source ?? "unknown"}</strong>, runtime active:{" "}
            <strong>{moduleSettingsPersistencePolicy.active ? "yes" : "no"}</strong>)
          </Alert>
        ) : null}

        {moduleSettingsState.loading ? (
          <Typography variant="body2">Loading module settings...</Typography>
        ) : null}
        {moduleSettingsState.errorMessage ? (
          <Alert severity="error">{moduleSettingsState.errorMessage}</Alert>
        ) : null}
        {moduleSettingsState.successMessage ? (
          <Alert severity="success">{moduleSettingsState.successMessage}</Alert>
        ) : null}

        {(moduleSettingsState.schema.fields ?? []).map((field) =>
          renderSettingsField({
            field,
            fieldPath: field.id,
            value: moduleSettingsState.draftValues[field.id],
            onChangeValue: (nextValue) => onChangeField(field.id, cloneValue(nextValue))
          })
        )}

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            type="submit"
            disabled={moduleSettingsState.loading || moduleSettingsState.saving}
          >
            {moduleSettingsState.saving ? "Saving..." : "Save settings"}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export { ModuleSettingsPanel };
