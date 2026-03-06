import { useEffect } from "react";
import {
  DEFAULT_COLLECTION_ID,
  createDefaultCollectionFilterState,
  createDefaultCollectionFormState,
  resolveCollectionFilterFieldConfigs
} from "../../domain-helpers.js";
import {
  coerceCollectionFilterValueForFormField,
  createDefaultInlineCreateState,
  normalizeRouteFilterArrayValue,
  normalizeRouteFilterStringValue,
  stringArrayEquals
} from "../../domain-runtime-helpers.js";
import {
  createDefaultCollectionItemsState,
  createDefaultCollectionReferenceOptionsState,
  createDefaultCollectionSchemaState,
  createDefaultCollectionsState
} from "../../state-helpers.js";

function useDisabledCollectionsResetEffect({
  enabled,
  setCollectionsState,
  setCollectionSchemaState,
  setCollectionItemsState,
  setReferenceOptionsState,
  setModuleCollectionMap,
  setActiveCollectionId,
  setCollectionFilterState,
  setCollectionFormState,
  setInlineCreateState
}) {
  useEffect(() => {
    if (enabled) {
      return;
    }

    setCollectionsState(createDefaultCollectionsState());
    setCollectionSchemaState(createDefaultCollectionSchemaState());
    setCollectionItemsState(createDefaultCollectionItemsState());
    setReferenceOptionsState(createDefaultCollectionReferenceOptionsState());
    setModuleCollectionMap({});
    setActiveCollectionId(DEFAULT_COLLECTION_ID);
    setCollectionFilterState(createDefaultCollectionFilterState(DEFAULT_COLLECTION_ID));
    setCollectionFormState(createDefaultCollectionFormState(DEFAULT_COLLECTION_ID));
    setInlineCreateState(createDefaultInlineCreateState());
  }, [
    enabled,
    setCollectionsState,
    setCollectionSchemaState,
    setCollectionItemsState,
    setReferenceOptionsState,
    setModuleCollectionMap,
    setActiveCollectionId,
    setCollectionFilterState,
    setCollectionFormState,
    setInlineCreateState
  ]);
}

function useCollectionSchemaDefaultsEffect({
  activeCollectionId,
  collectionSchemaState,
  setCollectionFilterState,
  setCollectionFormState
}) {
  useEffect(() => {
    const schema = collectionSchemaState.collection;
    if (!schema || schema.id !== activeCollectionId) {
      return;
    }

    setCollectionFilterState((previous) => ({
      ...createDefaultCollectionFilterState(activeCollectionId, schema),
      ...previous
    }));

    setCollectionFormState((previous) => {
      if (previous.itemId) {
        return previous;
      }

      const hasEditableFieldState = Object.keys(previous).some(
        (key) =>
          !["itemId", "saving", "errorMessage", "successMessage", "errorActions"].includes(key)
      );
      const schemaDefaults = createDefaultCollectionFormState(activeCollectionId, schema);
      const hasMissingSchemaDefaults = Object.keys(schemaDefaults).some(
        (key) =>
          !["itemId", "saving", "errorMessage", "successMessage", "errorActions"].includes(key) &&
          !Object.prototype.hasOwnProperty.call(previous, key)
      );
      if (hasMissingSchemaDefaults) {
        return {
          ...schemaDefaults,
          ...previous
        };
      }

      return hasEditableFieldState ? previous : schemaDefaults;
    });
  }, [activeCollectionId, collectionSchemaState.collection, setCollectionFilterState, setCollectionFormState]);
}

function useInlineCreateResetOnCollectionChange({ activeCollectionId, setInlineCreateState }) {
  useEffect(() => {
    setInlineCreateState((previous) =>
      previous.open ? createDefaultInlineCreateState() : previous
    );
  }, [activeCollectionId, setInlineCreateState]);
}

