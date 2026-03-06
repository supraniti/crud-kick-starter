import { Stack, Typography } from "@mui/material";
import { CollectionContractPanel } from "./collections/CollectionContractPanel.jsx";
import { CollectionFiltersPanel } from "./collections/CollectionFiltersPanel.jsx";
import { CollectionFormPanel } from "./collections/CollectionFormPanel.jsx";
import { CollectionItemsPanel } from "./collections/CollectionItemsPanel.jsx";
import { ModuleSettingsPanel } from "./ModuleSettingsPanel.jsx";
import { getCollectionEntityLabel } from "../domains/collections/domain-helpers.js";

function CollectionsView({
  workspaceLabel = "Collections",
  collectionsState,
  activeCollectionId,
  isCollectionAvailable,
  unavailableMessage,
  onOpenRemotes,
  onSelectCollection,
  schemaState,
  itemsState,
  referenceOptionsState,
  filterState,
  onChangeFilter,
  onClearFilter,
  formState,
  onChangeForm,
  onSubmitForm,
  onEditItem,
  onDeleteItem,
  onResetForm,
  inlineCreateState,
  onInlineCreateReference,
  onInlineCreateFormChange,
  onCloseInlineCreate,
  onSubmitInlineCreate,
  onRunCollectionErrorAction,
  moduleSettingsState,
  moduleSettingsMeta,
  moduleSettingsPersistencePolicy,
  isModuleSettingsAvailable = false,
  onChangeModuleSettingsField,
  onSaveModuleSettings
}) {
  const activeCollection =
    collectionsState.items.find((collection) => collection.id === activeCollectionId) ?? null;
  const collectionSelectValue = activeCollection ? activeCollectionId : "";
  const controlsDisabled = isCollectionAvailable !== true;
  const noCollectionsAvailable =
    !collectionsState.loading && (collectionsState.items ?? []).length === 0;
  const isUnavailableDuplicate = (message) =>
    controlsDisabled &&
    typeof unavailableMessage === "string" &&
    unavailableMessage.length > 0 &&
    message === unavailableMessage;
  const collectionLabel =
    schemaState.collection?.label ??
    activeCollection?.label ??
    (activeCollectionId || "Collection");
  const itemLabel = getCollectionEntityLabel(activeCollectionId, {
    collection: activeCollection,
    collectionSchema: schemaState.collection
  });

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{workspaceLabel}</Typography>
      <Typography variant="body2" color="text.secondary">
        Collection-aware CRUD workspace for expanded schema/type behavior.
      </Typography>

      <CollectionContractPanel
        collectionsState={collectionsState}
        schemaState={schemaState}
        collectionSelectValue={collectionSelectValue}
        controlsDisabled={controlsDisabled}
        noCollectionsAvailable={noCollectionsAvailable}
        unavailableMessage={unavailableMessage}
        onOpenRemotes={onOpenRemotes}
        onSelectCollection={onSelectCollection}
        referenceOptionsState={referenceOptionsState}
        isUnavailableDuplicate={isUnavailableDuplicate}
      />

      <CollectionFiltersPanel
        schema={schemaState.collection}
        activeCollectionId={activeCollectionId}
        controlsDisabled={controlsDisabled}
        filterState={filterState}
        onChangeFilter={onChangeFilter}
        onClearFilter={onClearFilter}
        referenceOptionsState={referenceOptionsState}
      />

      <CollectionItemsPanel
        schema={schemaState.collection}
        activeCollectionId={activeCollectionId}
        collectionLabel={collectionLabel}
        itemsState={itemsState}
        controlsDisabled={controlsDisabled}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
        isUnavailableDuplicate={isUnavailableDuplicate}
      />

      <CollectionFormPanel
        schema={schemaState.collection}
        activeCollectionId={activeCollectionId}
        controlsDisabled={controlsDisabled}
        formState={formState}
        itemLabel={itemLabel}
        referenceOptionsState={referenceOptionsState}
        onChangeForm={onChangeForm}
        onSubmitForm={onSubmitForm}
        onResetForm={onResetForm}
        onInlineCreateReference={onInlineCreateReference}
        inlineCreateState={inlineCreateState}
        onInlineCreateFormChange={onInlineCreateFormChange}
        onCloseInlineCreate={onCloseInlineCreate}
        onSubmitInlineCreate={onSubmitInlineCreate}
        onRunErrorAction={onRunCollectionErrorAction}
        isUnavailableDuplicate={isUnavailableDuplicate}
      />

      {isModuleSettingsAvailable ? (
        <ModuleSettingsPanel
          moduleId={moduleSettingsState.moduleId}
          moduleSettingsState={moduleSettingsState}
          moduleSettingsMeta={moduleSettingsMeta}
          moduleSettingsPersistencePolicy={moduleSettingsPersistencePolicy}
          onChangeField={onChangeModuleSettingsField}
          onSave={onSaveModuleSettings}
        />
      ) : null}
    </Stack>
  );
}

export { CollectionsView };

