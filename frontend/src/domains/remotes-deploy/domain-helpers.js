function createDefaultModuleRuntimeState() {
  return {
    loading: false,
    errorMessage: null,
    successMessage: null,
    diagnostics: [],
    referenceStatePersistence: null,
    collectionRepositoryModuleMap: {},
    activeCollectionRepositoryModuleMap: {},
    collectionRepositoryPolicyMap: {},
    activeCollectionRepositoryPolicyMap: {},
    settingsRepositoryModuleMap: {},
    activeSettingsRepositoryModuleMap: {},
    settingsRepositoryPolicyMap: {},
    activeSettingsRepositoryPolicyMap: {},
    items: [],
    runningAction: null
  };
}

function createDefaultRemotesState() {
  return {
    loading: false,
    errorMessage: null,
    items: []
  };
}

function createDefaultRemoteFormState() {
  return {
    remoteId: null,
    label: "",
    kind: "filesystem",
    endpoint: "",
    enabled: true,
    saving: false,
    errorMessage: null,
    successMessage: null
  };
}

function createDefaultDeployState() {
  return {
    loading: false,
    starting: false,
    errorMessage: null,
    deploy: {
      currentRevision: 0,
      deployedRevision: 0,
      deployRequired: false,
      lastMutationAt: null,
      lastDeployAt: null,
      lastDeployJobId: null
    },
    latestJob: null
  };
}

export {
  createDefaultDeployState,
  createDefaultModuleRuntimeState,
  createDefaultRemoteFormState,
  createDefaultRemotesState
};
