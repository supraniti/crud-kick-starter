import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";

function missionStateColor(state) {
  if (state === "enabled") {
    return "success";
  }

  if (state === "disabled") {
    return "warning";
  }

  if (state === "installed") {
    return "info";
  }

  return "default";
}

function jobStatusColor(status) {
  if (status === "failed") {
    return "error";
  }

  if (status === "queued" || status === "running") {
    return "warning";
  }

  if (status === "cancelled") {
    return "info";
  }

  return "success";
}

function canCancelJob(status) {
  return status === "queued" || status === "running";
}

function renderJson(value) {
  return JSON.stringify(value ?? null, null, 2);
}

function renderPayloadField(field, value, onPayloadFieldChange) {
  const helperText = field.description || undefined;
  const label = field.required ? `${field.label} *` : field.label;
  const fieldControlName = `missionPayload.${field.id}`;

  if (field.type === "boolean") {
    const switchId = `mission-payload-field-${field.id}-switch`;
    return (
      <Stack key={field.id} spacing={0.5}>
        <FormControlLabel
          control={
            <Switch
              id={switchId}
              name={fieldControlName}
              checked={value === true}
              onChange={(event) => onPayloadFieldChange(field.id, event.target.checked)}
              inputProps={{
                name: fieldControlName
              }}
            />
          }
          label={label}
        />
        {helperText ? (
          <Typography variant="caption" color="text.secondary">
            {helperText}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  if (field.type === "enum") {
    const labelId = `mission-payload-field-${field.id}-label`;
    const selectId = `mission-payload-field-${field.id}-select`;
    return (
      <FormControl key={field.id} size="small" sx={{ maxWidth: 420 }}>
        <InputLabel id={labelId}>{label}</InputLabel>
        <Select
          id={selectId}
          labelId={labelId}
          label={label}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onPayloadFieldChange(field.id, event.target.value)}
          inputProps={{
            name: fieldControlName
          }}
        >
          <MenuItem value="">-</MenuItem>
          {(field.options ?? []).map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
        {helperText ? (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {helperText}
          </Typography>
        ) : null}
      </FormControl>
    );
  }

  return (
    <TextField
      key={field.id}
      id={`mission-payload-field-${field.id}-input`}
      name={fieldControlName}
      label={label}
      value={value ?? ""}
      onChange={(event) => onPayloadFieldChange(field.id, event.target.value)}
      type={field.type === "number" ? "number" : "text"}
      size="small"
      fullWidth
      placeholder={field.placeholder || undefined}
      helperText={helperText}
      inputProps={{
        "aria-label": label
      }}
    />
  );
}

function MissionOperatorView({
  missionsState,
  runFormState,
  selectedMission,
  selectedMissionPayloadFields,
  jobsState,
  selectedJobId,
  jobDetailState,
  onSelectMission,
  onPayloadFieldChange,
  onRunMission,
  onSelectJob,
  onCancelJob,
  onRefresh,
  onOpenRemotes
}) {
  return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "flex-start", sm: "center" }}
        justifyContent="space-between"
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">Mission Operator</Typography>
          <Typography variant="body2" color="text.secondary">
            Submit mission jobs and monitor deterministic lifecycle, status, logs, and errors.
          </Typography>
        </Stack>
        <Button size="small" variant="text" onClick={onOpenRemotes}>
          Manage remotes
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Missions</Typography>
          {missionsState.loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Loading missions...</Typography>
            </Stack>
          ) : null}
          {missionsState.errorMessage ? (
            <Alert severity="error">{missionsState.errorMessage}</Alert>
          ) : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mission</TableCell>
                  <TableCell>Module</TableCell>
                  <TableCell>State</TableCell>
                  <TableCell>Active</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(missionsState.items ?? []).map((mission) => (
                  <TableRow key={mission.missionId}>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2">{mission.label ?? mission.missionId}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {mission.missionId}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>{mission.moduleId}</TableCell>
                    <TableCell>
                      <Chip size="small" color={missionStateColor(mission.state)} label={mission.state} />
                    </TableCell>
                    <TableCell>{mission.active ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Run Mission</Typography>
          <FormControl size="small" sx={{ maxWidth: 420 }}>
            <InputLabel id="mission-select-label">Mission</InputLabel>
            <Select
              id="mission-select-input"
              labelId="mission-select-label"
              label="Mission"
              value={runFormState.missionId}
              onChange={(event) => onSelectMission(event.target.value)}
              inputProps={{
                id: "mission-select-input",
                name: "missionId"
              }}
            >
              {(missionsState.items ?? []).map((mission) => (
                <MenuItem key={mission.missionId} value={mission.missionId}>
                  {mission.label ?? mission.missionId}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {selectedMission?.description ? (
            <Typography variant="body2" color="text.secondary">
              {selectedMission.description}
            </Typography>
          ) : null}
          {(selectedMissionPayloadFields ?? []).length > 0 ? (
            <Stack spacing={1.25}>
              {(selectedMissionPayloadFields ?? []).map((field) =>
                renderPayloadField(field, runFormState.payloadValues?.[field.id], onPayloadFieldChange)
              )}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No mission payload fields configured.
            </Typography>
          )}
          {runFormState.errorMessage ? <Alert severity="error">{runFormState.errorMessage}</Alert> : null}
          {runFormState.successMessage ? (
            <Alert severity="success">{runFormState.successMessage}</Alert>
          ) : null}
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={onRunMission}
              disabled={runFormState.submitting || (missionsState.items ?? []).length === 0}
            >
              {runFormState.submitting ? "Submitting..." : "Run mission"}
            </Button>
            <Button variant="text" onClick={onRefresh} disabled={runFormState.submitting}>
              Refresh jobs
            </Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Mission Jobs</Typography>
          {jobsState.loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Loading mission jobs...</Typography>
            </Stack>
          ) : null}
          {jobsState.errorMessage ? <Alert severity="error">{jobsState.errorMessage}</Alert> : null}
          {jobsState.successMessage ? <Alert severity="success">{jobsState.successMessage}</Alert> : null}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Job</TableCell>
                  <TableCell>Mission</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Updated</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(jobsState.items ?? []).map((job) => {
                  const missionId = `${job.type ?? ""}`.replace(/^mission:/, "") || "-";
                  return (
                    <TableRow
                      key={job.id}
                      selected={job.id === selectedJobId}
                      hover
                      onClick={() => onSelectJob(job.id)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell>{job.id}</TableCell>
                      <TableCell>{missionId}</TableCell>
                      <TableCell>
                        <Chip size="small" color={jobStatusColor(job.status)} label={job.status} />
                      </TableCell>
                      <TableCell>{job.updatedAt ?? "-"}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          color="inherit"
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelectJob(job.id);
                          }}
                        >
                          Inspect
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={(event) => {
                            event.stopPropagation();
                            onCancelJob(job.id);
                          }}
                          disabled={!canCancelJob(job.status) || jobsState.cancellingJobId === job.id}
                        >
                          {jobsState.cancellingJobId === job.id ? "Cancelling..." : "Cancel"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle2">Selected Job Details</Typography>
          {jobDetailState.loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Loading job details...</Typography>
            </Stack>
          ) : null}
          {jobDetailState.errorMessage ? (
            <Alert severity="error">{jobDetailState.errorMessage}</Alert>
          ) : null}
          {jobDetailState.job ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">Job {jobDetailState.job.id}</Typography>
                <Chip
                  size="small"
                  color={jobStatusColor(jobDetailState.job.status)}
                  label={jobDetailState.job.status}
                />
              </Stack>
              {jobDetailState.job.error ? (
                <Alert severity="error">
                  [{jobDetailState.job.error.code ?? "MISSION_JOB_FAILED"}]{" "}
                  {jobDetailState.job.error.message ?? "Mission job failed"}
                </Alert>
              ) : null}
              <TextField
                id="mission-job-result-input"
                name="missionJobResult"
                label="Result"
                value={renderJson(jobDetailState.job.result)}
                multiline
                minRows={4}
                fullWidth
                InputProps={{ readOnly: true }}
              />
              <TextField
                id="mission-job-logs-input"
                name="missionJobLogs"
                label="Logs"
                value={(jobDetailState.job.logs ?? [])
                  .map((entry) => `${entry.timestamp} [${entry.level}] ${entry.message}`)
                  .join("\n")}
                multiline
                minRows={4}
                fullWidth
                InputProps={{ readOnly: true }}
              />
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a mission job to inspect details.
            </Typography>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}

export { MissionOperatorView };
