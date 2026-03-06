import {
  buildCollectionListOptions,
  buildCollectionMutationPayload,
  createDefaultCollectionFilterState,
  createDefaultCollectionFormState,
  getCollectionEntityLabel,
  resolveCollectionFilterFieldConfigs,
  resolveReferenceCollectionIds
} from "./domain-helpers.js";

function normalizeRouteFilterStringValue(value) {
  return typeof value === "string" ? value : "";
}

function normalizeRouteFilterArrayValue(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.filter((item) => typeof item === "string" && item.length > 0))];
}

function stringArrayEquals(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function hasOwn(input, key) {
  return Object.prototype.hasOwnProperty.call(input ?? {}, key);
}

function coerceCollectionFilterValueForFormField(filterConfig, rawValue) {
  if (!filterConfig || typeof filterConfig !== "object") {
    return "";
  }

  if (
    filterConfig.multi === true ||
    filterConfig.type === "reference-multi" ||
    filterConfig.type === "enum-multi"
  ) {
    const normalizedArray = normalizeRouteFilterArrayValue(rawValue);
    if (normalizedArray.length > 0) {
      return normalizedArray;
    }
    const normalizedSingle = normalizeRouteFilterStringValue(rawValue);
    return normalizedSingle.length > 0 ? [normalizedSingle] : [];
  }

  return normalizeRouteFilterStringValue(rawValue);
}

function buildCollectionFilterConfigSignature(collectionSchema, collectionId) {
  const filterConfigs = resolveCollectionFilterFieldConfigs(collectionSchema, collectionId);
  return filterConfigs
    .map(
      (filterConfig) =>
        `${filterConfig.fieldId}:${filterConfig.type}:${filterConfig.queryKey}:${
          filterConfig.multi ? "1" : "0"
        }`
    )
    .join("|");
}

const COLLECTION_FORM_META_KEYS = new Set([
  "itemId",
  "saving",
  "errorMessage",
  "successMessage",
  "errorActions"
]);

function stripCollectionFormMeta(formState = {}) {
  const next = {};
  for (const [key, value] of Object.entries(formState ?? {})) {
    if (COLLECTION_FORM_META_KEYS.has(key)) {
      continue;
    }
    next[key] = value;
  }
  return next;
}

function createDefaultInlineCreateState() {
  return {
    open: false,
    saving: false,
    loadingSchema: false,
    errorMessage: null,
    sourceField: null,
    targetCollectionId: "",
    targetCollectionLabel: "",
    collectionSchema: null,
    formState: {}
  };
}

function createReferenceOptionsEntry({
  loading = false,
  errorMessage = null,
  items = []
} = {}) {
  return {
    loading: loading === true,
    errorMessage:
      typeof errorMessage === "string" && errorMessage.length > 0 ? errorMessage : null,
    items: Array.isArray(items) ? items : []
  };
}

function buildReferenceOptionsEntriesFromWorkspace(workspaceReferenceOptions = {}) {
  const entries = {};
  for (const [collectionId, entry] of Object.entries(workspaceReferenceOptions ?? {})) {
    if (typeof collectionId !== "string" || collectionId.length === 0) {
      continue;
    }

    entries[collectionId] = createReferenceOptionsEntry({
      loading: false,
      errorMessage: entry?.errorMessage ?? null,
      items: entry?.items ?? []
    });
  }
  return entries;
}

function buildInlineCreateDraft({
  collectionFormState,
  sourceField,
  targetCollectionId,
  targetCollectionSchema
}) {
  const baseFormState = createDefaultCollectionFormState(targetCollectionId, targetCollectionSchema);
  const draft = stripCollectionFormMeta(baseFormState);
  const defaults = Array.isArray(sourceField?.referenceUi?.inlineCreateDefaults)
    ? sourceField.referenceUi.inlineCreateDefaults
    : [];

  for (const entry of defaults) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const fieldId =
      typeof entry.fieldId === "string" && entry.fieldId.length > 0 ? entry.fieldId : "";
    if (!fieldId) {
      continue;
    }

    if (
      typeof entry.sourceFieldId === "string" &&
      entry.sourceFieldId.length > 0 &&
      hasOwn(collectionFormState, entry.sourceFieldId)
    ) {
      draft[fieldId] = collectionFormState[entry.sourceFieldId];
      continue;
    }

    if (hasOwn(entry, "value")) {
      draft[fieldId] = entry.value;
    }
  }

  return draft;
}

