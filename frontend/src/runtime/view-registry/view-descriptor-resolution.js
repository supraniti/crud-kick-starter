import {
  COLLECTIONS_ROUTE_STATE_ADAPTER,
  DEFAULT_ROUTE_STATE_ADAPTER,
  MODULE_VIEW_ENTRYPOINTS,
  PRODUCTS_ROUTE_STATE_ADAPTER,
  VIEW_REGISTRATION_CODES,
  createViewRegistry,
  validateViewDescriptor
} from "./registration-primitives.js";
import {
  dedupeRouteViewActions,
  dedupeRouteViewQuickActions,
  isBuiltinRouteViewKind,
  isModuleRouteViewActionType
} from "../shared-capability-bridges/route-view-catalog.mjs";
import {
  CollectionsRouteView,
  MissionsRouteView,
  ProductsRouteView,
  RemotesRouteView,
  TaxonomiesRouteView,
  createCollectionsRouteViewDescriptor
} from "./route-view-components.jsx";

const LEGACY_QUICK_ACTION_ROUTE_ACTIONS = Object.freeze({
  "open-products": Object.freeze({
    id: "open-products",
    label: "Open products",
    type: "navigate",
    route: Object.freeze({
      moduleId: "products",
      state: Object.freeze({
        categoryIds: []
      })
    })
  }),
  "open-taxonomies": Object.freeze({
    id: "open-taxonomies",
    label: "Open taxonomies",
    type: "navigate",
    route: Object.freeze({
      moduleId: "taxonomies",
      state: Object.freeze({
        categoryIds: []
      })
    })
  }),
  "open-remotes": Object.freeze({
    id: "open-remotes",
    label: "Open remotes",
    type: "navigate",
    route: Object.freeze({
      moduleId: "remotes",
      state: Object.freeze({
        categoryIds: []
      })
    })
  }),
  "open-missions": Object.freeze({
    id: "open-missions",
    label: "Open missions",
    type: "navigate",
    route: Object.freeze({
      moduleId: "missions",
      state: Object.freeze({
        categoryIds: []
      })
    })
  })
});

function resolveLegacyQuickActionRouteAction(quickActionId) {
  if (typeof quickActionId !== "string" || quickActionId.length === 0) {
    return null;
  }

  return LEGACY_QUICK_ACTION_ROUTE_ACTIONS[quickActionId] ?? null;
}

function hasRuntimeCollections(moduleItem) {
  return (
    Array.isArray(moduleItem?.collectionIds) &&
    moduleItem.collectionIds.some(
      (collectionId) => typeof collectionId === "string" && collectionId.length > 0
    )
  );
}

function routeViewConfigForModule(moduleItem) {
  if (!moduleItem || typeof moduleItem.ui !== "object" || !moduleItem.ui) {
    return null;
  }

  const routeView = moduleItem.ui.routeView;
  if (!routeView || typeof routeView !== "object" || Array.isArray(routeView)) {
    return null;
  }

  const kind = typeof routeView.kind === "string" ? routeView.kind.trim() : "";
  const entrypoint =
    typeof routeView.entrypoint === "string" ? routeView.entrypoint.trim() : "";
  const quickActions = dedupeRouteViewQuickActions(routeView.quickActions);
  const actions = dedupeRouteViewActions(routeView.actions);
  return {
    kind,
    entrypoint,
    quickActions,
    actions
  };
}

function normalizeManifestEntrypoint(value) {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.replace(/\\/g, "/").trim();
  if (normalized.length === 0) {
    return "";
  }

  if (!normalized.startsWith("./")) {
    return "";
  }

  return normalized;
}

