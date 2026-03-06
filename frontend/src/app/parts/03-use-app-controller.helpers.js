import { useCallback, useEffect, useState } from "react";
import { useCollectionsDomain } from "../../domains/collections/useCollectionsDomain.js";
import { useMissionOperatorDomain } from "../../domains/mission-operator/useMissionOperatorDomain.js";
import { useModuleSettingsDomain } from "../../domains/module-settings/useModuleSettingsDomain.js";
import { useProductsTaxonomiesDomain } from "../../domains/products-taxonomies/useProductsTaxonomiesDomain.js";
import {
  DEFAULT_MODULE_ID,
  buildRouteForModuleSelection,
  buildRouteUrl,
  normalizeRoute,
  parseRouteFromLocation,
  renderActiveModuleView
} from "../../runtime/view-registry.jsx";
import { writeAuthSession } from "./01-app-config.js";
import {
  isPlainObject,
  resolveModuleViewActions,
  runModuleViewAction
} from "./02-view-actions.js";

function createDefaultModuleState() {
  return {
    loading: false,
    errorMessage: null,
    items: []
  };
}

function serializeRouteValue(value) {
  if (Array.isArray(value)) {
    return value.join(",");
  }

  return typeof value === "string" ? value : "";
}

function useRouteNavigation(setRoute, moduleRuntimeItems) {
  return useCallback(
    (nextRoute, options = {}) => {
      const normalizedRoute = normalizeRoute(nextRoute, {
        moduleRuntimeItems
      });
      const nextUrl = buildRouteUrl(normalizedRoute, {
        moduleRuntimeItems
      });
      const currentUrl = `${window.location.pathname}${window.location.search}`;

      if (currentUrl !== nextUrl) {
        if (options.replace) {
          window.history.replaceState({}, "", nextUrl);
        } else {
          window.history.pushState({}, "", nextUrl);
        }
      }

      setRoute(normalizedRoute);
    },
    [moduleRuntimeItems, setRoute]
  );
}

function useCollectionRouteHandlers({
  navigate,
  isCollectionsRouteActive,
  route
}) {
  const handleCollectionErrorAction = useCallback(
    (action) => {
      if (!action || typeof action !== "object") {
        return;
      }

      if (action.type === "navigate" && isPlainObject(action.route)) {
        const routeModuleId =
          typeof action.route.moduleId === "string" ? action.route.moduleId : "";
        if (routeModuleId.length === 0) {
          return;
        }

        navigate(
          {
            moduleId: routeModuleId,
            ...(isPlainObject(action.route.state) ? action.route.state : {})
          },
          { replace: false }
        );
        return;
      }

      if (action.type === "external") {
        const href = typeof action.href === "string" ? action.href : "";
        if (href.length === 0) {
          return;
        }
        if (action.target === "self") {
          window.location.assign(href);
          return;
        }

        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    [navigate]
  );

  const handleCollectionRouteFilterChange = useCallback(
    ({ queryKey, value }) => {
      if (!isCollectionsRouteActive) {
        return;
      }
      if (typeof queryKey !== "string" || queryKey.length === 0) {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(route, queryKey)) {
        return;
      }

      const currentSerialized = serializeRouteValue(route[queryKey]);
      const nextSerialized = serializeRouteValue(value);
      if (currentSerialized === nextSerialized) {
        return;
      }

      navigate(
        {
          ...route,
          [queryKey]: value
        },
        { replace: true }
      );
    },
    [isCollectionsRouteActive, navigate, route]
  );

  const handleCollectionRouteSelectionChange = useCallback(
    ({ collectionId }) => {
      if (!isCollectionsRouteActive) {
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(route, "collectionId")) {
        return;
      }

      const nextCollectionId = typeof collectionId === "string" ? collectionId : "";
      const currentCollectionId =
        typeof route.collectionId === "string" ? route.collectionId : "";
      if (currentCollectionId === nextCollectionId) {
        return;
      }

      navigate(
        {
          ...route,
          collectionId: nextCollectionId
        },
        { replace: true }
      );
    },
    [isCollectionsRouteActive, navigate, route]
  );

  return {
    handleCollectionErrorAction,
    handleCollectionRouteFilterChange,
    handleCollectionRouteSelectionChange
  };
}

function useConnectivity(api) {
  const [connectivityMode, setConnectivityMode] = useState("checking");

  const runConnectivityCheck = useCallback(async () => {
    setConnectivityMode("checking");

    try {
      const payload = await api.ping();
      setConnectivityMode(payload?.ok ? "connected" : "disconnected");
    } catch {
      setConnectivityMode("disconnected");
    }
  }, [api]);

  useEffect(() => {
    runConnectivityCheck();
  }, [runConnectivityCheck]);

  return {
    connectivityMode,
    runConnectivityCheck
  };
}

function useRouteLifecycle({
  isAuthenticated,
  moduleRuntimeItems,
  setRoute,
  navigate,
  route
}) {
  useEffect(() => {
    function handlePopState() {
      setRoute(parseRouteFromLocation({ moduleRuntimeItems }));
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [moduleRuntimeItems, setRoute]);

  useEffect(() => {
    const parsedRoute = parseRouteFromLocation({ moduleRuntimeItems });
    setRoute(parsedRoute);
  }, [moduleRuntimeItems, setRoute]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    if (!window.location.pathname.startsWith("/app/")) {
      navigate(route, { replace: true });
    }
  }, [isAuthenticated, navigate, route]);
}

function useModuleStateLoader({ api, isAuthenticated, reloadToken }) {
  const [moduleState, setModuleState] = useState(() => createDefaultModuleState());

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;
    setModuleState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .listModules()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setModuleState({
          loading: false,
          errorMessage: null,
          items: payload?.items ?? []
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setModuleState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load modules",
          items: []
        });
      });

    return () => {
      cancelled = true;
    };
  }, [api, isAuthenticated, reloadToken]);

  return moduleState;
}

