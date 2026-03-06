import {
  Alert,
  Button,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import { resolveEditableCollectionFields } from "../../domains/collections/domain-helpers.js";
import { resolveCollectionFieldEditorDefinition } from "./field-registry.jsx";
import { CollectionInlineCreateDialog } from "./CollectionInlineCreateDialog.jsx";

function CollectionFormPanel({
  schema,
  activeCollectionId,
  controlsDisabled,
  formState,
  itemLabel,
  referenceOptionsState,
  onChangeForm,
  onSubmitForm,
  onResetForm,
  onInlineCreateReference,
  inlineCreateState,
  onInlineCreateFormChange,
  onCloseInlineCreate,
  onSubmitInlineCreate,
  onRunErrorAction,
  isUnavailableDuplicate
}) {
  const editableFields = resolveEditableCollectionFields(schema, activeCollectionId);
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
  const hasBlockingEditorDiagnostics = fieldEditorDiagnostics.length > 0;
  const errorActions = Array.isArray(formState.errorActions) ? formState.errorActions : [];
  const showErrorMessage =
    typeof formState.errorMessage === "string" &&
    formState.errorMessage.length > 0 &&
    !isUnavailableDuplicate(formState.errorMessage);

  return (
    <>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">
            {formState.itemId ? `Edit ${itemLabel}` : `Add ${itemLabel}`}
          </Typography>

          {fieldEditorDiagnostics.map((diagnostic) => (
            <Alert key={`${diagnostic.code}:${diagnostic.fieldId}`} severity="error">
              {diagnostic.message}
            </Alert>
          ))}

          {fieldEditorDefinitions.map(({ field, renderEditor }) =>
            renderEditor({
              field,
              formState,
              controlsDisabled,
              referenceOptionsState,
              onChangeForm,
              onInlineCreateReference
            })
          )}

          {showErrorMessage ? (
            <Alert
              severity="error"
              action={
                errorActions.length > 0 && typeof onRunErrorAction === "function" ? (
                  <Stack direction="row" spacing={1} sx={{ ml: 1 }}>
                    {errorActions.map((action, index) => (
                      <Button
                        key={`${action?.id ?? "error-action"}-${index}`}
                        size="small"
                        color="inherit"
                        variant="outlined"
                        onClick={() => onRunErrorAction(action)}
                      >
                        {typeof action?.label === "string" && action.label.length > 0
                          ? action.label
                          : "Open"}
                      </Button>
                    ))}
                  </Stack>
                ) : null
              }
            >
              {formState.errorMessage}
            </Alert>
          ) : null}
          {formState.successMessage ? (
            <Alert severity="success">{formState.successMessage}</Alert>
          ) : null}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={onSubmitForm}
              disabled={formState.saving || controlsDisabled || hasBlockingEditorDiagnostics}
            >
              {formState.saving
                ? "Saving..."
                : formState.itemId
                  ? `Update ${itemLabel}`
                  : `Create ${itemLabel}`}
            </Button>
            <Button variant="text" onClick={onResetForm} disabled={formState.saving || controlsDisabled}>
              Reset
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <CollectionInlineCreateDialog
        open={inlineCreateState?.open === true}
        targetCollectionId={inlineCreateState?.targetCollectionId ?? ""}
        targetCollectionLabel={inlineCreateState?.targetCollectionLabel ?? ""}
        schema={inlineCreateState?.collectionSchema ?? null}
        formState={inlineCreateState?.formState ?? {}}
        referenceOptionsState={referenceOptionsState}
        loadingSchema={inlineCreateState?.loadingSchema === true}
        saving={inlineCreateState?.saving === true}
        errorMessage={inlineCreateState?.errorMessage ?? null}
        controlsDisabled={controlsDisabled}
        onChangeForm={onInlineCreateFormChange}
        onClose={onCloseInlineCreate}
        onSubmit={onSubmitInlineCreate}
      />
    </>
  );
}

export { CollectionFormPanel };