async function hydrateInlineCreateReferenceOptions({
  api,
  targetCollectionId,
  targetCollectionSchema,
  setReferenceOptionsState
}) {
  const referenceCollectionIds = resolveReferenceCollectionIds(
    targetCollectionSchema,
    targetCollectionId
  );
  if (referenceCollectionIds.length === 0) {
    return;
  }

  if (typeof api.readCollectionWorkspace === "function") {
    try {
      const workspaceOptions = buildCollectionListOptions(
        targetCollectionId,
        createDefaultCollectionFilterState(targetCollectionId, targetCollectionSchema),
        targetCollectionSchema
      );
      const workspacePayload = await api.readCollectionWorkspace(workspaceOptions);
      if (workspacePayload?.ok) {
        const workspaceEntries = buildReferenceOptionsEntriesFromWorkspace(
          workspacePayload?.referenceOptions
        );
        if (Object.keys(workspaceEntries).length > 0) {
          setReferenceOptionsState((previous) => ({
            ...previous,
            ...workspaceEntries
          }));
          return;
        }
      }
    } catch {
      // Fall through to per-reference loading.
    }
  }

  const fallbackResults = await Promise.all(
    referenceCollectionIds.map(async (collectionId) => {
      try {
        const payload = await api.listCollectionItems({
          collectionId,
          offset: 0,
          limit: 200,
          search: ""
        });
        if (!payload?.ok) {
          return [
            collectionId,
            createReferenceOptionsEntry({
              loading: false,
              errorMessage: payload?.error?.message ?? `Failed to load '${collectionId}' options`,
              items: []
            })
          ];
        }

        return [
          collectionId,
          createReferenceOptionsEntry({
            loading: false,
            errorMessage: null,
            items: payload?.items ?? []
          })
        ];
      } catch (error) {
        return [
          collectionId,
          createReferenceOptionsEntry({
            loading: false,
            errorMessage: error?.message ?? `Failed to load '${collectionId}' options`,
            items: []
          })
        ];
      }
    })
  );

  if (fallbackResults.length === 0) {
    return;
  }

  setReferenceOptionsState((previous) => {
    const next = { ...previous };
    for (const [collectionId, optionsState] of fallbackResults) {
      if (typeof collectionId !== "string" || collectionId.length === 0) {
        continue;
      }
      next[collectionId] = optionsState;
    }
    return next;
  });
}