function useEnsureRouteModuleExists({
  isAuthenticated,
  moduleRuntimeItems,
  moduleStateItems,
  navigate
}) {
  useEffect(() => {
    if (!isAuthenticated || moduleStateItems.length === 0) {
      return;
    }

    const routeFromLocation = parseRouteFromLocation({
      moduleRuntimeItems
    });
    const exists = moduleStateItems.some(
      (moduleItem) => moduleItem.id === routeFromLocation.moduleId
    );
    if (!exists) {
      navigate(
        {
          moduleId: moduleStateItems[0].id,
          categoryIds: []
        },
        { replace: true }
      );
    }
  }, [isAuthenticated, moduleRuntimeItems, moduleStateItems, navigate]);
}

function useAuthHandlers({
  setIsAuthenticated,
  setRoute,
  setRuntimeSettingsOpen,
  navigate,
  route
}) {
  const handleSignIn = useCallback(() => {
    setIsAuthenticated(true);
    writeAuthSession(true);
    navigate(route, { replace: true });
  }, [navigate, route, setIsAuthenticated]);

  const handleSignOut = useCallback(() => {
    setRuntimeSettingsOpen(false);
    setIsAuthenticated(false);
    writeAuthSession(false);
    setRoute({
      moduleId: DEFAULT_MODULE_ID,
      categoryIds: []
    });
    window.history.replaceState({}, "", "/");
  }, [setIsAuthenticated, setRoute, setRuntimeSettingsOpen]);

  return {
    handleSignIn,
    handleSignOut
  };
}

function useModuleRouteHandlers({
  route,
  moduleRuntimeItems,
  selectedCategoryIds,
  navigate
}) {
  const handleSelectModule = useCallback(
    (moduleId) => {
      const nextRoute = buildRouteForModuleSelection(moduleId, {
        currentRoute: route,
        moduleRuntimeItems
      });
      navigate(nextRoute, { replace: false });
    },
    [moduleRuntimeItems, navigate, route]
  );

  const handleToggleCategory = useCallback(
    (categoryId) => {
      const exists = selectedCategoryIds.includes(categoryId);
      const nextCategoryIds = exists
        ? selectedCategoryIds.filter((id) => id !== categoryId)
        : [...selectedCategoryIds, categoryId];

      navigate(
        {
          moduleId: route.moduleId,
          categoryIds: nextCategoryIds
        },
        { replace: false }
      );
    },
    [navigate, route.moduleId, selectedCategoryIds]
  );

  const handleRemoveCategory = useCallback(
    (categoryId) => {
      navigate(
        {
          moduleId: route.moduleId,
          categoryIds: selectedCategoryIds.filter((id) => id !== categoryId)
        },
        { replace: false }
      );
    },
    [navigate, route.moduleId, selectedCategoryIds]
  );

  const handleOpenTaxonomies = useCallback(() => {
    navigate({ moduleId: "taxonomies", categoryIds: [] }, { replace: false });
  }, [navigate]);

  const handleOpenRemotes = useCallback(() => {
    navigate({ moduleId: "remotes", categoryIds: [] }, { replace: false });
  }, [navigate]);

  return {
    handleSelectModule,
    handleToggleCategory,
    handleRemoveCategory,
    handleOpenTaxonomies,
    handleOpenRemotes
  };
}

