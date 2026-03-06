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

function canInstall(state) {
  return state === "discovered" || state === "uninstalled" || state === "failed";
}

function canEnable(state) {
  return state === "installed" || state === "disabled";
}

function canDisable(state) {
  return state === "enabled";
}

function canUninstall(state) {
  return state === "installed" || state === "enabled" || state === "disabled" || state === "failed";
}

function hasOwnProperty(target, key) {
  return Object.prototype.hasOwnProperty.call(target ?? {}, key);
}

function toPolicySummary(policyDescriptor, active) {
  if (!policyDescriptor || typeof policyDescriptor !== "object") {
    return "unknown";
  }

  const runtimeMode = policyDescriptor.runtimeMode ?? "unknown";
  const configuredMode = policyDescriptor.configuredMode ?? "unknown";
  const source = policyDescriptor.source ?? "unknown";
  return `${runtimeMode} (configured: ${configuredMode}, source: ${source}, active: ${
    active ? "yes" : "no"
  })`;
}

function resolveCollectionPolicySummary(moduleRuntimeState, moduleItem) {
  const collectionIds = Array.isArray(moduleItem?.collectionIds)
    ? moduleItem.collectionIds.filter((collectionId) => typeof collectionId === "string" && collectionId.length > 0)
    : [];
  if (collectionIds.length === 0) {
    return "-";
  }

  const collectionPolicyMap =
    moduleRuntimeState.collectionRepositoryPolicyMap &&
    typeof moduleRuntimeState.collectionRepositoryPolicyMap === "object"
      ? moduleRuntimeState.collectionRepositoryPolicyMap
      : {};
  const activeCollectionPolicyMap =
    moduleRuntimeState.activeCollectionRepositoryPolicyMap &&
    typeof moduleRuntimeState.activeCollectionRepositoryPolicyMap === "object"
      ? moduleRuntimeState.activeCollectionRepositoryPolicyMap
      : {};

  return collectionIds
    .map((collectionId) => {
      const descriptor =
        collectionPolicyMap[collectionId] && typeof collectionPolicyMap[collectionId] === "object"
          ? collectionPolicyMap[collectionId]
          : null;
      return `${collectionId}: ${toPolicySummary(
        descriptor,
        hasOwnProperty(activeCollectionPolicyMap, collectionId)
      )}`;
    })
    .join("; ");
}

function resolveSettingsPolicySummary(moduleRuntimeState, moduleItem) {
  const moduleId = moduleItem?.id;
  if (typeof moduleId !== "string" || moduleId.length === 0) {
    return "-";
  }

  const settingsPolicyMap =
    moduleRuntimeState.settingsRepositoryPolicyMap &&
    typeof moduleRuntimeState.settingsRepositoryPolicyMap === "object"
      ? moduleRuntimeState.settingsRepositoryPolicyMap
      : {};
  const activeSettingsPolicyMap =
    moduleRuntimeState.activeSettingsRepositoryPolicyMap &&
    typeof moduleRuntimeState.activeSettingsRepositoryPolicyMap === "object"
      ? moduleRuntimeState.activeSettingsRepositoryPolicyMap
      : {};
  const descriptor =
    settingsPolicyMap[moduleId] && typeof settingsPolicyMap[moduleId] === "object"
      ? settingsPolicyMap[moduleId]
      : null;
  if (!descriptor) {
    return "-";
  }

  return toPolicySummary(descriptor, hasOwnProperty(activeSettingsPolicyMap, moduleId));
}

function ModuleRuntimePanel({ moduleRuntimeState, onRunAction }) {
  const runningAction = moduleRuntimeState.runningAction;
  const referenceStatePersistence = moduleRuntimeState.referenceStatePersistence;
  const persistenceMode = referenceStatePersistence?.runtimeMode ?? "unknown";
  const persistencePolicy =
    referenceStatePersistence?.failFast === true ? "fail-fast" : "fallback-enabled";
  const persistenceSeverity = persistenceMode === "memory-fallback" ? "warning" : "info";

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2">Module Runtime Controls</Typography>
        <Typography variant="body2" color="text.secondary">
          Execute install/uninstall/enable/disable transitions for runtime modules.
        </Typography>

        {moduleRuntimeState.loading ? (
          <Stack direction="row" spacing={1} alignItems="center">
            <CircularProgress size={18} />
            <Typography variant="body2">Loading module runtime state...</Typography>
          </Stack>
        ) : null}

        {moduleRuntimeState.errorMessage ? (
          <Alert severity="error">{moduleRuntimeState.errorMessage}</Alert>
        ) : null}
        {moduleRuntimeState.successMessage ? (
          <Alert severity="success">{moduleRuntimeState.successMessage}</Alert>
        ) : null}
        {referenceStatePersistence ? (
          <Alert severity={persistenceSeverity}>
            Reference-state persistence mode: <strong>{persistenceMode}</strong> (configured:{" "}
            <strong>{referenceStatePersistence.configuredMode ?? "unknown"}</strong>, policy:{" "}
            <strong>{persistencePolicy}</strong>)
            {persistenceMode === "memory-fallback"
              ? ". Mongo is unavailable and state writes are non-durable until Mongo recovers."
              : ""}
          </Alert>
        ) : null}
        {(moduleRuntimeState.diagnostics ?? []).length > 0 ? (
          <Alert severity="warning">
            Runtime diagnostics detected:
            <ul>
              {(moduleRuntimeState.diagnostics ?? []).map((diagnostic, index) => (
                <li key={`${diagnostic.code ?? "diag"}-${index}`}>
                  [{diagnostic.code ?? "DIAGNOSTIC"}] {diagnostic.message ?? "Unknown runtime diagnostic"}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Module</TableCell>
                <TableCell>State</TableCell>
                <TableCell>Capabilities</TableCell>
                <TableCell>Collection Policy</TableCell>
                <TableCell>Settings Policy</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(moduleRuntimeState.items ?? []).map((item) => {
                const actionPending = runningAction?.moduleId === item.id;
                return (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.state ?? "unknown"}</TableCell>
                    <TableCell>{(item.capabilities ?? []).join(", ") || "-"}</TableCell>
                    <TableCell sx={{ maxWidth: 320 }}>
                      <Typography variant="caption" component="span">
                        {resolveCollectionPolicySummary(moduleRuntimeState, item)}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography variant="caption" component="span">
                        {resolveSettingsPolicySummary(moduleRuntimeState, item)}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          size="small"
                          onClick={() => onRunAction(item.id, "install")}
                          disabled={actionPending || !canInstall(item.state)}
                        >
                          Install
                        </Button>
                        <Button
                          size="small"
                          onClick={() => onRunAction(item.id, "enable")}
                          disabled={actionPending || !canEnable(item.state)}
                        >
                          Enable
                        </Button>
                        <Button
                          size="small"
                          onClick={() => onRunAction(item.id, "disable")}
                          disabled={actionPending || !canDisable(item.state)}
                        >
                          Disable
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          onClick={() => onRunAction(item.id, "uninstall")}
                          disabled={actionPending || !canUninstall(item.state)}
                        >
                          Uninstall
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  );
}

export { ModuleRuntimePanel };
