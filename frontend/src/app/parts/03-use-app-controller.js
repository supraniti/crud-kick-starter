import { useCallback, useState } from "react";
import { useRemotesDeployDomain } from "../../domains/remotes-deploy/useRemotesDeployDomain.js";
import {
  parseRouteFromLocation,
  resolveViewRegistration
} from "../../runtime/view-registry.jsx";
import {
  defaultApiClients,
  readAuthSession
} from "./01-app-config.js";
import {
  buildAppControllerResult,
  resolveActiveModuleViewState,
  useAppDomains,
  useAuthHandlers,
  useCollectionRouteHandlers,
  useConnectivity,
  useEnsureRouteModuleExists,
  useModuleRouteHandlers,
  useModuleStateLoader,
  useRouteLifecycle,
  useRouteNavigation,
  useViewActionHandlers
} from "./03-use-app-controller.helpers.js";

function resolveRequiredDomainsForModule(moduleId, moduleRuntimeItems) {
  const viewRegistration = resolveViewRegistration(moduleId, {
    moduleRuntimeItems
  });

  return Array.isArray(viewRegistration?.requiredDomains)
    ? viewRegistration.requiredDomains
    : [];
}

function resolveActiveModuleViewContext({
  route,
  moduleRuntimeItems,
  moduleStateItems,
  selectedCategoryIds,
  appDomains,
  remotesDeployDomain,
  handleToggleCategory,
  handleRemoveCategory,
  handleOpenRemotes,
  handleOpenTaxonomies
}) {
  return resolveActiveModuleViewState({
    route,
    moduleRuntimeItems,
    moduleStateItems,
    selectedCategoryIds,
    productsTaxonomiesDomain: appDomains.productsTaxonomiesDomain,
    collectionsDomain: appDomains.collectionsDomain,
    moduleSettingsDomain: appDomains.moduleSettingsDomain,
    missionOperatorDomain: appDomains.missionOperatorDomain,
    remotesDeployDomain,
    handleToggleCategory,
    handleRemoveCategory,
    handleOpenRemotes,
    handleOpenTaxonomies
  });
}

function useAppController({ api = defaultApiClients }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => readAuthSession());
  const [route, setRoute] = useState(() => parseRouteFromLocation());
  const [runtimeSettingsOpen, setRuntimeSettingsOpen] = useState(false);
  const handleOpenRuntimeSettings = useCallback(() => {
    setRuntimeSettingsOpen(true);
  }, []);
  const handleCloseRuntimeSettings = useCallback(() => {
    setRuntimeSettingsOpen(false);
  }, []);
  const remotesDeployDomain = useRemotesDeployDomain({
    api,
    isAuthenticated,
    activeModuleId: route.moduleId,
    resolveRemotesDeployEnabled: ({ activeModuleId, moduleRuntimeItems }) =>
      resolveRequiredDomainsForModule(activeModuleId, moduleRuntimeItems).includes(
        "remotes-deploy"
      )
  });
  const moduleRuntimeItems = remotesDeployDomain.moduleRuntimeState.items;
  const activeViewRegistration = resolveViewRegistration(route.moduleId, {
    moduleRuntimeItems
  });
  const requiredDomains = new Set(
    resolveRequiredDomainsForModule(route.moduleId, moduleRuntimeItems)
  );
  const selectedCategoryIds = route.categoryIds ?? [];
  const isCollectionsRouteActive = requiredDomains.has("collections");
  const navigate = useRouteNavigation(setRoute, moduleRuntimeItems);
  const collectionRouteHandlers = useCollectionRouteHandlers({
    navigate,
    isCollectionsRouteActive,
    route
  });
  const { connectivityMode, runConnectivityCheck } = useConnectivity(api);
  useRouteLifecycle({
    isAuthenticated,
    moduleRuntimeItems,
    setRoute,
    navigate,
    route
  });
  const moduleState = useModuleStateLoader({
    api,
    isAuthenticated,
    reloadToken: remotesDeployDomain.moduleRuntimeReloadToken
  });
  useEnsureRouteModuleExists({
    isAuthenticated,
    moduleRuntimeItems,
    moduleStateItems: moduleState.items,
    navigate
  });
  const appDomains = useAppDomains({
    api,
    isAuthenticated,
    requiredDomains,
    route,
    selectedCategoryIds,
    isCollectionsRouteActive,
    moduleRuntimeItems,
    remotesDeployDomain,
    collectionRouteHandlers
  });
  const { handleSignIn, handleSignOut } = useAuthHandlers({
    setIsAuthenticated,
    setRoute,
    setRuntimeSettingsOpen,
    navigate,
    route
  });
  const {
    handleSelectModule,
    handleToggleCategory,
    handleRemoveCategory,
    handleOpenTaxonomies,
    handleOpenRemotes
  } = useModuleRouteHandlers({
    route, moduleRuntimeItems, selectedCategoryIds, navigate
  });
  const { viewActions, handleRunViewAction } = useViewActionHandlers({
    activeViewRegistration,
    route,
    navigate,
    moduleRuntimeItems
  });
  const { routeUrl, activeModuleView } = resolveActiveModuleViewContext({
    route,
    moduleRuntimeItems,
    moduleStateItems: moduleState.items,
    selectedCategoryIds,
    appDomains,
    remotesDeployDomain,
    handleToggleCategory,
    handleRemoveCategory,
    handleOpenRemotes,
    handleOpenTaxonomies
  });
  return buildAppControllerResult({
    isAuthenticated,
    handleSignIn,
    route,
    moduleState,
    connectivityMode,
    runConnectivityCheck,
    handleSignOut,
    viewActions,
    handleRunViewAction,
    requiredDomains,
    remotesDeployDomain,
    activeModuleView,
    routeUrl,
    handleSelectModule,
    handleOpenRemotes,
    runtimeSettingsOpen,
    handleOpenRuntimeSettings,
    handleCloseRuntimeSettings
  });
}

export { useAppController };
