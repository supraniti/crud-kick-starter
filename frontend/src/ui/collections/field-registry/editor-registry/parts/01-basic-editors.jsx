import {
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from "@mui/material";
import { normalizeMultiSelectValue } from "../../../constants.js";
import {
  normalizeFieldType,
  resolveComputedEditorValue,
  resolveComputedResolverMeta,
  toFieldControlId
} from "../../shared-utils.jsx";

function renderBooleanEditor({ field, formState, controlsDisabled, onChangeForm }) {
  const controlId = toFieldControlId(field, "form-checkbox");
  return (
    <FormControlLabel
      key={field.id}
      sx={{ minHeight: 40 }}
      control={
        <Checkbox
          id={controlId}
          checked={formState[field.id] === true}
          disabled={controlsDisabled}
          onChange={(event) => onChangeForm(field.id, event.target.checked)}
          inputProps={{
            "aria-label": field.label,
            name: field.id
          }}
        />
      }
      label={<Typography variant="body2">{field.label}</Typography>}
    />
  );
}

function renderEnumEditor({ field, formState, controlsDisabled, onChangeForm }) {
  const labelId = toFieldControlId(field, "form-label");
  const selectId = toFieldControlId(field, "form-select");

  return (
    <FormControl key={field.id} size="small" sx={{ minWidth: 220 }}>
      <InputLabel id={labelId}>{field.label}</InputLabel>
      <Select
        id={selectId}
        labelId={labelId}
        label={field.label}
        value={formState[field.id] ?? ""}
        disabled={controlsDisabled}
        onChange={(event) => onChangeForm(field.id, event.target.value)}
        inputProps={{
          name: field.id
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

function renderEnumMultiEditor({ field, formState, controlsDisabled, onChangeForm }) {
  const labelId = toFieldControlId(field, "form-label");
  const selectId = toFieldControlId(field, "form-select");

  return (
    <FormControl key={field.id} size="small" sx={{ minWidth: 260 }}>
      <InputLabel id={labelId}>{field.label}</InputLabel>
      <Select
        id={selectId}
        labelId={labelId}
        label={field.label}
        multiple
        value={formState[field.id] ?? []}
        disabled={controlsDisabled}
        onChange={(event) => onChangeForm(field.id, normalizeMultiSelectValue(event.target.value))}
        inputProps={{
          name: field.id
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

function renderNumberEditor({ field, formState, controlsDisabled, onChangeForm }) {
  const controlId = toFieldControlId(field, "form-input");
  return (
    <TextField
      key={field.id}
      id={controlId}
      name={field.id}
      size="small"
      label={field.label}
      type="number"
      value={formState[field.id] ?? ""}
      disabled={controlsDisabled}
      onChange={(event) => onChangeForm(field.id, event.target.value)}
      inputProps={{ min: field.min, max: field.max }}
    />
  );
}

function renderTextEditor({ field, formState, controlsDisabled, onChangeForm }) {
  const controlId = toFieldControlId(field, "form-input");
  return (
    <TextField
      key={field.id}
      id={controlId}
      name={field.id}
      size="small"
      label={field.label}
      fullWidth
      value={formState[field.id] ?? ""}
      disabled={controlsDisabled}
      onChange={(event) => onChangeForm(field.id, event.target.value)}
    />
  );
}

function renderPluginTextInputEditor({
  field,
  formState,
  controlsDisabled,
  onChangeForm,
  inputType = "text",
  fullWidth = false,
  inputLabelShrink = false
}) {
  const controlId = toFieldControlId(field, "form-input");
  const inputLabelProps = inputLabelShrink ? { shrink: true } : undefined;
  return (
    <TextField
      key={field.id}
      id={controlId}
      name={field.id}
      size="small"
      label={field.label}
      type={inputType}
      fullWidth={fullWidth}
      value={formState[field.id] ?? ""}
      disabled={controlsDisabled}
      onChange={(event) => onChangeForm(field.id, event.target.value)}
      InputLabelProps={inputLabelProps}
    />
  );
}

function renderComputedEditor({ field, formState }) {
  const controlId = toFieldControlId(field, "form-input");
  const sourceField =
    typeof field?.source === "string" && field.source.length > 0 ? field.source : "source field";
  const { resolver } = resolveComputedResolverMeta(field);

  return (
    <TextField
      key={field.id}
      id={controlId}
      name={field.id}
      size="small"
      label={field.label}
      fullWidth
      value={resolveComputedEditorValue(field, formState)}
      disabled
      helperText={`Computed from ${sourceField} using ${resolver}.`}
    />
  );
}

function renderUnsupportedEditor({ field, formState }) {
  const fieldType = normalizeFieldType(field) || "unknown";
  const controlId = toFieldControlId(field, "form-input");
  return (
    <TextField
      key={field.id}
      id={controlId}
      name={field.id}
      size="small"
      label={field.label}
      fullWidth
      value={typeof formState[field.id] === "string" ? formState[field.id] : ""}
      disabled
      helperText={`Unsupported field type '${fieldType}'. Rendering is blocked.`}
    />
  );
}

export {
  renderBooleanEditor,
  renderComputedEditor,
  renderEnumEditor,
  renderEnumMultiEditor,
  renderNumberEditor,
  renderPluginTextInputEditor,
  renderTextEditor,
  renderUnsupportedEditor
};
