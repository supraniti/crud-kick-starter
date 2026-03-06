import { Stack, Typography } from "@mui/material";
import {
  dedupeRouteViewActions,
  dedupeRouteViewQuickActions
} from "../../../runtime/shared-capability-bridges/route-view-catalog.mjs";

const MODULE_ID = "articles";

function ArticlesControlSurface() {
  return (
    <Stack spacing={1.5}>
      <Typography variant="h5">Articles Control Center</Typography>
      <Typography variant="body2" color="text.secondary">
        Articles custom control surface is mounted without collections-domain coupling.
      </Typography>
    </Stack>
  );
}

function registerModuleViews({ routeView } = {}) {
  return [
    {
      moduleId: MODULE_ID,
      usesCollectionsDomain: false,
      requiredDomains: [],
      quickActions: dedupeRouteViewQuickActions(routeView?.quickActions),
      actions: dedupeRouteViewActions(routeView?.actions),
      render: () => <ArticlesControlSurface />
    }
  ];
}

export { registerModuleViews };
