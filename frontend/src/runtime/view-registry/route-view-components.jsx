import { Alert, Paper, Stack, Typography } from "@mui/material";
import { CollectionsView } from "../../ui/CollectionsView.jsx";
import { MissionOperatorView } from "../../ui/MissionOperatorView.jsx";
import { ProductsView, TagEditorDialog } from "../../ui/ProductsView.jsx";
import { RemotesView } from "../../ui/RemotesView.jsx";
import { TaxonomiesView } from "../../ui/TaxonomiesView.jsx";
import {
  COLLECTIONS_ROUTE_STATE_ADAPTER,
  VIEW_REGISTRATION_CODES
} from "./registration-primitives.js";

function ProductsRouteView(context) {
  const {
    productsTaxonomiesDomain,
    selectedCategoryIds,
    onToggleCategory,
    onRemoveCategory,
    onOpenTaxonomies
  } = context;

  return (
    <>
      <ProductsView
        categories={productsTaxonomiesDomain.categoriesState.items}
        tags={productsTaxonomiesDomain.tagsState.items}
        productsState={productsTaxonomiesDomain.productsState}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={onToggleCategory}
        onRemoveCategory={onRemoveCategory}
        onOpenTagEditor={productsTaxonomiesDomain.handleOpenTagEditor}
        onOpenTaxonomies={onOpenTaxonomies}
        safeguardInput={productsTaxonomiesDomain.safeguardInput}
        onSafeguardInputChange={productsTaxonomiesDomain.setSafeguardInput}
        onPreviewSafeguard={productsTaxonomiesDomain.handlePreviewSafeguard}
        safeguardState={productsTaxonomiesDomain.safeguardState}
      />
      <TagEditorDialog
        open={productsTaxonomiesDomain.relationEditor.open}
        product={productsTaxonomiesDomain.productsState.items.find(
          (item) => item.id === productsTaxonomiesDomain.relationEditor.productId
        )}
        tags={productsTaxonomiesDomain.tagsState.items}
        selectedTagIds={productsTaxonomiesDomain.relationEditor.selectedTagIds}
        newTagLabel={productsTaxonomiesDomain.relationEditor.newTagLabel}
        onToggleTag={productsTaxonomiesDomain.handleToggleEditorTag}
        onChangeNewTag={productsTaxonomiesDomain.handleChangeNewTag}
        onClose={productsTaxonomiesDomain.handleCloseTagEditor}
        onSave={productsTaxonomiesDomain.handleSaveProductTags}
        onConfirmSafeguard={productsTaxonomiesDomain.handleConfirmProductTags}
        saving={productsTaxonomiesDomain.relationEditor.saving}
        errorMessage={productsTaxonomiesDomain.relationEditor.errorMessage}
        safeguard={productsTaxonomiesDomain.relationEditor.safeguard}
      />
    </>
  );
}

function CollectionsRouteView(context) {
  const { collectionsDomain, moduleSettingsDomain, onOpenRemotes, activeModuleLabel } = context;
  return (
    <CollectionsView
      workspaceLabel={activeModuleLabel}
      collectionsState={collectionsDomain.collectionsState}
      activeCollectionId={collectionsDomain.activeCollectionId}
      isCollectionAvailable={collectionsDomain.isActiveCollectionAvailable}
      unavailableMessage={
        collectionsDomain.isActiveCollectionAvailable
          ? null
          : collectionsDomain.activeCollectionUnavailableMessage
      }
      onOpenRemotes={onOpenRemotes}
      onSelectCollection={collectionsDomain.handleSelectCollection}
      schemaState={collectionsDomain.collectionSchemaState}
      itemsState={collectionsDomain.collectionItemsState}
      referenceOptionsState={collectionsDomain.referenceOptionsState}
      filterState={collectionsDomain.collectionFilterState}
      onChangeFilter={collectionsDomain.handleCollectionFilterChange}
      onClearFilter={collectionsDomain.handleClearCollectionFilters}
      formState={collectionsDomain.collectionFormState}
      onChangeForm={collectionsDomain.handleCollectionFormChange}
      onSubmitForm={collectionsDomain.handleSubmitCollectionForm}
      onEditItem={collectionsDomain.handleEditCollectionItem}
      onDeleteItem={collectionsDomain.handleDeleteCollectionItem}
      onResetForm={collectionsDomain.handleResetCollectionForm}
      inlineCreateState={collectionsDomain.inlineCreateState}
      onInlineCreateReference={collectionsDomain.handleInlineCreateReference}
      onInlineCreateFormChange={collectionsDomain.handleInlineCreateFormChange}
      onCloseInlineCreate={collectionsDomain.handleCloseInlineCreate}
      onSubmitInlineCreate={collectionsDomain.handleSubmitInlineCreate}
      onRunCollectionErrorAction={collectionsDomain.handleRunCollectionErrorAction}
      moduleSettingsState={moduleSettingsDomain.moduleSettingsState}
      moduleSettingsMeta={moduleSettingsDomain.activeModuleSettingsMeta}
      moduleSettingsPersistencePolicy={
        moduleSettingsDomain.activeModuleSettingsPersistencePolicy
      }
      isModuleSettingsAvailable={moduleSettingsDomain.isActiveModuleSettingsAvailable}
      onChangeModuleSettingsField={moduleSettingsDomain.handleSettingsFieldChange}
      onSaveModuleSettings={moduleSettingsDomain.handleSaveModuleSettings}
    />
  );
}

