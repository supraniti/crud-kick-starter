import {
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
import {
  defaultStructuredObjectValue
} from "../../../../../runtime/shared-capability-bridges/structured-field-runtime.mjs";
import {
  cloneJsonValue,
  ensureStructuredObjectArrayValue,
  ensureStructuredObjectValue,
  normalizeStringListInputValue,
  resolveStructuredObjectArrayConstraints,
  resolveStructuredObjectSchema,
  updateStructuredObjectValueByPath
} from "./03-structured-value-helpers.jsx";

function renderStructuredPropertyEditor({
  controlKey,
  controlPath,
  property,
  objectValue,
  controlsDisabled,
  onChangeObjectValue
}) {
  const fieldLabel =
    typeof property?.label === "string" && property.label.length > 0
      ? property.label
      : property.id;
  const propertyValue =
    objectValue && typeof objectValue === "object" ? objectValue[property.id] : undefined;
  const fullPath = [...controlPath, property.id];
  const inputId = `${fullPath.join("-")}-structured-input`;

  if (property.type === "boolean") {
    return (
      <FormControlLabel
        key={controlKey}
        sx={{ minHeight: 36 }}
        control={
          <Checkbox
            id={inputId}
            checked={propertyValue === true}
            disabled={controlsDisabled}
            onChange={(event) =>
              onChangeObjectValue(fullPath, event.target.checked === true)
            }
            inputProps={{
              "aria-label": fieldLabel
            }}
          />
        }
        label={<Typography variant="body2">{fieldLabel}</Typography>}
      />
    );
  }

  if (property.type === "enum") {
    const labelId = `${inputId}-label`;
    return (
      <FormControl key={controlKey} size="small" sx={{ minWidth: 220 }}>
        <InputLabel id={labelId}>{fieldLabel}</InputLabel>
        <Select
          id={inputId}
          labelId={labelId}
          label={fieldLabel}
          value={typeof propertyValue === "string" ? propertyValue : ""}
          disabled={controlsDisabled}
          onChange={(event) => onChangeObjectValue(fullPath, event.target.value)}
          inputProps={{
            name: fullPath.join(".")
          }}
        >
          <MenuItem value="">None</MenuItem>
          {(property.options ?? []).map((optionValue) => (
            <MenuItem key={`${inputId}-${optionValue}`} value={optionValue}>
              {optionValue}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  if (property.type === "string-list") {
    const joinedValue = Array.isArray(propertyValue) ? propertyValue.join(", ") : "";
    return (
      <TextField
        key={controlKey}
        id={inputId}
        size="small"
        fullWidth
        label={fieldLabel}
        value={joinedValue}
        disabled={controlsDisabled}
        onChange={(event) =>
          onChangeObjectValue(fullPath, normalizeStringListInputValue(event.target.value))
        }
        helperText="Comma-separated values"
      />
    );
  }

  if (property.type === "group") {
    const nestedSchema = {
      properties: Array.isArray(property.properties) ? property.properties : []
    };
    const nestedValue =
      propertyValue && typeof propertyValue === "object" && !Array.isArray(propertyValue)
        ? propertyValue
        : defaultStructuredObjectValue(nestedSchema);
    return (
      <Paper key={controlKey} variant="outlined" sx={{ p: 1.25 }}>
        <Stack spacing={1}>
          <Typography variant="caption" color="text.secondary">
            {fieldLabel}
          </Typography>
          {nestedSchema.properties.map((nestedProperty) =>
            renderStructuredPropertyEditor({
              controlKey: `${controlKey}-${nestedProperty.id}`,
              controlPath: fullPath,
              property: nestedProperty,
              objectValue: nestedValue,
              controlsDisabled,
              onChangeObjectValue
            })
          )}
        </Stack>
      </Paper>
    );
  }

  if (property.type === "number") {
    return (
      <TextField
        key={controlKey}
        id={inputId}
        size="small"
        label={fieldLabel}
        type="number"
        value={propertyValue ?? ""}
        disabled={controlsDisabled}
        onChange={(event) => {
          const rawValue = event.target.value;
          const trimmedValue = typeof rawValue === "string" ? rawValue.trim() : "";
          if (trimmedValue.length === 0) {
            onChangeObjectValue(fullPath, null);
            return;
          }

          const parsedValue = Number.parseFloat(trimmedValue);
          onChangeObjectValue(
            fullPath,
            Number.isFinite(parsedValue) ? parsedValue : null
          );
        }}
        inputProps={{ min: property.min, max: property.max }}
      />
    );
  }

  return (
    <TextField
      key={controlKey}
      id={inputId}
      size="small"
      fullWidth
      label={fieldLabel}
      value={typeof propertyValue === "string" ? propertyValue : ""}
      disabled={controlsDisabled}
      onChange={(event) => onChangeObjectValue(fullPath, event.target.value)}
    />
  );
}

function renderStructuredObjectEditor({ field, formState, controlsDisabled, onChangeForm }) {
  const objectSchema = resolveStructuredObjectSchema(field);
  const objectValue = ensureStructuredObjectValue(field, formState[field.id]);
  const onChangeObjectValue = (path, nextValue) => {
    const nextObjectValue = updateStructuredObjectValueByPath(objectValue, path, nextValue);
    onChangeForm(field.id, nextObjectValue);
  };

  return (
    <Paper key={field.id} variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1.25}>
        <Typography variant="subtitle2">{field.label}</Typography>
        {objectSchema.properties.map((property) =>
          renderStructuredPropertyEditor({
            controlKey: `${field.id}-${property.id}`,
            controlPath: [],
            property,
            objectValue,
            controlsDisabled,
            onChangeObjectValue
          })
        )}
      </Stack>
    </Paper>
  );
}

function renderStructuredObjectArrayEditor({
  field,
  formState,
  controlsDisabled,
  onChangeForm
}) {
  const constraints = resolveStructuredObjectArrayConstraints(field);
  const rows = ensureStructuredObjectArrayValue(field, formState[field.id]);
  const itemLabel =
    typeof constraints.itemLabel === "string" && constraints.itemLabel.length > 0
      ? constraints.itemLabel
      : "item";

  const commitRows = (nextRows) => {
    onChangeForm(field.id, nextRows.map((row) => cloneJsonValue(row)));
  };

  const appendRow = () => {
    const nextRow = defaultStructuredObjectValue(constraints.itemSchema);
    commitRows([...rows, nextRow]);
  };

  const removeRow = (rowIndex) => {
    commitRows(rows.filter((_row, index) => index !== rowIndex));
  };

  const onChangeRowValue = (rowIndex, path, nextValue) => {
    const nextRows = rows.map((row, index) => {
      if (index !== rowIndex) {
        return row;
      }
      return updateStructuredObjectValueByPath(row, path, nextValue);
    });
    commitRows(nextRows);
  };

  return (
    <Paper key={field.id} variant="outlined" sx={{ p: 1.5 }}>
      <Stack spacing={1.25}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">{field.label}</Typography>
          <Button
            variant="outlined"
            size="small"
            disabled={controlsDisabled}
            onClick={appendRow}
          >
            Add {itemLabel}
          </Button>
        </Stack>
        {rows.length === 0 ? (
          <Typography variant="caption" color="text.secondary">
            No {itemLabel}s yet.
          </Typography>
        ) : null}
        {rows.map((row, rowIndex) => (
          <Paper key={`${field.id}-row-${rowIndex}`} variant="outlined" sx={{ p: 1.25 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
                <Typography variant="caption" color="text.secondary">
                  {itemLabel} #{rowIndex + 1}
                </Typography>
                <Button
                  size="small"
                  color="error"
                  disabled={controlsDisabled}
                  onClick={() => removeRow(rowIndex)}
                >
                  Remove
                </Button>
              </Stack>
              {(constraints.itemSchema?.properties ?? []).map((property) =>
                renderStructuredPropertyEditor({
                  controlKey: `${field.id}-row-${rowIndex}-${property.id}`,
                  controlPath: [],
                  property,
                  objectValue: row,
                  controlsDisabled,
                  onChangeObjectValue: (path, nextValue) =>
                    onChangeRowValue(rowIndex, path, nextValue)
                })
              )}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}

export {
  renderStructuredObjectArrayEditor,
  renderStructuredObjectEditor
};
