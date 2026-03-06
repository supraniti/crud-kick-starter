import {
  disableReferenceModule,
  enableReferenceModule,
  analyzeReferenceTagDelete,
  cancelReferenceMissionJob,
  createReferenceCollectionItem,
  createReferenceRemote,
  deleteReferenceCollectionItem,
  deleteReferenceRemote,
  deleteReferenceTags,
  fetchReferenceModulesRuntime,
  fetchReferenceSettingsModules,
  fetchReferenceCollectionItems,
  fetchReferenceCollectionWorkspace,
  fetchReferenceCollectionSchema,
  fetchReferenceCollections,
  fetchReferenceCategories,
  fetchReferenceDeployState,
  fetchReferenceMissions,
  fetchReferenceModules,
  fetchReferenceProducts,
  fetchReferenceRemotes,
  fetchReferenceTags,
  installReferenceModule,
  listReferenceMissionJobs,
  listReferenceDeployJobs,
  previewReferenceSafeguard,
  readReferenceMissionJob,
  readReferenceModuleSettings,
  startReferenceMissionJob,
  startReferenceDeployJob,
  uninstallReferenceModule,
  updateReferenceModuleSettings,
  updateReferenceCollectionItem,
  updateReferenceRemote,
  updateReferenceProductTags
} from "../../api/reference.js";
import { pingSystem } from "../../api/system.js";

const AUTH_STORAGE_KEY = "crud-control.auth.v1";

const defaultApiClients = {
  ping: pingSystem,
  listModules: fetchReferenceModules,
  readModulesRuntime: fetchReferenceModulesRuntime,
  listSettingsModules: fetchReferenceSettingsModules,
  readModuleSettings: readReferenceModuleSettings,
  updateModuleSettings: updateReferenceModuleSettings,
  installModule: installReferenceModule,
  uninstallModule: uninstallReferenceModule,
  enableModule: enableReferenceModule,
  disableModule: disableReferenceModule,
  listCollections: fetchReferenceCollections,
  readCollectionSchema: fetchReferenceCollectionSchema,
  readCollectionWorkspace: fetchReferenceCollectionWorkspace,
  listCollectionItems: fetchReferenceCollectionItems,
  createCollectionItem: createReferenceCollectionItem,
  updateCollectionItem: updateReferenceCollectionItem,
  deleteCollectionItem: deleteReferenceCollectionItem,
  listCategories: fetchReferenceCategories,
  listProducts: fetchReferenceProducts,
  listTags: fetchReferenceTags,
  listRemotes: fetchReferenceRemotes,
  createRemote: createReferenceRemote,
  updateRemote: updateReferenceRemote,
  deleteRemote: deleteReferenceRemote,
  readDeployState: fetchReferenceDeployState,
  listDeployJobs: listReferenceDeployJobs,
  startDeployJob: startReferenceDeployJob,
  listMissions: fetchReferenceMissions,
  startMissionJob: startReferenceMissionJob,
  listMissionJobs: listReferenceMissionJobs,
  readMissionJob: readReferenceMissionJob,
  cancelMissionJob: cancelReferenceMissionJob,
  updateProductTags: updateReferenceProductTags,
  analyzeTagDelete: analyzeReferenceTagDelete,
  deleteTags: deleteReferenceTags,
  previewSafeguard: previewReferenceSafeguard
};

function readAuthSession() {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeAuthSession(isAuthenticated) {
  try {
    if (isAuthenticated) {
      window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
      return;
    }

    window.localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Local storage is unavailable in this runtime.
  }
}

export { AUTH_STORAGE_KEY, defaultApiClients, readAuthSession, writeAuthSession };
