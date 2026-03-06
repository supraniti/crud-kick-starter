import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack
} from "@mui/material";
import { normalizeMultiSelectValue } from "../../../constants.js";
import {
  toFieldControlId,
  toReferenceInputLabel,
  toReferenceOptions
} from "../../shared-utils.jsx";

function resolveReferenceOptionLabel(field, item) {
  if (!item || typeof item !== "object") {
    return "";
  }

  if (
    typeof field?.labelField === "string" &&
    field.labelField.length > 0 &&
    typeof item[field.labelField] === "string" &&
    item[field.labelField].length > 0
  ) {
    return item[field.labelField];
  }

  return item.title ?? item.name ?? item.label ?? item.slug ?? item.id;
}

function valuesMatch(left, right) {
  if (left === right) {
    return true;
  }

  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  return `${left}` === `${right}`;
}

function resolveReferenceUiExpectedValue(rule, formState) {
  if (!rule || typeof rule !== "object") {
    return undefined;
  }

  if (
    typeof rule.sourceFieldId === "string" &&
    rule.sourceFieldId.length > 0 &&
    formState &&
    typeof formState === "object"
  ) {
    return formState[rule.sourceFieldId];
  }

  return rule.value;
}

function resolveReferenceItemsByUiRule(field, formState, optionsItems = []) {
  const optionsFilter = field?.referenceUi?.optionsFilter;
  if (!optionsFilter || typeof optionsFilter !== "object") {
    return optionsItems;
  }

  const expectedValue = resolveReferenceUiExpectedValue(optionsFilter, formState);
  if (
    expectedValue === undefined ||
    expectedValue === null ||
    (typeof expectedValue === "string" && expectedValue.trim().length === 0)
  ) {
    return [];
  }

  return optionsItems.filter((item) => {
    if (!item || typeof item !== "object") {
      return false;
    }

    const itemValue = item[optionsFilter.fieldId];
    if (Array.isArray(expectedValue)) {
      return expectedValue.some((candidate) => valuesMatch(itemValue, candidate));
    }
    return valuesMatch(itemValue, expectedValue);
  });
}

function isReferenceFieldVisibleByUiRule(field, formState, referenceOptionsState) {
  const visibleWhen = field?.referenceUi?.visibleWhen;
  if (!visibleWhen || typeof visibleWhen !== "object") {
    return true;
  }

  const sourceValue = formState?.[visibleWhen.sourceFieldId];
  if (
    sourceValue === undefined ||
    sourceValue === null ||
    (typeof sourceValue === "string" && sourceValue.trim().length === 0)
  ) {
    return false;
  }

  const sourceOptions = referenceOptionsState?.[visibleWhen.collectionId]?.items ?? [];
  const targetRow =
    sourceOptions.find((item) => valuesMatch(item?.[visibleWhen.matchField], sourceValue)) ?? null;
  if (!targetRow || typeof targetRow !== "object") {
    return false;
  }

  return valuesMatch(targetRow[visibleWhen.valueField], visibleWhen.equals);
}

function renderReferenceEditor({
  field,
  formState,
  controlsDisabled,
  onChangeForm,
  referenceOptionsState,
  onInlineCreateReference
}) {
  const optionsState = toReferenceOptions(field, referenceOptionsState);
  const label = toReferenceInputLabel(field);
  const labelId = toFieldControlId(field, "form-label");
  const selectId = toFieldControlId(field, "form-select");
  if (!isReferenceFieldVisibleByUiRule(field, formState, referenceOptionsState)) {
    return null;
  }
  const optionItems = resolveReferenceItemsByUiRule(
    field,
    formState,
    optionsState.items ?? []
  );
  const canInlineCreate =
    typeof onInlineCreateReference === "function" &&
    field?.referenceUi?.inlineCreate === true;

  return (
    <Stack key={field.id} direction="row" spacing={1} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 260 }}>
        <InputLabel id={labelId}>{label}</InputLabel>
        <Select
          id={selectId}
          labelId={labelId}
          label={label}
          value={formState[field.id] ?? ""}
          disabled={controlsDisabled}
          onChange={(event) => onChangeForm(field.id, event.target.value)}
          inputProps={{
            name: field.id
          }}
        >
          <MenuItem value="">None</MenuItem>
          {optionsState.loading ? (
            <MenuItem disabled value="__loading__">
              Loading options...
            </MenuItem>
          ) : null}
          {optionItems.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {resolveReferenceOptionLabel(field, item)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {canInlineCreate ? (
        <Button
          variant="outlined"
          size="small"
          disabled={controlsDisabled}
          onClick={() => onInlineCreateReference(field)}
        >
          Add
        </Button>
      ) : null}
    </Stack>
  );
}

function renderReferenceMultiEditor({
  field,
  formState,
  controlsDisabled,
  onChangeForm,
  referenceOptionsState,
  onInlineCreateReference
}) {
  const optionsState = toReferenceOptions(field, referenceOptionsState);
  const label = toReferenceInputLabel(field);
  const labelId = toFieldControlId(field, "form-label");
  const selectId = toFieldControlId(field, "form-select");
  if (!isReferenceFieldVisibleByUiRule(field, formState, referenceOptionsState)) {
    return null;
  }
  const optionItems = resolveReferenceItemsByUiRule(
    field,
    formState,
    optionsState.items ?? []
  );
  const canInlineCreate =
    typeof onInlineCreateReference === "function" &&
    field?.referenceUi?.inlineCreate === true;

  return (
    <Stack key={field.id} direction="row" spacing={1} alignItems="center">
      <FormControl size="small" sx={{ minWidth: 260 }}>
        <InputLabel id={labelId}>{label}</InputLabel>
        <Select
          id={selectId}
          labelId={labelId}
          label={label}
          multiple
          value={formState[field.id] ?? []}
          disabled={controlsDisabled}
          onChange={(event) => onChangeForm(field.id, normalizeMultiSelectValue(event.target.value))}
          inputProps={{
            name: field.id
          }}
        >
          {optionsState.loading ? (
            <MenuItem disabled value="__loading__">
              Loading options...
            </MenuItem>
          ) : null}
          {optionItems.map((item) => (
            <MenuItem key={item.id} value={item.id}>
              {resolveReferenceOptionLabel(field, item)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {canInlineCreate ? (
        <Button
          variant="outlined"
          size="small"
          disabled={controlsDisabled}
          onClick={() => onInlineCreateReference(field)}
        >
          Add
        </Button>
      ) : null}
    </Stack>
  );
}

export {
  renderReferenceEditor,
  renderReferenceMultiEditor
};