function useRouteStateToFilterSyncEffect({
  isAuthenticated,
  isCollectionsRouteActive,
  isActiveCollectionAvailable,
  collectionSchemaState,
  activeCollectionId,
  routeState,
  setCollectionFilterState
}) {
  useEffect(() => {
    if (!isAuthenticated || !isCollectionsRouteActive || !isActiveCollectionAvailable) {
      return;
    }

    const schema = collectionSchemaState.collection;
    if (!schema || schema.id !== activeCollectionId) {
      return;
    }

    if (!routeState || typeof routeState !== "object" || Array.isArray(routeState)) {
      return;
    }

    const filterConfigs = resolveCollectionFilterFieldConfigs(schema, activeCollectionId);
    if (filterConfigs.length === 0) {
      return;
    }

    setCollectionFilterState((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const filterConfig of filterConfigs) {
        if (!Object.prototype.hasOwnProperty.call(routeState, filterConfig.queryKey)) {
          continue;
        }

        const routeValue = routeState[filterConfig.queryKey];
        if (filterConfig.multi) {
          const normalized = normalizeRouteFilterArrayValue(routeValue);
          const previousValue = normalizeRouteFilterArrayValue(previous[filterConfig.fieldId]);
          if (!stringArrayEquals(previousValue, normalized)) {
            next[filterConfig.fieldId] = normalized;
            changed = true;
          }
          continue;
        }

        const normalized = normalizeRouteFilterStringValue(routeValue);
        const previousValue = normalizeRouteFilterStringValue(previous[filterConfig.fieldId]);
        if (previousValue !== normalized) {
          next[filterConfig.fieldId] = normalized;
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [
    activeCollectionId,
    collectionSchemaState.collection,
    isActiveCollectionAvailable,
    isAuthenticated,
    isCollectionsRouteActive,
    routeState,
    setCollectionFilterState
  ]);
}

function useFilterStateToFormSyncEffect({
  isAuthenticated,
  isCollectionsRouteActive,
  isActiveCollectionAvailable,
  collectionSchemaState,
  activeCollectionId,
  collectionFilterState,
  collectionFilterKey,
  setCollectionFormState
}) {
  useEffect(() => {
    if (!isAuthenticated || !isCollectionsRouteActive || !isActiveCollectionAvailable) {
      return;
    }

    const schema = collectionSchemaState.collection;
    if (!schema || schema.id !== activeCollectionId) {
      return;
    }

    const filterConfigs = resolveCollectionFilterFieldConfigs(schema, activeCollectionId);
    if (filterConfigs.length === 0) {
      return;
    }

    setCollectionFormState((previous) => {
      if (previous.itemId) {
        return previous;
      }

      let changed = false;
      const next = { ...previous };

      for (const filterConfig of filterConfigs) {
        const candidateValue = coerceCollectionFilterValueForFormField(
          filterConfig,
          collectionFilterState[filterConfig.fieldId]
        );

        if (Array.isArray(candidateValue)) {
          if (candidateValue.length === 0) {
            continue;
          }
          const existingValue = normalizeRouteFilterArrayValue(previous[filterConfig.fieldId]);
          if (existingValue.length > 0) {
            continue;
          }
          next[filterConfig.fieldId] = candidateValue;
          changed = true;
          continue;
        }

        if (candidateValue.length === 0) {
          continue;
        }

        const existingValue = normalizeRouteFilterStringValue(previous[filterConfig.fieldId]);
        if (existingValue.length > 0) {
          continue;
        }

        next[filterConfig.fieldId] = candidateValue;
        changed = true;
      }

      return changed ? next : previous;
    });
  }, [
    activeCollectionId,
    collectionFilterKey,
    collectionFilterState,
    collectionSchemaState.collection,
    isActiveCollectionAvailable,
    isAuthenticated,
    isCollectionsRouteActive,
    setCollectionFormState
  ]);
}

function useCollectionsDomainFilterAndFormEffects({
  enabled,
  isAuthenticated,
  isCollectionsRouteActive,
  isActiveCollectionAvailable,
  activeCollectionId,
  collectionSchemaState,
  collectionFilterState,
  collectionFilterKey,
  routeState,
  setCollectionsState,
  setCollectionSchemaState,
  setCollectionItemsState,
  setReferenceOptionsState,
  setModuleCollectionMap,
  setActiveCollectionId,
  setCollectionFilterState,
  setCollectionFormState,
  setInlineCreateState
}) {
  useDisabledCollectionsResetEffect({
    enabled,
    setCollectionsState,
    setCollectionSchemaState,
    setCollectionItemsState,
    setReferenceOptionsState,
    setModuleCollectionMap,
    setActiveCollectionId,
    setCollectionFilterState,
    setCollectionFormState,
    setInlineCreateState
  });

  useCollectionSchemaDefaultsEffect({
    activeCollectionId,
    collectionSchemaState,
    setCollectionFilterState,
    setCollectionFormState
  });

  useInlineCreateResetOnCollectionChange({
    activeCollectionId,
    setInlineCreateState
  });

  useRouteStateToFilterSyncEffect({
    isAuthenticated,
    isCollectionsRouteActive,
    isActiveCollectionAvailable,
    collectionSchemaState,
    activeCollectionId,
    routeState,
    setCollectionFilterState
  });

  useFilterStateToFormSyncEffect({
    isAuthenticated,
    isCollectionsRouteActive,
    isActiveCollectionAvailable,
    collectionSchemaState,
    activeCollectionId,
    collectionFilterState,
    collectionFilterKey,
    setCollectionFormState
  });
}

export { useCollectionsDomainFilterAndFormEffects };