function useViewActionHandlers({
  activeViewRegistration,
  route,
  navigate,
  moduleRuntimeItems
}) {
  const viewActions = resolveModuleViewActions(activeViewRegistration);
  const handleRunViewAction = useCallback(
    (actionId) => {
      runModuleViewAction({
        actionId,
        viewActions,
        activeViewRegistration,
        route,
        navigate,
        moduleRuntimeItems
      });
    },
    [activeViewRegistration, moduleRuntimeItems, navigate, route, viewActions]
  );

  return {
    viewActions,
    handleRunViewAction
  };
}

function useAppDomains({
  api,
  isAuthenticated,
  requiredDomains,
  route,
  selectedCategoryIds,
  isCollectionsRouteActive,
  moduleRuntimeItems,
  remotesDeployDomain,
  collectionRouteHandlers
}) {
  const productsTaxonomiesDomain = useProductsTaxonomiesDomain({
    api,
    isAuthenticated,
    enabled: requiredDomains.has("products-taxonomies"),
    activeModuleId: route.moduleId,
    selectedCategoryIds,
    onDomainMutation: remotesDeployDomain.bumpDeployReloadToken
  });
  const collectionsDomain = useCollectionsDomain({
    api,
    isAuthenticated,
    enabled: requiredDomains.has("collections"),
    isCollectionsRouteActive,
    moduleRuntimeItems,
    moduleRuntimeReloadToken: remotesDeployDomain.moduleRuntimeReloadToken,
    onCollectionMutation: remotesDeployDomain.bumpDeployReloadToken,
    onCollectionErrorAction: collectionRouteHandlers.handleCollectionErrorAction,
    routeState: route,
    onCollectionRouteFilterChange: collectionRouteHandlers.handleCollectionRouteFilterChange,
    onCollectionRouteSelectionChange:
      collectionRouteHandlers.handleCollectionRouteSelectionChange
  });
  const moduleSettingsDomain = useModuleSettingsDomain({
    api,
    isAuthenticated,
    enabled: requiredDomains.has("module-settings"),
    activeModuleId: route.moduleId,
    runtimeSettingsPolicyState: remotesDeployDomain.moduleRuntimeState
  });
  const missionOperatorDomain = useMissionOperatorDomain({
    api,
    isAuthenticated,
    enabled: requiredDomains.has("mission-operator"),
    activeModuleId: route.moduleId
  });

  return {
    productsTaxonomiesDomain,
    collectionsDomain,
    moduleSettingsDomain,
    missionOperatorDomain
  };
}

function resolveActiveModuleViewState({
  route,
  moduleRuntimeItems,
  moduleStateItems,
  selectedCategoryIds,
  productsTaxonomiesDomain,
  collectionsDomain,
  moduleSettingsDomain,
  missionOperatorDomain,
  remotesDeployDomain,
  handleToggleCategory,
  handleRemoveCategory,
  handleOpenRemotes,
  handleOpenTaxonomies
}) {
  const routeUrl = buildRouteUrl(route, {
    moduleRuntimeItems
  });
  const activeModuleLabel =
    moduleStateItems.find((moduleItem) => moduleItem.id === route.moduleId)?.label ??
    route.moduleId;
  const activeModuleView = renderActiveModuleView({
    route,
    activeModuleLabel,
    moduleRuntimeItems,
    selectedCategoryIds,
    productsTaxonomiesDomain,
    collectionsDomain,
    moduleSettingsDomain,
    missionOperatorDomain,
    remotesDeployDomain,
    onToggleCategory: handleToggleCategory,
    onRemoveCategory: handleRemoveCategory,
    onOpenRemotes: handleOpenRemotes,
    onOpenTaxonomies: handleOpenTaxonomies
  });

  return {
    routeUrl,
    activeModuleView
  };
}

function buildAppControllerResult({
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
}) {
  return {
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
  };
}

export {
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
};
