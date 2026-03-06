import { useCallback, useMemo, useState } from "react";
import {
  createDefaultDeployState,
  createDefaultModuleRuntimeState,
  createDefaultRemoteFormState,
  createDefaultRemotesState
} from "./domain-helpers.js";
import {
  useDeployJobPolling,
  useDeployStateLoader,
  useModuleRuntimeLoader,
  useRemotesLoader,
  useSelectedRemoteSync
} from "./useRemotesDeployLoaders.js";
import { useRemotesDeployActions } from "./useRemotesDeployActions.js";

function useRemotesDeployDomain({
  api,
  isAuthenticated,
  activeModuleId,
  enabled = null,
  resolveRemotesDeployEnabled = null
}) {
  const [moduleRuntimeState, setModuleRuntimeState] = useState(() =>
    createDefaultModuleRuntimeState()
  );
  const [remotesState, setRemotesState] = useState(() => createDefaultRemotesState());
  const [remotesReloadToken, setRemotesReloadToken] = useState(0);
  const [moduleRuntimeReloadToken, setModuleRuntimeReloadToken] = useState(0);
  const [deployReloadToken, setDeployReloadToken] = useState(0);
  const [selectedRemoteId, setSelectedRemoteId] = useState("");
  const [remoteFormState, setRemoteFormState] = useState(() => createDefaultRemoteFormState());
  const [deployState, setDeployState] = useState(() => createDefaultDeployState());

  const remotesDeployEnabled = useMemo(() => {
    if (typeof enabled === "boolean") {
      return enabled;
    }

    if (typeof resolveRemotesDeployEnabled !== "function") {
      return false;
    }

    return (
      resolveRemotesDeployEnabled({
        activeModuleId,
        moduleRuntimeItems: moduleRuntimeState.items
      }) === true
    );
  }, [activeModuleId, enabled, moduleRuntimeState.items, resolveRemotesDeployEnabled]);

  const bumpDeployReloadToken = useCallback(() => {
    setDeployReloadToken((value) => value + 1);
  }, []);

  useModuleRuntimeLoader({
    api,
    isAuthenticated,
    moduleRuntimeReloadToken,
    setModuleRuntimeState
  });

  useRemotesLoader({
    api,
    isAuthenticated,
    enabled: remotesDeployEnabled,
    remotesReloadToken,
    setRemotesState
  });

  useSelectedRemoteSync({
    isAuthenticated,
    enabled: remotesDeployEnabled,
    remotesItems: remotesState.items,
    selectedRemoteId,
    setSelectedRemoteId
  });

  useDeployStateLoader({
    api,
    deployReloadToken,
    isAuthenticated,
    enabled: remotesDeployEnabled,
    setDeployState
  });

  useDeployJobPolling({
    isAuthenticated,
    enabled: remotesDeployEnabled,
    latestJob: deployState.latestJob,
    onReload: bumpDeployReloadToken
  });

  const actions = useRemotesDeployActions({
    api,
    remotesDeployEnabled,
    remotesState,
    selectedRemoteId,
    remoteFormState,
    setRemoteFormState,
    setRemotesReloadToken,
    setDeployState,
    setDeployReloadToken,
    setModuleRuntimeState,
    setModuleRuntimeReloadToken
  });

  return {
    remotesState,
    moduleRuntimeState,
    moduleRuntimeReloadToken,
    selectedRemoteId,
    setSelectedRemoteId,
    remoteFormState,
    deployState,
    bumpDeployReloadToken,
    ...actions
  };
}

export { useRemotesDeployDomain };
