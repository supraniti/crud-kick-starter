import { useEffect } from "react";

function resolveRuntimePayload(payload) {
  const runtime = payload?.runtime;
  return runtime && typeof runtime === "object" ? runtime : {};
}

function readRuntimeValue(runtime, key, fallback) {
  return runtime[key] !== undefined ? runtime[key] : fallback;
}

function createLoadedModuleRuntimeState(previous, payload) {
  const runtime = resolveRuntimePayload(payload);
  return {
    ...previous,
    loading: false,
    errorMessage: null,
    diagnostics: readRuntimeValue(runtime, "diagnostics", []),
    referenceStatePersistence: readRuntimeValue(runtime, "referenceStatePersistence", null),
    collectionRepositoryModuleMap: readRuntimeValue(runtime, "collectionRepositoryModuleMap", {}),
    activeCollectionRepositoryModuleMap: readRuntimeValue(
      runtime,
      "activeCollectionRepositoryModuleMap",
      {}
    ),
    collectionRepositoryPolicyMap: readRuntimeValue(runtime, "collectionRepositoryPolicyMap", {}),
    activeCollectionRepositoryPolicyMap: readRuntimeValue(
      runtime,
      "activeCollectionRepositoryPolicyMap",
      {}
    ),
    settingsRepositoryModuleMap: readRuntimeValue(runtime, "settingsRepositoryModuleMap", {}),
    activeSettingsRepositoryModuleMap: readRuntimeValue(
      runtime,
      "activeSettingsRepositoryModuleMap",
      {}
    ),
    settingsRepositoryPolicyMap: readRuntimeValue(runtime, "settingsRepositoryPolicyMap", {}),
    activeSettingsRepositoryPolicyMap: readRuntimeValue(
      runtime,
      "activeSettingsRepositoryPolicyMap",
      {}
    ),
    items: readRuntimeValue(runtime, "items", []),
    runningAction: null
  };
}

function useModuleRuntimeLoader({
  api,
  isAuthenticated,
  moduleRuntimeReloadToken,
  setModuleRuntimeState
}) {
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let cancelled = false;
    setModuleRuntimeState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .readModulesRuntime()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setModuleRuntimeState((previous) => createLoadedModuleRuntimeState(previous, payload));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setModuleRuntimeState((previous) => ({
          ...previous,
          loading: false,
          errorMessage: error?.message ?? "Failed to load module runtime state",
          runningAction: null
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [api, isAuthenticated, moduleRuntimeReloadToken, setModuleRuntimeState]);
}

function useRemotesLoader({
  api,
  isAuthenticated,
  enabled,
  remotesReloadToken,
  setRemotesState
}) {
  useEffect(() => {
    if (!isAuthenticated || !enabled) {
      return;
    }

    let cancelled = false;

    setRemotesState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    api
      .listRemotes()
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setRemotesState({
          loading: false,
          errorMessage: null,
          items: payload?.items ?? []
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setRemotesState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load remotes",
          items: []
        });
      });

    return () => {
      cancelled = true;
    };
  }, [api, isAuthenticated, enabled, remotesReloadToken, setRemotesState]);
}

function useSelectedRemoteSync({
  isAuthenticated,
  enabled,
  remotesItems,
  selectedRemoteId,
  setSelectedRemoteId
}) {
  useEffect(() => {
    if (!isAuthenticated || !enabled) {
      return;
    }

    if (remotesItems.length === 0) {
      setSelectedRemoteId("");
      return;
    }

    const exists = remotesItems.some((item) => item.id === selectedRemoteId);
    if (exists) {
      return;
    }

    const preferred = remotesItems.find((item) => item.enabled) ?? remotesItems[0];
    setSelectedRemoteId(preferred.id);
  }, [isAuthenticated, enabled, remotesItems, selectedRemoteId, setSelectedRemoteId]);
}

function useDeployStateLoader({
  api,
  deployReloadToken,
  isAuthenticated,
  enabled,
  setDeployState
}) {
  useEffect(() => {
    if (!isAuthenticated || !enabled) {
      return;
    }

    let cancelled = false;

    setDeployState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    Promise.all([api.readDeployState(), api.listDeployJobs()])
      .then(([deployPayload, jobsPayload]) => {
        if (cancelled) {
          return;
        }

        const items = jobsPayload?.items ?? [];
        setDeployState((previous) => ({
          ...previous,
          loading: false,
          errorMessage: null,
          deploy: deployPayload?.deploy ?? previous.deploy,
          latestJob: items[0] ?? null
        }));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setDeployState((previous) => ({
          ...previous,
          loading: false,
          errorMessage: error?.message ?? "Failed to load deploy state"
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [api, deployReloadToken, isAuthenticated, enabled, setDeployState]);
}

function useDeployJobPolling({ isAuthenticated, enabled, latestJob, onReload }) {
  useEffect(() => {
    if (!isAuthenticated || !enabled) {
      return;
    }

    const status = latestJob?.status;
    if (status !== "queued" && status !== "running") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onReload();
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isAuthenticated, enabled, latestJob?.id, latestJob?.status, onReload]);
}

export {
  useDeployJobPolling,
  useDeployStateLoader,
  useModuleRuntimeLoader,
  useRemotesLoader,
  useSelectedRemoteSync
};
