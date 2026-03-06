import {
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import {
  resolveCollectionFilterFieldConfigs,
  resolveCollectionSchemaFields,
  singularizeCollectionLabel
} from "../../domains/collections/domain-helpers.js";
import { normalizeMultiSelectValue } from "./constants.js";
import { stripReferenceSingleSuffix } from "../../runtime/shared-capability-bridges/reference-field-key-utils.mjs";

function toReferenceFilterLabel(field, config) {
  if (config.type === "reference") {
    const normalizedFieldId = stripReferenceSingleSuffix(field.id);
    return `Filter by ${normalizedFieldId.toLowerCase()}`;
  }

  const singularLabel = singularizeCollectionLabel(field.label);
  return `Filter by ${singularLabel.toLowerCase()}`;
}

function toSelectOptions(field) {
  return Array.isArray(field?.options)
    ? field.options
    : [];
}

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

function CollectionFiltersPanel({
  schema,
  activeCollectionId,
  controlsDisabled,
  filterState,
  onChangeFilter,
  onClearFilter,
  referenceOptionsState
}) {
  const fields = resolveCollectionSchemaFields(schema, activeCollectionId);
  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const filterFieldConfigs = resolveCollectionFilterFieldConfigs(schema, activeCollectionId);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">Filters</Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <TextField
            id="collection-filter-search"
            name="search"
            size="small"
            fullWidth
            label="Search title"
            value={filterState.search}
            disabled={controlsDisabled}
            onChange={(event) => onChangeFilter("search", event.target.value)}
          />

          {filterFieldConfigs.map((fieldConfig) => {
            const field = fieldMap.get(fieldConfig.fieldId);
            if (!field) {
              return null;
            }

            if (fieldConfig.type === "enum") {
              const labelId = `${field.id}-filter-label`;
              const selectId = `${field.id}-filter-select`;
              return (
                <FormControl key={field.id} size="small" sx={{ minWidth: 180 }}>
                  <InputLabel id={labelId}>{field.label}</InputLabel>
                  <Select
                    id={selectId}
                    labelId={labelId}
                    label={field.label}
                    value={filterState[field.id] ?? ""}
                    disabled={controlsDisabled}
                    onChange={(event) => onChangeFilter(field.id, event.target.value)}
                    inputProps={{
                      name: field.id
                    }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {toSelectOptions(field).map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }

            if (fieldConfig.type === "enum-multi") {
              const label = `Filter ${field.label.toLowerCase()}`;
              const labelId = `${field.id}-filter-label`;
              const selectId = `${field.id}-filter-select`;
              return (
                <FormControl key={field.id} size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id={labelId}>{label}</InputLabel>
                  <Select
                    id={selectId}
                    labelId={labelId}
                    label={label}
                    multiple
                    value={filterState[field.id] ?? []}
                    disabled={controlsDisabled}
                    onChange={(event) =>
                      onChangeFilter(field.id, normalizeMultiSelectValue(event.target.value))
                    }
                    inputProps={{
                      name: field.id
                    }}
                  >
                    {toSelectOptions(field).map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }

            if (fieldConfig.type === "reference" || fieldConfig.type === "reference-multi") {
              const label = toReferenceFilterLabel(field, fieldConfig);
              const labelId = `${field.id}-filter-label`;
              const selectId = `${field.id}-filter-select`;
              const optionsState = referenceOptionsState?.[field.collectionId] ?? {
                loading: false,
                errorMessage: null,
                items: []
              };

              return (
                <FormControl key={field.id} size="small" sx={{ minWidth: 220 }}>
                  <InputLabel id={labelId}>{label}</InputLabel>
                  <Select
                    id={selectId}
                    labelId={labelId}
                    label={label}
                    value={filterState[field.id] ?? ""}
                    disabled={controlsDisabled}
                    onChange={(event) => onChangeFilter(field.id, event.target.value)}
                    inputProps={{
                      name: field.id
                    }}
                  >
                    <MenuItem value="">All</MenuItem>
                    {optionsState.loading ? (
                      <MenuItem disabled value="__loading__">
                        Loading options...
                      </MenuItem>
                    ) : null}
                    {(optionsState.items ?? []).map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {resolveReferenceOptionLabel(field, item)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }

            return null;
          })}

          <Button variant="text" onClick={onClearFilter} disabled={controlsDisabled}>
            Clear
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}

export { CollectionFiltersPanel };

