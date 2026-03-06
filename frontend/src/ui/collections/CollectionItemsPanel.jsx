import {
  Alert,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { resolveCollectionSchemaFields } from "../../domains/collections/domain-helpers.js";
import {
  resolveCollectionFieldAlignment,
  resolveCollectionFieldCellDefinition
} from "./field-registry.jsx";

function CollectionItemsPanel({
  schema,
  activeCollectionId,
  collectionLabel,
  itemsState,
  controlsDisabled,
  onEditItem,
  onDeleteItem,
  isUnavailableDuplicate
}) {
  const fields = resolveCollectionSchemaFields(schema, activeCollectionId);
  const fieldCellDefinitions = fields.map((field) => ({
    field,
    align: resolveCollectionFieldAlignment(field),
    ...resolveCollectionFieldCellDefinition(field)
  }));
  const fieldRendererDiagnostics = [
    ...new Map(
      fieldCellDefinitions
        .filter((entry) => entry.diagnostic !== null)
        .map((entry) => [`${entry.diagnostic.code}:${entry.diagnostic.fieldId}`, entry.diagnostic])
    ).values()
  ];
  const hasBlockingRendererDiagnostics = fieldRendererDiagnostics.length > 0;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">{collectionLabel}</Typography>
        {itemsState.loading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading items...</Typography>
          </Stack>
        ) : null}
        {itemsState.errorMessage && !isUnavailableDuplicate(itemsState.errorMessage) ? (
          <Alert severity="error">{itemsState.errorMessage}</Alert>
        ) : null}
        {fieldRendererDiagnostics.map((diagnostic) => (
          <Alert key={`${diagnostic.code}:${diagnostic.fieldId}`} severity="error">
            {diagnostic.message}
          </Alert>
        ))}
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                {fieldCellDefinitions.map(({ field, align }) => (
                  <TableCell key={field.id} align={align}>
                    {field.label}
                  </TableCell>
                ))}
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {itemsState.items.map((item) => (
                <TableRow key={item.id}>
                  {fieldCellDefinitions.map(({ field, align, renderCell }) => (
                    <TableCell key={`${item.id}-${field.id}`} align={align}>
                      {renderCell({ field, item })}
                    </TableCell>
                  ))}
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        onClick={() => onEditItem(item)}
                        disabled={controlsDisabled || hasBlockingRendererDiagnostics}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        onClick={() => onDeleteItem(item.id)}
                        disabled={controlsDisabled || hasBlockingRendererDiagnostics}
                      >
                        Delete
                      </Button>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography variant="caption" color="text.secondary">
          Total: {itemsState.meta.total}
        </Typography>
      </Stack>
    </Paper>
  );
}

export { CollectionItemsPanel };
