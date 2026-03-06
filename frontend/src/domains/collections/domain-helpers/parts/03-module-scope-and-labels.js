import { singularFromValue } from "../../../../runtime/shared-capability-bridges/singularization.mjs";

function singularizeCollectionLabel(value) {
  return singularFromValue(value);
}

function normalizeEntitySingularLabel(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : "";
}

function getCollectionEntityLabel(collectionId, options = {}) {
  if (typeof collectionId !== "string" || collectionId.length === 0) {
    return "item";
  }

  const schemaEntitySingular = normalizeEntitySingularLabel(
    options.collectionSchema?.entitySingular
  );
  if (schemaEntitySingular.length > 0) {
    return schemaEntitySingular;
  }

  const collectionEntitySingular = normalizeEntitySingularLabel(
    options.collection?.entitySingular
  );
  if (collectionEntitySingular.length > 0) {
    return collectionEntitySingular;
  }

  if (typeof options.collectionSchema?.label === "string") {
    return singularizeCollectionLabel(options.collectionSchema.label).toLowerCase();
  }

  if (typeof options.collection?.label === "string") {
    return singularizeCollectionLabel(options.collection.label).toLowerCase();
  }

  return singularizeCollectionLabel(collectionId).toLowerCase();
}

function buildCollectionUnavailableMessage(collectionId) {
  return `Collection '${collectionId}' is unavailable. Re-enable its owning module in Remotes > Module Runtime Controls.`;
}

function resolveActiveModuleIdFromPath(pathname) {
  if (typeof pathname !== "string" || pathname.length === 0) {
    return "";
  }

  const match = pathname.match(/^\/app\/([^/?#]+)/);
  return match?.[1] ?? "";
}

function normalizeModuleCollectionIds(collectionIds) {
  if (!Array.isArray(collectionIds)) {
    return [];
  }

  const normalized = [];
  for (const collectionId of collectionIds) {
    const id = typeof collectionId === "string" ? collectionId.trim() : "";
    if (!id || normalized.includes(id)) {
      continue;
    }
    normalized.push(id);
  }

  return normalized;
}

function buildModuleCollectionMap(moduleRuntimeItems) {
  const map = {};

  if (!Array.isArray(moduleRuntimeItems)) {
    return map;
  }

  for (const moduleItem of moduleRuntimeItems) {
    const moduleId = typeof moduleItem?.id === "string" ? moduleItem.id.trim() : "";
    if (!moduleId) {
      continue;
    }

    map[moduleId] = normalizeModuleCollectionIds(moduleItem.collectionIds);
  }

  return map;
}

function resolveModuleScopedCollections(
  collectionsItems,
  activeModuleId,
  moduleCollectionMap
) {
  if (!Array.isArray(collectionsItems) || collectionsItems.length === 0) {
    return [];
  }

  const runtimeScopedCollectionIds = normalizeModuleCollectionIds(
    moduleCollectionMap?.[activeModuleId] ?? []
  );
  if (runtimeScopedCollectionIds.length > 0) {
    const runtimeScopedSet = new Set(runtimeScopedCollectionIds);
    return collectionsItems.filter((collection) => runtimeScopedSet.has(collection.id));
  }

  const directMatches = collectionsItems.filter(
    (collection) => collection.id === activeModuleId
  );
  if (directMatches.length > 0) {
    return directMatches;
  }

  return collectionsItems;
}

function resolvePreferredActiveCollectionId({
  activeCollectionId,
  activeModuleId,
  scopedCollectionsItems,
  moduleCollectionMap
}) {
  if (!Array.isArray(scopedCollectionsItems) || scopedCollectionsItems.length === 0) {
    return null;
  }

  const availableCollectionIds = new Set(
    scopedCollectionsItems.map((collection) => collection.id)
  );
  if (availableCollectionIds.has(activeCollectionId)) {
    return activeCollectionId;
  }

  for (const collectionId of normalizeModuleCollectionIds(
    moduleCollectionMap?.[activeModuleId] ?? []
  )) {
    if (availableCollectionIds.has(collectionId)) {
      return collectionId;
    }
  }

  if (availableCollectionIds.has(activeModuleId)) {
    return activeModuleId;
  }

  return scopedCollectionsItems[0]?.id ?? null;
}

export {
  buildCollectionUnavailableMessage,
  buildModuleCollectionMap,
  getCollectionEntityLabel,
  resolveActiveModuleIdFromPath,
  resolveModuleScopedCollections,
  resolvePreferredActiveCollectionId,
  singularizeCollectionLabel
};