function capitalizeLabel(value) {
  if (typeof value !== "string" || value.length === 0) {
    return "Item";
  }
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function buildCollectionSuccessMessage({
  activeCollectionId,
  activeCollection,
  collectionSchema,
  action
}) {
  const entityLabel = getCollectionEntityLabel(activeCollectionId, {
    collection: activeCollection,
    collectionSchema
  });
  return `${capitalizeLabel(entityLabel)} ${action}`;
}

async function submitInlineCreateMutation({
  api,
  inlineCreateState,
  setInlineCreateState,
  setReferenceOptionsState,
  setCollectionFormState,
  setCollectionItemsReloadToken
}) {
  if (!inlineCreateState.open || inlineCreateState.loadingSchema || inlineCreateState.saving) {
    return;
  }

  const targetCollectionId = inlineCreateState.targetCollectionId;
  const targetCollectionSchema = inlineCreateState.collectionSchema;
  const sourceField = inlineCreateState.sourceField;
  if (
    typeof targetCollectionId !== "string" ||
    targetCollectionId.length === 0 ||
    !targetCollectionSchema ||
    typeof sourceField?.id !== "string"
  ) {
    return;
  }

  setInlineCreateState((previous) => ({
    ...previous,
    saving: true,
    errorMessage: null
  }));

  try {
    const payload = buildCollectionMutationPayload(
      targetCollectionId,
      inlineCreateState.formState,
      targetCollectionSchema
    );
    const createPayload = await api.createCollectionItem({
      collectionId: targetCollectionId,
      item: payload
    });
    if (!createPayload?.ok || !createPayload?.item?.id) {
      setInlineCreateState((previous) => ({
        ...previous,
        saving: false,
        errorMessage: createPayload?.error?.message ?? "Failed to create referenced item"
      }));
      return;
    }

    const createdId = createPayload.item.id;

    const optionsPayload = await api.listCollectionItems({
      collectionId: targetCollectionId,
      offset: 0,
      limit: 200,
      search: ""
    });
    if (optionsPayload?.ok) {
      setReferenceOptionsState((previous) => ({
        ...previous,
        [targetCollectionId]: {
          loading: false,
          errorMessage: null,
          items: optionsPayload.items ?? []
        }
      }));
    }

    setCollectionFormState((previous) => {
      const next = {
        ...previous,
        errorMessage: null,
        successMessage: "Referenced item created",
        errorActions: []
      };

      if (sourceField.type === "reference-multi") {
        const existing = Array.isArray(previous[sourceField.id]) ? previous[sourceField.id] : [];
        next[sourceField.id] = existing.includes(createdId) ? existing : [...existing, createdId];
      } else {
        next[sourceField.id] = createdId;
      }

      return next;
    });

    setCollectionItemsReloadToken((value) => value + 1);
    setInlineCreateState(createDefaultInlineCreateState());
  } catch (error) {
    setInlineCreateState((previous) => ({
      ...previous,
      saving: false,
      errorMessage: error?.message ?? "Failed to create referenced item"
    }));
  }
}

async function submitCollectionFormMutation({
  activeCollection,
  activeCollectionId,
  activeCollectionUnavailableMessage,
  api,
  collectionFormState,
  collectionSchema,
  isActiveCollectionAvailable,
  onCollectionMutation,
  setCollectionFormState,
  setCollectionItemsReloadToken
}) {
  if (!isActiveCollectionAvailable) {
    setCollectionFormState((previous) => ({
      ...previous,
      saving: false,
      errorMessage: activeCollectionUnavailableMessage,
      successMessage: null,
      errorActions: []
    }));
    return;
  }

  setCollectionFormState((previous) => ({
    ...previous,
    saving: true,
    errorMessage: null,
    successMessage: null,
    errorActions: []
  }));

  try {
    const itemPayload = buildCollectionMutationPayload(
      activeCollectionId,
      collectionFormState,
      collectionSchema
    );
    const payload = collectionFormState.itemId
      ? await api.updateCollectionItem({
          collectionId: activeCollectionId,
          itemId: collectionFormState.itemId,
          item: itemPayload
        })
      : await api.createCollectionItem({
          collectionId: activeCollectionId,
          item: itemPayload
        });

    if (!payload?.ok) {
      setCollectionFormState((previous) => ({
        ...previous,
        saving: false,
        errorMessage: payload?.error?.message ?? "Failed to save item",
        errorActions: Array.isArray(payload?.error?.actions) ? payload.error.actions : []
      }));
      return;
    }

    setCollectionFormState({
      ...createDefaultCollectionFormState(activeCollectionId, collectionSchema),
      errorActions: [],
      successMessage: buildCollectionSuccessMessage({
        activeCollectionId,
        activeCollection,
        collectionSchema,
        action: collectionFormState.itemId ? "updated" : "created"
      })
    });
    setCollectionItemsReloadToken((value) => value + 1);
    if (typeof onCollectionMutation === "function") {
      onCollectionMutation();
    }
  } catch (error) {
    setCollectionFormState((previous) => ({
      ...previous,
      saving: false,
      errorMessage: error?.message ?? "Failed to save item",
      errorActions: []
    }));
  }
}

async function deleteCollectionItemMutation({
  activeCollection,
  activeCollectionId,
  activeCollectionUnavailableMessage,
  api,
  collectionSchema,
  isActiveCollectionAvailable,
  itemId,
  onCollectionMutation,
  setCollectionFormState,
  setCollectionItemsReloadToken
}) {
  if (!isActiveCollectionAvailable) {
    setCollectionFormState((previous) => ({
      ...previous,
      errorMessage: activeCollectionUnavailableMessage,
      successMessage: null,
      errorActions: []
    }));
    return;
  }

  setCollectionFormState((previous) => ({
    ...previous,
    errorMessage: null,
    successMessage: null,
    errorActions: []
  }));

  try {
    const payload = await api.deleteCollectionItem({
      collectionId: activeCollectionId,
      itemId
    });

    if (!payload?.ok) {
      setCollectionFormState((previous) => ({
        ...previous,
        errorMessage: payload?.error?.message ?? "Failed to delete item",
        errorActions: Array.isArray(payload?.error?.actions) ? payload.error.actions : []
      }));
      return;
    }

    setCollectionFormState((previous) => ({
      ...previous,
      successMessage: buildCollectionSuccessMessage({
        activeCollectionId,
        activeCollection,
        collectionSchema,
        action: "deleted"
      }),
      errorActions: []
    }));
    setCollectionItemsReloadToken((value) => value + 1);
    if (typeof onCollectionMutation === "function") {
      onCollectionMutation();
    }
  } catch (error) {
    setCollectionFormState((previous) => ({
      ...previous,
      errorMessage: error?.message ?? "Failed to delete item",
      errorActions: []
    }));
  }
}

export {
  buildCollectionFilterConfigSignature,
  buildInlineCreateDraft,
  buildReferenceOptionsEntriesFromWorkspace,
  coerceCollectionFilterValueForFormField,
  createDefaultInlineCreateState,
  createReferenceOptionsEntry,
  deleteCollectionItemMutation,
  hasOwn,
  hydrateInlineCreateReferenceOptions,
  normalizeRouteFilterArrayValue,
  normalizeRouteFilterStringValue,
  stringArrayEquals,
  stripCollectionFormMeta,
  submitCollectionFormMutation,
  submitInlineCreateMutation
};