const BUILTIN_ROUTE_VIEW_DESCRIPTOR_FACTORIES = {
  collections: (moduleId, routeViewConfig = null) => ({
    moduleId,
    render: CollectionsRouteView,
    usesCollectionsDomain: true,
    requiredDomains: ["collections", "module-settings"],
    quickActions: dedupeRouteViewQuickActions(routeViewConfig?.quickActions),
    actions: dedupeRouteViewActions(routeViewConfig?.actions),
    routeStateAdapter: COLLECTIONS_ROUTE_STATE_ADAPTER
  }),
  products: (moduleId, routeViewConfig = null) => ({
    moduleId,
    render: ProductsRouteView,
    usesCollectionsDomain: false,
    requiredDomains: ["products-taxonomies"],
    quickActions: dedupeRouteViewQuickActions(routeViewConfig?.quickActions),
    actions: dedupeRouteViewActions(routeViewConfig?.actions),
    routeStateAdapter: PRODUCTS_ROUTE_STATE_ADAPTER
  }),
  missions: (moduleId, routeViewConfig = null) => ({
    moduleId,
    render: MissionsRouteView,
    usesCollectionsDomain: false,
    requiredDomains: ["mission-operator"],
    quickActions: dedupeRouteViewQuickActions(routeViewConfig?.quickActions),
    actions: dedupeRouteViewActions(routeViewConfig?.actions),
    routeStateAdapter: DEFAULT_ROUTE_STATE_ADAPTER
  }),
  taxonomies: (moduleId, routeViewConfig = null) => ({
    moduleId,
    render: TaxonomiesRouteView,
    usesCollectionsDomain: false,
    requiredDomains: ["products-taxonomies"],
    quickActions: dedupeRouteViewQuickActions(routeViewConfig?.quickActions),
    actions: dedupeRouteViewActions(routeViewConfig?.actions),
    routeStateAdapter: DEFAULT_ROUTE_STATE_ADAPTER
  }),
  remotes: (moduleId, routeViewConfig = null) => ({
    moduleId,
    render: RemotesRouteView,
    usesCollectionsDomain: false,
    requiredDomains: ["remotes-deploy", "module-settings"],
    quickActions: dedupeRouteViewQuickActions(routeViewConfig?.quickActions),
    actions: dedupeRouteViewActions(routeViewConfig?.actions),
    routeStateAdapter: DEFAULT_ROUTE_STATE_ADAPTER
  })
};

function resolveBuiltinRouteViewDescriptors(moduleRuntimeItems) {
  const descriptors = [];
  const diagnostics = [];

  for (const moduleItem of moduleRuntimeItems ?? []) {
    const moduleId = typeof moduleItem?.id === "string" ? moduleItem.id.trim() : "";
    if (!moduleId) {
      continue;
    }

    const routeViewConfig = routeViewConfigForModule(moduleItem);
    if (routeViewConfig?.kind === "custom") {
      continue;
    }

    const resolvedKind =
      routeViewConfig?.kind || (hasRuntimeCollections(moduleItem) ? "collections" : "");
    if (!resolvedKind) {
      continue;
    }

    const descriptorFactory = BUILTIN_ROUTE_VIEW_DESCRIPTOR_FACTORIES[resolvedKind];
    if (typeof descriptorFactory !== "function") {
      if (
        routeViewConfig?.entrypoint &&
        !isBuiltinRouteViewKind(routeViewConfig.kind)
      ) {
        continue;
      }
      diagnostics.push({
        code: VIEW_REGISTRATION_CODES.ROUTE_KIND_INVALID,
        message: `Module '${moduleId}' declares unsupported routeView kind '${resolvedKind}'`,
        moduleId,
        kind: resolvedKind
      });
      continue;
    }

    descriptors.push(descriptorFactory(moduleId, routeViewConfig));
  }

  return {
    descriptors,
    diagnostics
  };
}

function parseEntrypointDiscoveryPath(entrypointPath) {
  if (typeof entrypointPath !== "string") {
    return null;
  }

  const normalized = entrypointPath.replace(/\\/g, "/");
  const pathWithoutQuery = normalized.split("?")[0];
  const match = pathWithoutQuery.match(
    /(?:^|\/)modules\/([^/]+)\/(frontend\/.+\.(js|mjs|jsx))$/
  );
  if (!match) {
    return null;
  }

  const moduleId = match[1] ?? null;
  const relativeEntrypointPath = match[2] ?? null;
  if (!moduleId || !relativeEntrypointPath) {
    return null;
  }

  return {
    moduleId,
    relativeEntrypointPath,
    manifestEntrypoint: `./${relativeEntrypointPath}`
  };
}

function resolveEntrypointExportDescriptors(entrypointModule, context = {}) {
  if (typeof entrypointModule?.registerModuleViews === "function") {
    return entrypointModule.registerModuleViews({
      createCollectionsRouteViewDescriptor,
      moduleId: context.moduleId,
      moduleItem: context.moduleItem,
      routeView: context.routeViewConfig
    });
  }

  if (Array.isArray(entrypointModule?.viewDescriptors)) {
    return entrypointModule.viewDescriptors;
  }

  if (entrypointModule?.viewDescriptor) {
    return [entrypointModule.viewDescriptor];
  }

  return null;
}

function resolveRuntimeModuleId(moduleItem) {
  return typeof moduleItem?.id === "string" ? moduleItem.id.trim() : "";
}

