import {
  DELETE_POLICY_IGNORE,
  fieldContainsReferenceToItem,
  fieldReferencesCollection,
  hasOwn,
  isRepositoryContract,
  normalizeDeletePolicyToken,
  rowsForCollection,
  createReferenceRouteActionDescriptor
} from "./reference-collection-route-shared-domain-service.js";

async function readModuleSettingsValues(moduleId, resolveSettingsRepository) {
  if (
    typeof moduleId !== "string" ||
    moduleId.length === 0 ||
    typeof resolveSettingsRepository !== "function"
  ) {
    return {};
  }

  const repository = resolveSettingsRepository(moduleId);
  if (!isRepositoryContract(repository)) {
    return {};
  }

  try {
    const state = await repository.readState();
    const settings = state?.[moduleId];
    return settings && typeof settings === "object" && !Array.isArray(settings)
      ? settings
      : {};
  } catch {
    return {};
  }
}

function resolveReferenceFields(definition, targetCollectionId) {
  return (definition?.fields ?? []).filter((field) =>
    fieldReferencesCollection(field, targetCollectionId)
  );
}

async function resolveModuleDeletePolicySettings({
  settingsCache,
  referencingModuleId,
  resolveSettingsRepository
}) {
  const cacheKey = typeof referencingModuleId === "string" ? referencingModuleId : "__unknown__";
  if (!settingsCache.has(cacheKey)) {
    settingsCache.set(
      cacheKey,
      await readModuleSettingsValues(referencingModuleId, resolveSettingsRepository)
    );
  }
  return settingsCache.get(cacheKey) ?? {};
}

async function resolveEffectiveDeletePolicy({
  field,
  referencingModuleId,
  settingsCache,
  resolveSettingsRepository
}) {
  const explicitPolicy = normalizeDeletePolicyToken(field.onDelete);
  if (typeof field.onDeleteSetting !== "string" || field.onDeleteSetting.length === 0) {
    return explicitPolicy;
  }

  const settings = await resolveModuleDeletePolicySettings({
    settingsCache,
    referencingModuleId,
    resolveSettingsRepository
  });
  const configuredPolicy = normalizeDeletePolicyToken(settings[field.onDeleteSetting]);
  return configuredPolicy !== DELETE_POLICY_IGNORE ? configuredPolicy : explicitPolicy;
}

function createReferenceDependency({
  effectivePolicy,
  referencingCollectionId,
  definition,
  referencingModuleId,
  field,
  targetItemId,
  referencingRows
}) {
  return {
    policy: effectivePolicy,
    referencingCollectionId,
    referencingCollectionLabel: definition?.label ?? referencingCollectionId,
    referencingModuleId,
    field,
    referenceCount: referencingRows.length,
    referencingItemIds: referencingRows
      .map((row) => row?.id)
      .filter((value) => typeof value === "string" && value.length > 0),
    action: createReferenceRouteActionDescriptor({
      referencingCollectionId,
      referencingCollectionLabel: definition?.label ?? referencingCollectionId,
      referencingModuleId,
      field,
      targetItemId
    })
  };
}

async function collectFieldDependencies({
  dependencies,
  field,
  rows,
  referencingCollectionId,
  definition,
  referencingModuleId,
  targetItemId,
  settingsCache,
  resolveSettingsRepository
}) {
  const effectivePolicy = await resolveEffectiveDeletePolicy({
    field,
    referencingModuleId,
    settingsCache,
    resolveSettingsRepository
  });
  if (effectivePolicy === DELETE_POLICY_IGNORE) {
    return;
  }

  const referencingRows = rows.filter((row) =>
    fieldContainsReferenceToItem(field, row, targetItemId)
  );
  if (referencingRows.length === 0) {
    return;
  }

  dependencies.push(
    createReferenceDependency({
      effectivePolicy,
      referencingCollectionId,
      definition,
      referencingModuleId,
      field,
      targetItemId,
      referencingRows
    })
  );
}

async function resolveReferenceDeleteDependencies({
  activeCollections,
  targetCollectionId,
  targetItemId,
  resolveCollectionRepository,
  resolveSettingsRepository
}) {
  const dependencies = [];
  const settingsCache = new Map();

  for (const [referencingCollectionId, definition] of Object.entries(
    activeCollections?.definitions ?? {}
  )) {
    const referenceFields = resolveReferenceFields(definition, targetCollectionId);
    if (referenceFields.length === 0) {
      continue;
    }

    if (typeof resolveCollectionRepository !== "function") {
      continue;
    }
    const repository = resolveCollectionRepository(referencingCollectionId);
    if (!isRepositoryContract(repository)) {
      continue;
    }

    const state = await repository.readState();
    const rows = rowsForCollection(state, referencingCollectionId);
    if (rows.length === 0) {
      continue;
    }

    const referencingModuleId =
      activeCollections?.collectionModuleMap?.[referencingCollectionId] ?? null;
    for (const field of referenceFields) {
      await collectFieldDependencies({
        dependencies,
        field,
        rows,
        referencingCollectionId,
        definition,
        referencingModuleId,
        targetItemId,
        settingsCache,
        resolveSettingsRepository
      });
    }
  }

  return dependencies;
}

async function applyNullifyDependencies({
  nullifyDependencies,
  targetItemId,
  resolveCollectionRepository
}) {
  let referenceCount = 0;
  const touchedCollections = new Set();

  for (const dependency of nullifyDependencies) {
    if (typeof resolveCollectionRepository !== "function") {
      continue;
    }
    const repository = resolveCollectionRepository(dependency.referencingCollectionId);
    if (!isRepositoryContract(repository)) {
      continue;
    }

    const changedCount = await repository.transact(async (workingState) => {
      const rows = rowsForCollection(workingState, dependency.referencingCollectionId);
      let changed = 0;

      for (const row of rows) {
        if (!fieldContainsReferenceToItem(dependency.field, row, targetItemId)) {
          continue;
        }

        if (dependency.field.type === "reference-multi") {
          const currentValues = Array.isArray(row[dependency.field.id]) ? row[dependency.field.id] : [];
          const nextValues = currentValues.filter((value) => value !== targetItemId);
          if (nextValues.length === currentValues.length) {
            continue;
          }
          row[dependency.field.id] = nextValues;
        } else {
          if (row[dependency.field.id] !== targetItemId) {
            continue;
          }
          row[dependency.field.id] = null;
        }

        if (hasOwn(row, "updatedAt")) {
          row.updatedAt = new Date().toISOString().slice(0, 10);
        }
        changed += 1;
      }

      return {
        commit: changed > 0,
        value: changed
      };
    });

    if (Number.isInteger(changedCount) && changedCount > 0) {
      referenceCount += changedCount;
      touchedCollections.add(dependency.referencingCollectionId);
    }
  }

  return {
    referenceCount,
    collections: [...touchedCollections]
  };
}

export {
  applyNullifyDependencies,
  resolveReferenceDeleteDependencies
};
