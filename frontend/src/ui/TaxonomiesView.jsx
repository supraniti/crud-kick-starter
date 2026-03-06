import {
  Alert,
  Button,
  Checkbox,
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
import { getSafeguardSeverity } from "./view-helpers.js";

function TaxonomiesView({
  tagsState,
  selectedTagIds,
  onToggleTag,
  onAnalyzeImpact,
  onApproveDelete,
  onClearState,
  impactState
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h5">Taxonomies</Typography>
      <Typography variant="body2" color="text.secondary">
        Select tags, review impact, then approve delete and cleanup.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          {tagsState.loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Loading tags...</Typography>
            </Stack>
          ) : null}
          {tagsState.errorMessage ? (
            <Alert severity="error">{tagsState.errorMessage}</Alert>
          ) : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={80}>Select</TableCell>
                  <TableCell>Tag</TableCell>
                  <TableCell align="right">Usage</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tagsState.items.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedTagIds.includes(tag.id)}
                        onChange={() => onToggleTag(tag.id)}
                        inputProps={{ "aria-label": `Select tag ${tag.label}` }}
                      />
                    </TableCell>
                    <TableCell>{tag.label}</TableCell>
                    <TableCell align="right">{tag.usageCount ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={onAnalyzeImpact} disabled={impactState.loading}>
              Analyze impact
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={onApproveDelete}
              disabled={!impactState.impact || impactState.deleting}
            >
              Approve delete and cleanup
            </Button>
            <Button variant="text" onClick={onClearState}>
              Clear
            </Button>
          </Stack>
          {impactState.errorMessage ? <Alert severity="error">{impactState.errorMessage}</Alert> : null}
          {impactState.impact ? (
            <Alert severity={getSafeguardSeverity(impactState.impact.safeguard.decision)}>
              Impact: {impactState.impact.impact.dependentCount} dependent products,{" "}
              {impactState.impact.impact.referenceCount} references.
            </Alert>
          ) : null}
          {impactState.deleteResult ? (
            <Alert severity="success">
              Cleanup complete: removed {impactState.deleteResult.removed.tagCount} tags and{" "}
              {impactState.deleteResult.cleanup.referenceCount} references.
            </Alert>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}

export { TaxonomiesView };

