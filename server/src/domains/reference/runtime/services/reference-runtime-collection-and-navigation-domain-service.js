import { singularFromValue } from "../../../../core/shared/capability-contracts/singularization.js";
export function cloneCollectionDefinition(definition) {
  const fallbackEntitySingular = singularizeCollectionToken(definition?.id ?? "");
  const explicitEntitySingular =
    typeof definition?.entitySingular === "string" && definition.entitySingular.length > 0
      ? definition.entitySingular
      : null;

  return {
    id: definition.id,
    label: definition.label,
    entitySingular: explicitEntitySingular ?? fallbackEntitySingular,
    primaryField: definition.primaryField,
    description: definition.description,
    capabilities: { ...(definition.capabilities ?? {}) },
    fields: Array.isArray(definition.fields)
      ? definition.fields.map((field) => ({ ...field }))
      : []
  };
}

export function cloneCollectionDefinitions(definitions) {
  const cloned = {};
  for (const [collectionId, definition] of Object.entries(definitions ?? {})) {
    cloned[collectionId] = cloneCollectionDefinition(definition);
  }

  return cloned;
}

export function manifestCollectionsForModule(manifest) {
  if (Array.isArray(manifest?.collections) && manifest.collections.length > 0) {
    return manifest.collections.map((collection) => cloneCollectionDefinition(collection));
  }

  return [];
}

export function resolveCollectionDefinitions(registry, options = {}) {
  const enabledOnly = options.activeOnly === true;
  const definitions = {};
  const diagnostics = [];
  const moduleSources = [];
  const collectionModuleMap = {};

  for (const { manifest, state } of registry.list()) {
    if (enabledOnly && state !== "enabled") {
      continue;
    }

    const manifestCollections = manifestCollectionsForModule(manifest);
    for (const collection of manifestCollections) {
      const collectionId = collection.id;
      if (typeof collectionId !== "string" || collectionId.length === 0) {
        diagnostics.push({
          code: "MODULE_COLLECTION_ID_INVALID",
          message: `Module '${manifest.id}' provided collection without id`,
          moduleId: manifest.id
        });
        continue;
      }

      if (collectionModuleMap[collectionId]) {
        diagnostics.push({
          code: "MODULE_COLLECTION_DUPLICATE",
          message: `Collection '${collectionId}' was declared by multiple modules`,
          moduleId: manifest.id,
          collectionId,
          firstModuleId: collectionModuleMap[collectionId]
        });
        continue;
      }

      definitions[collectionId] = cloneCollectionDefinition(collection);
      moduleSources.push(collectionId);
      collectionModuleMap[collectionId] = manifest.id;
    }
  }

  return {
    definitions,
    diagnostics,
    moduleCollectionIds: [...new Set(moduleSources)].sort(),
    collectionModuleMap
  };
}

export function getCollectionDefinition(collectionDefinitions, collectionId) {
  return collectionDefinitions[collectionId] ?? null;
}

export function buildCollectionsPayload(collectionDefinitions) {
  return Object.values(collectionDefinitions).map((collection) => ({
    id: collection.id,
    label: collection.label,
    entitySingular: collection.entitySingular,
    primaryField: collection.primaryField,
    description: collection.description,
    capabilities: { ...collection.capabilities }
  }));
}

function singularizeCollectionToken(value) {
  const singular = singularFromValue(value);
  return singular.length > 0 ? singular : "item";
}

const MODULE_NAVIGATION_POLICY_VISIBLE_UNAVAILABLE = "visible-but-unavailable";

function toRouteAvailability(state) {
  const normalizedState =
    typeof state === "string" && state.length > 0 ? state : "unknown";
  return {
    policy: MODULE_NAVIGATION_POLICY_VISIBLE_UNAVAILABLE,
    visible: true,
    routeAvailable: normalizedState === "enabled",
    state: normalizedState
  };
}

export function toModuleNavigationItem(manifest, state = "unknown") {
  const navigation = manifest?.ui?.navigation ?? {};
  const rawOrder = Number(navigation.order);
  const order = Number.isFinite(rawOrder) ? rawOrder : Number.MAX_SAFE_INTEGER;
  const normalizedState =
    typeof state === "string" && state.length > 0 ? state : "unknown";

  return {
    id: manifest.id,
    label: typeof navigation.label === "string" && navigation.label.length > 0 ? navigation.label : manifest.name,
    icon: typeof navigation.icon === "string" && navigation.icon.length > 0 ? navigation.icon : "extension",
    state: normalizedState,
    routeAvailability: toRouteAvailability(normalizedState),
    order
  };
}

export function buildModuleNavigationItems(registry) {
  return registry
    .list()
    .map(({ manifest, state }) => toModuleNavigationItem(manifest, state))
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
    .map(({ id, label, icon, state, routeAvailability }) => ({
      id,
      label,
      icon,
      state,
      routeAvailability
    }));
}