function resolveModuleViewEntrypointsSource(options = {}) {
  return options?.moduleViewEntrypoints && typeof options.moduleViewEntrypoints === "object"
    ? options.moduleViewEntrypoints
    : MODULE_VIEW_ENTRYPOINTS;
}

function discoverModuleEntrypoints(moduleViewEntrypoints) {
  const diagnostics = [];
  const entrypointsByModuleId = new Map();

  for (const [entrypointPath, entrypointModule] of Object.entries(moduleViewEntrypoints)) {
    const parsedEntrypointPath = parseEntrypointDiscoveryPath(entrypointPath);
    if (!parsedEntrypointPath) {
      continue;
    }

    const { moduleId, manifestEntrypoint } = parsedEntrypointPath;
    const moduleEntrypoints = entrypointsByModuleId.get(moduleId) ?? new Map();
    if (moduleEntrypoints.has(manifestEntrypoint)) {
      diagnostics.push({
        code: VIEW_REGISTRATION_CODES.ENTRYPOINT_DUPLICATE,
        message: `Duplicate frontend view entrypoint '${manifestEntrypoint}' was discovered for module '${moduleId}'`,
        moduleId
      });
      continue;
    }

    moduleEntrypoints.set(manifestEntrypoint, {
      entrypointPath,
      entrypointModule,
      manifestEntrypoint
    });
    entrypointsByModuleId.set(moduleId, moduleEntrypoints);
  }

  return {
    diagnostics,
    entrypointsByModuleId
  };
}

function shouldResolveModuleEntrypoint(routeViewConfig) {
  const routeKind = typeof routeViewConfig.kind === "string" ? routeViewConfig.kind : "";
  return routeKind === "custom" || (!isBuiltinRouteViewKind(routeKind) && routeViewConfig.entrypoint);
}

function resolveEntrypointRegistration(moduleEntrypoints, routeViewConfig) {
  const configuredEntrypoint = normalizeManifestEntrypoint(routeViewConfig.entrypoint);
  if (configuredEntrypoint.length > 0) {
    return {
      configuredEntrypoint,
      entrypointRegistration: moduleEntrypoints.get(configuredEntrypoint) ?? null
    };
  }

  if (moduleEntrypoints.size === 1) {
    return {
      configuredEntrypoint,
      entrypointRegistration: moduleEntrypoints.values().next().value ?? null
    };
  }

  return {
    configuredEntrypoint,
    entrypointRegistration: null
  };
}

function createEntrypointMissingDiagnostic(moduleId, moduleEntrypoints, routeViewConfig, configuredEntrypoint) {
  const availableEntrypoints = [...moduleEntrypoints.keys()].sort();
  const configuredEntrypointLabel =
    configuredEntrypoint.length > 0 ? configuredEntrypoint : routeViewConfig.entrypoint || null;
  const resolutionHint =
    configuredEntrypoint.length === 0 && availableEntrypoints.length > 1
      ? "Module routeView.entrypoint must be explicit when multiple module frontend entrypoints are present"
      : "Module routeView.entrypoint did not match a discovered frontend entrypoint";

  return {
    code: VIEW_REGISTRATION_CODES.ENTRYPOINT_MISSING,
    message: `Module '${moduleId}' declares custom routeView but no matching frontend entrypoint was found`,
    moduleId,
    entrypoint: configuredEntrypointLabel,
    availableEntrypoints,
    resolutionHint
  };
}

function resolveDescriptorQuickActionsWithFallback(descriptor, routeViewConfig) {
  return descriptor.quickActions.length > 0
    ? descriptor.quickActions
    : dedupeRouteViewQuickActions(routeViewConfig?.quickActions);
}

function resolveDescriptorActionsWithFallback(descriptor, routeViewConfig) {
  return descriptor.actions.length > 0
    ? descriptor.actions
    : dedupeRouteViewActions(routeViewConfig?.actions);
}

function descriptorRequiresModuleActionRunner(actions, runAction) {
  return (
    actions.some((action) => isModuleRouteViewActionType(action?.type)) &&
    typeof runAction !== "function"
  );
}

