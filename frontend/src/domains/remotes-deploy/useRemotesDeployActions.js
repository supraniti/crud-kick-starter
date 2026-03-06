import { useCallback } from "react";
import { createDefaultRemoteFormState } from "./domain-helpers.js";

function createEditedRemoteFormState(remote) {
  return {
    remoteId: remote.id,
    label: remote.label,
    kind: remote.kind,
    endpoint: remote.endpoint,
    enabled: remote.enabled === true,
    saving: false,
    errorMessage: null,
    successMessage: null
  };
}

function useRemoteManagementActions({
  api,
  remoteFormState,
  setRemoteFormState,
  setRemotesReloadToken,
  setDeployReloadToken
}) {
  const handleRemoteFormChange = useCallback(
    (field, value) => {
      setRemoteFormState((previous) => ({
        ...previous,
        [field]: value,
        errorMessage: null,
        successMessage: null
      }));
    },
    [setRemoteFormState]
  );
  const handleEditRemote = useCallback(
    (remote) => {
      setRemoteFormState(createEditedRemoteFormState(remote));
    },
    [setRemoteFormState]
  );

  const handleResetRemoteForm = useCallback(() => {
    setRemoteFormState(createDefaultRemoteFormState());
  }, [setRemoteFormState]);

  const handleSubmitRemoteForm = useCallback(async () => {
    setRemoteFormState((previous) => ({
      ...previous,
      saving: true,
      errorMessage: null,
      successMessage: null
    }));

    try {
      const payload = remoteFormState.remoteId
        ? await api.updateRemote({
            remoteId: remoteFormState.remoteId,
            label: remoteFormState.label,
            kind: remoteFormState.kind,
            endpoint: remoteFormState.endpoint,
            enabled: remoteFormState.enabled
          })
        : await api.createRemote({
            label: remoteFormState.label,
            kind: remoteFormState.kind,
            endpoint: remoteFormState.endpoint,
            enabled: remoteFormState.enabled
          });

      if (!payload?.ok) {
        setRemoteFormState((previous) => ({
          ...previous,
          saving: false,
          errorMessage: payload?.error?.message ?? "Failed to save remote"
        }));
        return;
      }

      setRemoteFormState({
        ...createDefaultRemoteFormState(),
        successMessage: remoteFormState.remoteId ? "Remote updated" : "Remote created"
      });
      setRemotesReloadToken((value) => value + 1);
      setDeployReloadToken((value) => value + 1);
    } catch (error) {
      setRemoteFormState((previous) => ({
        ...previous,
        saving: false,
        errorMessage: error?.message ?? "Failed to save remote"
      }));
    }
  }, [api, remoteFormState, setDeployReloadToken, setRemoteFormState, setRemotesReloadToken]);

  const handleDeleteRemote = useCallback(
    async (remoteId) => {
      setRemoteFormState((previous) => ({
        ...previous,
        errorMessage: null,
        successMessage: null
      }));

      try {
        const payload = await api.deleteRemote({
          remoteId
        });

        if (!payload?.ok) {
          setRemoteFormState((previous) => ({
            ...previous,
            errorMessage: payload?.error?.message ?? "Failed to delete remote"
          }));
          return;
        }

        setRemoteFormState((previous) => ({
          ...previous,
          successMessage: "Remote deleted"
        }));
        setRemotesReloadToken((value) => value + 1);
        setDeployReloadToken((value) => value + 1);
      } catch (error) {
        setRemoteFormState((previous) => ({
          ...previous,
          errorMessage: error?.message ?? "Failed to delete remote"
        }));
      }
    },
    [api, setDeployReloadToken, setRemoteFormState, setRemotesReloadToken]
  );

  return {
    handleRemoteFormChange,
    handleEditRemote,
    handleResetRemoteForm,
    handleSubmitRemoteForm,
    handleDeleteRemote
  };
}

function useDeployAndModuleActions({
  api,
  remotesDeployEnabled,
  remotesState,
  selectedRemoteId,
  setDeployState,
  setDeployReloadToken,
  setModuleRuntimeState,
  setModuleRuntimeReloadToken
}) {
  const handleDeployNow = useCallback(async () => {
    if (!remotesDeployEnabled) {
      return;
    }

    const selectedRemote = remotesState.items.find((item) => item.id === selectedRemoteId) ?? null;
    if (!selectedRemote) {
      setDeployState((previous) => ({
        ...previous,
        errorMessage: "Select a deploy target remote first"
      }));
      return;
    }

    if (!selectedRemote.enabled) {
      setDeployState((previous) => ({
        ...previous,
        errorMessage: "Selected remote is disabled"
      }));
      return;
    }

    setDeployState((previous) => ({
      ...previous,
      starting: true,
      errorMessage: null
    }));

    try {
      const payload = await api.startDeployJob({
        remoteId: selectedRemoteId
      });

      if (!payload?.ok) {
        setDeployState((previous) => ({
          ...previous,
          starting: false,
          errorMessage: payload?.error?.message ?? "Deploy start was rejected"
        }));
        return;
      }

      setDeployState((previous) => ({
        ...previous,
        starting: false,
        errorMessage: null
      }));
      setDeployReloadToken((value) => value + 1);
    } catch (error) {
      setDeployState((previous) => ({
        ...previous,
        starting: false,
        errorMessage: error?.message ?? "Failed to start deploy"
      }));
    }
  }, [api, remotesDeployEnabled, remotesState.items, selectedRemoteId, setDeployReloadToken, setDeployState]);

  const handleRunModuleAction = useCallback(
    async (moduleId, action) => {
      const actionMap = {
        install: api.installModule,
        uninstall: api.uninstallModule,
        enable: api.enableModule,
        disable: api.disableModule
      };
      const runAction = actionMap[action];
      if (typeof runAction !== "function") {
        return;
      }

      setModuleRuntimeState((previous) => ({
        ...previous,
        runningAction: {
          moduleId,
          action
        },
        errorMessage: null,
        successMessage: null
      }));

      try {
        const payload = await runAction({
          moduleId
        });

        if (!payload?.ok) {
          setModuleRuntimeState((previous) => ({
            ...previous,
            runningAction: null,
            errorMessage: `[${payload?.error?.code ?? "MODULE_ACTION_FAILED"}] ${
              payload?.error?.message ?? "Failed to run module lifecycle action"
            }`
          }));
          return;
        }

        setModuleRuntimeState((previous) => ({
          ...previous,
          runningAction: null,
          successMessage: `Module '${moduleId}' transitioned ${payload?.state?.before ?? "unknown"} -> ${
            payload?.state?.after ?? "unknown"
          }`
        }));
        setModuleRuntimeReloadToken((value) => value + 1);
      } catch (error) {
        setModuleRuntimeState((previous) => ({
          ...previous,
          runningAction: null,
          errorMessage: error?.message ?? "Failed to run module lifecycle action"
        }));
      }
    },
    [api, setModuleRuntimeReloadToken, setModuleRuntimeState]
  );

  return {
    handleDeployNow,
    handleRunModuleAction
  };
}

function useRemotesDeployActions(params) {
  return {
    ...useRemoteManagementActions(params),
    ...useDeployAndModuleActions(params)
  };
}

export { useRemotesDeployActions };
