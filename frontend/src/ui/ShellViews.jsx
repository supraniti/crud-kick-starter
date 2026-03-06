import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";

function getDeploySeverity(deploy) {
  if (deploy?.deployRequired) {
    return "warning";
  }

  return "success";
}

function getDeployStatusLabel(deploy) {
  if (deploy?.deployRequired) {
    return "Deploy required";
  }

  return "Deployed";
}

function getJobStatusSeverity(status) {
  if (status === "failed") {
    return "error";
  }

  if (status === "running" || status === "queued") {
    return "warning";
  }

  if (status === "cancelled") {
    return "info";
  }

  return "success";
}

function StatusChip({ mode }) {
  if (mode === "connected") {
    return <Chip color="success" label="API connected" size="small" />;
  }

  if (mode === "disconnected") {
    return <Chip color="error" label="API disconnected" size="small" />;
  }

  return <Chip color="warning" label="API checking" size="small" />;
}

function DeployPanel({
  state,
  remotes,
  selectedRemoteId,
  onSelectRemote,
  onOpenRemotes,
  onDeployNow
}) {
  const deploy = state.deploy;
  const latestJob = state.latestJob;
  const selectedRemote = remotes.find((item) => item.id === selectedRemoteId) ?? null;

  return (
    <Paper variant="outlined" sx={{ mb: 2, p: 1.5 }}>
      <Stack spacing={1}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", sm: "center" }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2">Release state</Typography>
            <Chip
              size="small"
              color={getDeploySeverity(deploy)}
              label={getDeployStatusLabel(deploy)}
            />
          </Stack>
          <Button
            size="small"
            variant="contained"
            onClick={onDeployNow}
            disabled={
              state.starting ||
              !deploy?.deployRequired ||
              !selectedRemote ||
              selectedRemote.enabled !== true
            }
          >
            {state.starting ? "Deploying..." : "Deploy now"}
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary">
          Revision {deploy?.currentRevision ?? 0} / deployed {deploy?.deployedRevision ?? 0}
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel id="deploy-remote-select-label">Deploy target</InputLabel>
            <Select
              id="deploy-remote-select-input"
              labelId="deploy-remote-select-label"
              label="Deploy target"
              value={selectedRemoteId}
              onChange={(event) => onSelectRemote(event.target.value)}
              inputProps={{
                id: "deploy-remote-select-input",
                name: "deployTarget"
              }}
            >
              {remotes.map((remote) => (
                <MenuItem key={remote.id} value={remote.id}>
                  {remote.label} ({remote.kind}) {remote.enabled ? "" : "[disabled]"}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="text" size="small" onClick={onOpenRemotes}>
            Manage remotes
          </Button>
        </Stack>

        {state.errorMessage ? <Alert severity="error">{state.errorMessage}</Alert> : null}
        {!selectedRemote ? (
          <Alert severity="warning">Select a deploy target remote.</Alert>
        ) : null}
        {selectedRemote && !selectedRemote.enabled ? (
          <Alert severity="warning">
            Selected remote is disabled. Choose another remote or enable it.
          </Alert>
        ) : null}

        {latestJob ? (
          <Alert severity={getJobStatusSeverity(latestJob.status)}>
            <Stack spacing={0.5}>
              <Typography variant="body2">
                Job {latestJob.id}: {latestJob.status}
              </Typography>
              <Typography variant="caption">
                Target:{" "}
                {latestJob.result?.remote?.label ??
                  latestJob.result?.remote?.id ??
                  latestJob.payload?.remote?.id ??
                  latestJob.payload?.remoteId ??
                  "-"}
              </Typography>
              {(latestJob.logs ?? []).slice(-3).map((entry) => (
                <Typography key={`${latestJob.id}-${entry.timestamp}-${entry.message}`} variant="caption">
                  [{entry.level}] {entry.message}
                </Typography>
              ))}
            </Stack>
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}

function LoginView({ onSignIn }) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        bgcolor: "grey.100",
        p: 2
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 440 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">Crud Control</Typography>
            <Typography variant="body2" color="text.secondary">
              Local authenticated shell baseline for the M4 reference slice.
            </Typography>
            <Button variant="contained" onClick={onSignIn}>
              Sign in (local)
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}

function ModuleSidebar({ modules, activeModuleId, onSelectModule }) {
  const resolveModuleStateLabel = (moduleItem) => {
    const state =
      typeof moduleItem?.state === "string" && moduleItem.state.length > 0
        ? moduleItem.state
        : "unknown";
    return state;
  };

  const isModuleRouteAvailable = (moduleItem) => {
    if (
      moduleItem?.routeAvailability &&
      typeof moduleItem.routeAvailability === "object" &&
      moduleItem.routeAvailability.routeAvailable === true
    ) {
      return true;
    }

    return resolveModuleStateLabel(moduleItem) === "enabled";
  };

  return (
    <Paper
      component="aside"
      square
      sx={{
        width: 240,
        borderRight: 1,
        borderColor: "divider",
        p: 1.5,
        display: "flex",
        flexDirection: "column",
        gap: 1
      }}
    >
      <Typography variant="subtitle2" color="text.secondary" sx={{ px: 1 }}>
        Modules
      </Typography>
      {modules.map((moduleItem) => {
        const active = moduleItem.id === activeModuleId;
        const moduleState = resolveModuleStateLabel(moduleItem);
        const routeAvailable = isModuleRouteAvailable(moduleItem);
        return (
          <Button
            key={moduleItem.id}
            variant={active ? "contained" : "text"}
            color={active ? "primary" : "inherit"}
            onClick={() => onSelectModule(moduleItem.id)}
            aria-label={moduleItem.label}
            data-module-id={moduleItem.id}
            data-module-state={moduleState}
            data-route-available={routeAvailable ? "true" : "false"}
            sx={{ justifyContent: "flex-start" }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap>
              <span>{moduleItem.label}</span>
              {moduleState !== "enabled" ? (
                <Chip
                  size="small"
                  color={routeAvailable ? "warning" : "default"}
                  label={moduleState}
                />
              ) : null}
            </Stack>
          </Button>
        );
      })}
    </Paper>
  );
}

function ModuleQuickActions({ actions, onRunAction }) {
  if (!Array.isArray(actions) || actions.length === 0) {
    return null;
  }

  return (
    <Paper variant="outlined" sx={{ mb: 2, p: 1.5 }}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle2" color="text.secondary">
          View shortcuts
        </Typography>
        {actions.map((action) => (
          <Button
            key={action.id}
            size="small"
            variant="text"
            onClick={() => onRunAction(action.id)}
          >
            {action.label}
          </Button>
        ))}
      </Stack>
    </Paper>
  );
}

export { StatusChip, DeployPanel, LoginView, ModuleSidebar, ModuleQuickActions };