function appendEntrypointDescriptorsForModule({
  descriptors,
  diagnostics,
  moduleId,
  moduleItem,
  routeViewConfig,
  entrypointModule
}) {
  const entrypointDescriptors = resolveEntrypointExportDescriptors(entrypointModule, {
    moduleId,
    moduleItem,
    routeViewConfig
  });
  if (!Array.isArray(entrypointDescriptors) || entrypointDescriptors.length === 0) {
    diagnostics.push({
      code: VIEW_REGISTRATION_CODES.ENTRYPOINT_INVALID,
      message: `Module '${moduleId}' frontend entrypoint must export registerModuleViews(), viewDescriptor, or viewDescriptors`,
      moduleId
    });
    return;
  }

  for (const [index, descriptor] of entrypointDescriptors.entries()) {
    const validated = validateViewDescriptor(descriptor, index);
    if (!validated.ok) {
      diagnostics.push({
        ...validated.error,
        moduleId
      });
      continue;
    }

    if (validated.value.moduleId !== moduleId) {
      diagnostics.push({
        code: VIEW_REGISTRATION_CODES.ENTRYPOINT_MODULE_MISMATCH,
        message: `Module '${moduleId}' entrypoint descriptor moduleId '${validated.value.moduleId}' is not allowed`,
        moduleId,
        descriptorModuleId: validated.value.moduleId
      });
      continue;
    }

    const resolvedQuickActions = resolveDescriptorQuickActionsWithFallback(
      validated.value,
      routeViewConfig
    );
    const resolvedActions = resolveDescriptorActionsWithFallback(
      validated.value,
      routeViewConfig
    );
    if (descriptorRequiresModuleActionRunner(resolvedActions, validated.value.runAction)) {
      diagnostics.push({
        code: VIEW_REGISTRATION_CODES.ACTION_RUNNER_INVALID,
        message: `Module '${moduleId}' routeView actions include type 'module' or 'module:<token>' but descriptor runAction is not defined`,
        moduleId,
        field: "runAction"
      });
      continue;
    }

    descriptors.push({
      ...validated.value,
      quickActions: resolvedQuickActions,
      actions: resolvedActions
    });
  }
}

function resolveModuleEntrypointDescriptors(moduleRuntimeItems, options = {}) {
  const descriptors = [];
  const moduleViewEntrypoints = resolveModuleViewEntrypointsSource(options);
  const { diagnostics, entrypointsByModuleId } = discoverModuleEntrypoints(moduleViewEntrypoints);

  for (const moduleItem of moduleRuntimeItems ?? []) {
    const moduleId = resolveRuntimeModuleId(moduleItem);
    if (!moduleId) {
      continue;
    }

    const routeViewConfig = routeViewConfigForModule(moduleItem);
    if (!routeViewConfig || !shouldResolveModuleEntrypoint(routeViewConfig)) {
      continue;
    }

    const moduleEntrypoints = entrypointsByModuleId.get(moduleId) ?? new Map();
    const { configuredEntrypoint, entrypointRegistration } = resolveEntrypointRegistration(
      moduleEntrypoints,
      routeViewConfig
    );

    if (!entrypointRegistration) {
      diagnostics.push(
        createEntrypointMissingDiagnostic(
          moduleId,
          moduleEntrypoints,
          routeViewConfig,
          configuredEntrypoint
        )
      );
      continue;
    }

    appendEntrypointDescriptorsForModule({
      descriptors,
      diagnostics,
      moduleId,
      moduleItem,
      routeViewConfig,
      entrypointModule: entrypointRegistration.entrypointModule
    });
  }

  return {
    descriptors,
    diagnostics
  };
}

function createResolvedViewRegistry({
  moduleRuntimeItems = [],
  moduleViewEntrypoints
} = {}) {
  const builtinResolution = resolveBuiltinRouteViewDescriptors(moduleRuntimeItems);
  const entrypointResolution = resolveModuleEntrypointDescriptors(moduleRuntimeItems, {
    moduleViewEntrypoints
  });
  const registry = createViewRegistry([
    ...builtinResolution.descriptors,
    ...entrypointResolution.descriptors
  ]);

  return {
    registrations: registry.registrations,
    diagnostics: [
      ...builtinResolution.diagnostics,
      ...entrypointResolution.diagnostics,
      ...registry.diagnostics
    ]
  };
}

const { diagnostics: MODULE_VIEW_REGISTRY_DIAGNOSTICS } = createResolvedViewRegistry();

function resolveViewRegistration(moduleId, options = {}) {
  const { registrations } = createResolvedViewRegistry(options);
  return registrations.get(moduleId) ?? null;
}

function isCollectionsRouteModule(moduleId, options = {}) {
  const registration = resolveViewRegistration(moduleId, options);
  return registration?.usesCollectionsDomain === true;
}

export {
  MODULE_VIEW_REGISTRY_DIAGNOSTICS,
  createResolvedViewRegistry,
  isCollectionsRouteModule,
  resolveLegacyQuickActionRouteAction,
  resolveViewRegistration
};

