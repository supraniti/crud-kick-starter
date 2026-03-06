import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import {
  StatusChip,
  DeployPanel,
  ModuleSidebar,
  ModuleQuickActions
} from "../../ui/ShellViews.jsx";
import { RuntimeSettingsDialog } from "../../ui/RuntimeSettingsDialog.jsx";

function AppShellLayout({
  moduleState,
  route,
  handleSelectModule,
  routeUrl,
  connectivityMode,
  runConnectivityCheck,
  handleSignOut,
  viewActions,
  handleRunViewAction,
  requiredDomains,
  remotesDeployDomain,
  runtimeSettingsOpen,
  handleOpenRuntimeSettings,
  handleCloseRuntimeSettings,
  handleOpenRemotes,
  activeModuleView
}) {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "grey.100"
      }}
    >
      <ModuleSidebar
        modules={moduleState.items}
        activeModuleId={route.moduleId}
        onSelectModule={handleSelectModule}
      />

      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Paper
          square
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            px: 2,
            py: 1.5
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={1}
            alignItems={{ xs: "flex-start", sm: "center" }}
            justifyContent="space-between"
          >
            <Stack spacing={0.5}>
              <Typography variant="h6">Crud Control</Typography>
              <Typography variant="caption" color="text.secondary">
                Active route: {routeUrl}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <StatusChip mode={connectivityMode} />
              <Button size="small" variant="outlined" onClick={runConnectivityCheck}>
                Re-check API
              </Button>
              <Button
                size="small"
                variant="outlined"
                onClick={handleOpenRuntimeSettings}
              >
                Runtime settings
              </Button>
              <Button size="small" variant="text" color="inherit" onClick={handleSignOut}>
                Sign out
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Box sx={{ p: 2, overflow: "auto" }}>
          {moduleState.loading ? (
            <Stack direction="row" spacing={1} alignItems="center">
              <CircularProgress size={18} />
              <Typography variant="body2">Loading modules...</Typography>
            </Stack>
          ) : null}

          {moduleState.errorMessage ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {moduleState.errorMessage}
            </Alert>
          ) : null}

          <ModuleQuickActions actions={viewActions} onRunAction={handleRunViewAction} />

          {requiredDomains.has("remotes-deploy") ? (
            <DeployPanel
              state={remotesDeployDomain.deployState}
              remotes={remotesDeployDomain.remotesState.items}
              selectedRemoteId={remotesDeployDomain.selectedRemoteId}
              onSelectRemote={remotesDeployDomain.setSelectedRemoteId}
              onOpenRemotes={handleOpenRemotes}
              onDeployNow={remotesDeployDomain.handleDeployNow}
            />
          ) : null}

          <Divider sx={{ mb: 2 }} />

          {activeModuleView}
        </Box>
      </Box>

      <RuntimeSettingsDialog
        open={runtimeSettingsOpen}
        onClose={handleCloseRuntimeSettings}
        moduleRuntimeState={remotesDeployDomain.moduleRuntimeState}
        onRunModuleAction={remotesDeployDomain.handleRunModuleAction}
      />
    </Box>
  );
}

export { AppShellLayout };
