import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography
} from "@mui/material";
import { resolveEditableCollectionFields } from "../../domains/collections/domain-helpers.js";
import { resolveCollectionFieldEditorDefinition } from "./field-registry.jsx";

function CollectionInlineCreateDialog({
  open,
  targetCollectionId,
  targetCollectionLabel,
  schema,
  formState,
  referenceOptionsState,
  loadingSchema,
  saving,
  errorMessage,
  controlsDisabled,
  onChangeForm,
  onClose,
  onSubmit
}) {
  const editableFields = resolveEditableCollectionFields(schema, targetCollectionId);
  const fieldEditorDefinitions = editableFields.map((field) => ({
    field,
    ...resolveCollectionFieldEditorDefinition(field)
  }));
  const fieldEditorDiagnostics = [
    ...new Map(
      fieldEditorDefinitions
        .filter((entry) => entry.diagnostic !== null)
        .map((entry) => [`${entry.diagnostic.code}:${entry.diagnostic.fieldId}`, entry.diagnostic])
    ).values()
  ];
  const disabled = controlsDisabled || loadingSchema || saving;

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {targetCollectionLabel
          ? `Add ${targetCollectionLabel}`
          : "Add referenced item"}
      </DialogTitle>
      <DialogContent dividers>
        {loadingSchema ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading schema...</Typography>
          </Stack>
        ) : (
          <Stack spacing={1.5} sx={{ pt: 0.5 }}>
            {fieldEditorDiagnostics.map((diagnostic) => (
              <Alert key={`${diagnostic.code}:${diagnostic.fieldId}`} severity="warning">
                {diagnostic.message}
              </Alert>
            ))}
            {fieldEditorDefinitions.map(({ field, renderEditor }) =>
              renderEditor({
                field,
                formState,
                controlsDisabled: disabled,
                referenceOptionsState,
                onChangeForm
              })
            )}
            {typeof errorMessage === "string" && errorMessage.length > 0 ? (
              <Alert severity="error">{errorMessage}</Alert>
            ) : null}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onSubmit}
          disabled={disabled || editableFields.length === 0}
        >
          {saving ? "Saving..." : "Create"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { CollectionInlineCreateDialog };