function MissionsRouteView(context) {
  const { missionOperatorDomain, onOpenRemotes } = context;
  return (
    <MissionOperatorView
      missionsState={missionOperatorDomain.missionsState}
      runFormState={missionOperatorDomain.runFormState}
      selectedMission={missionOperatorDomain.selectedMission}
      selectedMissionPayloadFields={missionOperatorDomain.selectedMissionPayloadFields}
      jobsState={missionOperatorDomain.jobsState}
      selectedJobId={missionOperatorDomain.selectedJobId}
      jobDetailState={missionOperatorDomain.jobDetailState}
      onSelectMission={missionOperatorDomain.handleSelectMission}
      onPayloadFieldChange={missionOperatorDomain.handlePayloadFieldChange}
      onRunMission={missionOperatorDomain.handleRunMission}
      onSelectJob={missionOperatorDomain.handleSelectJob}
      onCancelJob={missionOperatorDomain.handleCancelJob}
      onRefresh={missionOperatorDomain.handleRefresh}
      onOpenRemotes={onOpenRemotes}
    />
  );
}

function TaxonomiesRouteView(context) {
  const { productsTaxonomiesDomain } = context;
  return (
    <TaxonomiesView
      tagsState={productsTaxonomiesDomain.tagsState}
      selectedTagIds={productsTaxonomiesDomain.taxonomyDeleteState.selectedTagIds}
      onToggleTag={productsTaxonomiesDomain.handleToggleDeleteTagSelection}
      onAnalyzeImpact={productsTaxonomiesDomain.handleAnalyzeDeleteImpact}
      onApproveDelete={productsTaxonomiesDomain.handleApproveDeleteTags}
      onClearState={productsTaxonomiesDomain.handleClearTaxonomyState}
      impactState={productsTaxonomiesDomain.taxonomyDeleteState}
    />
  );
}

function RemotesRouteView(context) {
  const { remotesDeployDomain, moduleSettingsDomain } = context;
  return (
    <RemotesView
      remotesState={remotesDeployDomain.remotesState}
      formState={remotesDeployDomain.remoteFormState}
      onChangeForm={remotesDeployDomain.handleRemoteFormChange}
      onSubmitForm={remotesDeployDomain.handleSubmitRemoteForm}
      onEditRemote={remotesDeployDomain.handleEditRemote}
      onDeleteRemote={remotesDeployDomain.handleDeleteRemote}
      onResetForm={remotesDeployDomain.handleResetRemoteForm}
      settingsModulesState={moduleSettingsDomain.settingsModulesState}
      moduleSettingsState={moduleSettingsDomain.moduleSettingsState}
      moduleSettingsMeta={moduleSettingsDomain.activeModuleSettingsMeta}
      moduleSettingsPersistencePolicy={
        moduleSettingsDomain.activeModuleSettingsPersistencePolicy
      }
      isModuleSettingsAvailable={moduleSettingsDomain.isActiveModuleSettingsAvailable}
      onChangeModuleSettingsField={moduleSettingsDomain.handleSettingsFieldChange}
      onSaveModuleSettings={moduleSettingsDomain.handleSaveModuleSettings}
    />
  );
}

function createCollectionsRouteViewDescriptor({
  moduleId,
  bannerMessage = "",
  requiredDomains = null,
  quickActions = [],
  actions = [],
  runAction = null
}) {
  const normalizedRequiredDomains = Array.isArray(requiredDomains)
    ? [...new Set(requiredDomains)]
    : ["collections", "module-settings"];
  return {
    moduleId,
    usesCollectionsDomain: true,
    requiredDomains: normalizedRequiredDomains,
    quickActions,
    actions,
    ...(typeof runAction === "function" ? { runAction } : {}),
    routeStateAdapter: COLLECTIONS_ROUTE_STATE_ADAPTER,
    render: (context) => {
      const collectionsView = CollectionsRouteView(context);
      if (typeof bannerMessage !== "string" || bannerMessage.length === 0) {
        return collectionsView;
      }

      return (
        <Stack spacing={2}>
          <Alert severity="info">{bannerMessage}</Alert>
          {collectionsView}
        </Stack>
      );
    }
  };
}

function renderRegistryFallback({ route, diagnostics = [] }) {
  const firstDiagnostic =
    diagnostics.find((entry) => entry?.moduleId === route.moduleId) ?? diagnostics[0] ?? null;
  const code = firstDiagnostic?.code ?? VIEW_REGISTRATION_CODES.MISSING_MODULE;
  const message =
    firstDiagnostic?.message ??
    `No registered view is available for module '${route.moduleId}'.`;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1}>
        <Typography variant="h5">Module view unavailable</Typography>
        <Alert severity="error">
          [{code}] {message}
        </Alert>
      </Stack>
    </Paper>
  );
}

export {
  CollectionsRouteView,
  MissionsRouteView,
  ProductsRouteView,
  RemotesRouteView,
  TaxonomiesRouteView,
  createCollectionsRouteViewDescriptor,
  renderRegistryFallback
};
