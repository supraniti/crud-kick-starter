import { useMemo } from "react";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import { getSafeguardSeverity } from "./view-helpers.js";

function ProductsView({
  categories,
  tags,
  productsState,
  selectedCategoryIds,
  onToggleCategory,
  onRemoveCategory,
  onOpenTagEditor,
  onOpenTaxonomies,
  safeguardInput,
  onSafeguardInputChange,
  onPreviewSafeguard,
  safeguardState
}) {
  const categoryMap = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category.label]));
  }, [categories]);

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Products</Typography>
      <Typography variant="body2" color="text.secondary">
        Reference slice list with URL-synced category filters and tag relation editing.
      </Typography>
      <Button variant="text" sx={{ alignSelf: "flex-start" }} onClick={onOpenTaxonomies}>
        Open Taxonomies Module
      </Button>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Category Filters</Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {categories.map((category) => {
              const isSelected = selectedCategoryIds.includes(category.id);
              return (
                <Button
                  key={category.id}
                  size="small"
                  variant={isSelected ? "contained" : "outlined"}
                  onClick={() => onToggleCategory(category.id)}
                >
                  {category.label}
                </Button>
              );
            })}
          </Stack>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {selectedCategoryIds.map((categoryId) => (
              <Chip
                key={categoryId}
                label={categoryMap.get(categoryId) ?? categoryId}
                onDelete={() => onRemoveCategory(categoryId)}
                color="primary"
                variant="outlined"
              />
            ))}
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Products Table</Typography>
          {productsState.loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Loading products...</Typography>
            </Stack>
          ) : null}
          {productsState.errorMessage ? (
            <Alert severity="error">{productsState.errorMessage}</Alert>
          ) : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Tags</TableCell>
                  <TableCell align="right">Price</TableCell>
                  <TableCell align="center">Active</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {productsState.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.categoryLabel ?? item.categoryId}</TableCell>
                    <TableCell>
                      <Stack direction="row" flexWrap="wrap" gap={0.5} alignItems="center">
                        {(item.tagLabels ?? []).map((label) => (
                          <Chip
                            key={`${item.id}-${label}`}
                            label={label}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                        <Button size="small" onClick={() => onOpenTagEditor(item.id)}>
                          Edit tags
                        </Button>
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{item.price}</TableCell>
                    <TableCell align="center">{item.active ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" flexWrap="wrap" gap={0.5}>
            {tags.map((tag) => (
              <Chip key={tag.id} label={`${tag.label} (${tag.usageCount ?? 0})`} size="small" />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Total (filtered): {productsState.meta.total}
          </Typography>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Safeguard Preview Hook</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              size="small"
              fullWidth
              label="Tag value"
              value={safeguardInput}
              onChange={(event) => onSafeguardInputChange(event.target.value)}
            />
            <Button
              variant="outlined"
              onClick={onPreviewSafeguard}
              disabled={safeguardState.loading}
            >
              Preview safeguard
            </Button>
          </Stack>
          {safeguardState.loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Evaluating safeguard...</Typography>
            </Stack>
          ) : null}
          {safeguardState.errorMessage ? (
            <Alert severity="error">{safeguardState.errorMessage}</Alert>
          ) : null}
          {safeguardState.payload ? (
            <Alert severity={getSafeguardSeverity(safeguardState.payload.decision)}>
              {safeguardState.payload.code}: {safeguardState.payload.message}
            </Alert>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}

function TagEditorDialog({
  open,
  product,
  tags,
  selectedTagIds,
  newTagLabel,
  onToggleTag,
  onChangeNewTag,
  onClose,
  onSave,
  onConfirmSafeguard,
  saving,
  errorMessage,
  safeguard
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit Product Tags</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Product: {product?.name ?? "-"}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {tags.map((tag) => {
              const checked = selectedTagIds.includes(tag.id);
              return (
                <Chip
                  key={tag.id}
                  label={tag.label}
                  color={checked ? "primary" : "default"}
                  variant={checked ? "filled" : "outlined"}
                  onClick={() => onToggleTag(tag.id)}
                />
              );
            })}
          </Stack>
          <TextField
            size="small"
            label="Create new tag"
            value={newTagLabel}
            onChange={(event) => onChangeNewTag(event.target.value)}
          />
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          {safeguard ? (
            <Alert severity={getSafeguardSeverity(safeguard.decision)}>
              {safeguard.code}: {safeguard.message}
            </Alert>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        {safeguard ? (
          <Button variant="contained" onClick={onConfirmSafeguard} disabled={saving}>
            Confirm new tag and save
          </Button>
        ) : null}
        <Button variant="contained" onClick={onSave} disabled={saving}>
          {saving ? "Saving..." : "Save tags"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { ProductsView, TagEditorDialog };

