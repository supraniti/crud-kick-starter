import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import { ModuleSettingsPanel } from "./ModuleSettingsPanel.jsx";

function RemotesView({
  remotesState,
  formState,
  onChangeForm,
  onSubmitForm,
  onEditRemote,
  onDeleteRemote,
  onResetForm,
  settingsModulesState,
  moduleSettingsState,
  moduleSettingsMeta,
  moduleSettingsPersistencePolicy,
  isModuleSettingsAvailable,
  onChangeModuleSettingsField,
  onSaveModuleSettings
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h5">Remotes</Typography>
      <Typography variant="body2" color="text.secondary">
        Manage deployment targets and update deploy connection settings.
      </Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Remote Targets</Typography>
          {remotesState.loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Loading remotes...</Typography>
            </Stack>
          ) : null}
          {remotesState.errorMessage ? (
            <Alert severity="error">{remotesState.errorMessage}</Alert>
          ) : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Label</TableCell>
                  <TableCell>Kind</TableCell>
                  <TableCell>Endpoint</TableCell>
                  <TableCell>Enabled</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {remotesState.items.map((remote) => (
                  <TableRow key={remote.id}>
                    <TableCell>{remote.label}</TableCell>
                    <TableCell>{remote.kind}</TableCell>
                    <TableCell>{remote.endpoint}</TableCell>
                    <TableCell>{remote.enabled ? "Yes" : "No"}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => onEditRemote(remote)}>
                          Edit
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => onDeleteRemote(remote.id)}
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
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">
            {formState.remoteId ? "Edit Remote" : "Add Remote"}
          </Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField
              id="remote-label-input"
              name="label"
              size="small"
              label="Label"
              fullWidth
              value={formState.label}
              onChange={(event) => onChangeForm("label", event.target.value)}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="remote-kind-label">Kind</InputLabel>
              <Select
                id="remote-kind-select"
                labelId="remote-kind-label"
                label="Kind"
                value={formState.kind}
                onChange={(event) => onChangeForm("kind", event.target.value)}
                inputProps={{
                  name: "kind"
                }}
              >
                <MenuItem value="filesystem">filesystem</MenuItem>
                <MenuItem value="http">http</MenuItem>
                <MenuItem value="sftp">sftp</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <TextField
            id="remote-endpoint-input"
            name="endpoint"
            size="small"
            label="Endpoint"
            fullWidth
            value={formState.endpoint}
            onChange={(event) => onChangeForm("endpoint", event.target.value)}
          />
          <FormControlLabel
            control={
              <Checkbox
                id="remote-enabled-checkbox"
                checked={formState.enabled}
                onChange={(event) => onChangeForm("enabled", event.target.checked)}
                inputProps={{
                  "aria-label": "Remote enabled",
                  name: "enabled"
                }}
              />
            }
            label={<Typography variant="body2">Enabled</Typography>}
          />

          {formState.errorMessage ? <Alert severity="error">{formState.errorMessage}</Alert> : null}
          {formState.successMessage ? (
            <Alert severity="success">{formState.successMessage}</Alert>
          ) : null}

          <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={onSubmitForm} disabled={formState.saving}>
              {formState.saving ? "Saving..." : formState.remoteId ? "Update remote" : "Create remote"}
            </Button>
            <Button variant="text" onClick={onResetForm} disabled={formState.saving}>
              Reset
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {settingsModulesState?.errorMessage ? (
        <Alert severity="error">{settingsModulesState.errorMessage}</Alert>
      ) : null}

      {isModuleSettingsAvailable ? (
        <ModuleSettingsPanel
          moduleId={moduleSettingsState.moduleId}
          moduleSettingsState={moduleSettingsState}
          moduleSettingsMeta={moduleSettingsMeta}
          moduleSettingsPersistencePolicy={moduleSettingsPersistencePolicy}
          onChangeField={onChangeModuleSettingsField}
          onSave={onSaveModuleSettings}
        />
      ) : null}
    </Stack>
  );
}

export { RemotesView };

