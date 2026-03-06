import { useCallback, useEffect } from "react";

const EMPTY_POLICY_STATE = {
  settingsRepositoryPolicyMap: {},
  activeSettingsRepositoryPolicyMap: {}
};

function useSettingsModulesLoader({
  api,
  enabled,
  isAuthenticated,
  hasSettingsApi,
  hasRuntimeApi,
  runtimePolicyStateInput,
  settingsReloadToken,
  setSettingsModulesState,
  setModuleSettingsState,
  setSettingsPolicyState,
  createDefaultSettingsModulesState,
  createDefaultModuleSettingsState
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated || !hasSettingsApi) {
      setSettingsModulesState(createDefaultSettingsModulesState());
      setModuleSettingsState(createDefaultModuleSettingsState());
      setSettingsPolicyState(EMPTY_POLICY_STATE);
      return;
    }

    let cancelled = false;
    setSettingsModulesState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null
    }));

    const runtimePolicyPromise =
      runtimePolicyStateInput !== null
        ? Promise.resolve({ runtime: runtimePolicyStateInput })
        : hasRuntimeApi
          ? api.readModulesRuntime()
          : Promise.resolve(null);

    Promise.all([api.listSettingsModules(), runtimePolicyPromise])
      .then(([payload, runtimePayload]) => {
        if (cancelled) {
          return;
        }
        setSettingsModulesState({
          loading: false,
          errorMessage: null,
          items: payload?.items ?? []
        });
        setSettingsPolicyState({
          settingsRepositoryPolicyMap:
            runtimePayload?.runtime?.settingsRepositoryPolicyMap ?? {},
          activeSettingsRepositoryPolicyMap:
            runtimePayload?.runtime?.activeSettingsRepositoryPolicyMap ?? {}
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setSettingsModulesState({
          loading: false,
          errorMessage: error?.message ?? "Failed to load module settings metadata",
          items: []
        });
        setSettingsPolicyState(EMPTY_POLICY_STATE);
      });

    return () => {
      cancelled = true;
    };
  }, [
    api,
    createDefaultModuleSettingsState,
    createDefaultSettingsModulesState,
    enabled,
    hasRuntimeApi,
    hasSettingsApi,
    isAuthenticated,
    runtimePolicyStateInput,
    setModuleSettingsState,
    setSettingsModulesState,
    setSettingsPolicyState,
    settingsReloadToken
  ]);
}

function useActiveModuleSettingsLoader({
  activeModuleId,
  activeModuleSettingsMeta,
  api,
  enabled,
  hasSettingsApi,
  isAuthenticated,
  setModuleSettingsState,
  createDefaultModuleSettingsState,
  normalizeSchema,
  createDraftValuesFromPayload
}) {
  useEffect(() => {
    if (!enabled || !isAuthenticated || !hasSettingsApi) {
      setModuleSettingsState(createDefaultModuleSettingsState());
      return;
    }

    if (!activeModuleSettingsMeta) {
      setModuleSettingsState(createDefaultModuleSettingsState());
      return;
    }

    let cancelled = false;
    setModuleSettingsState((previous) => ({
      ...previous,
      loading: true,
      errorMessage: null,
      successMessage: null,
      moduleId: activeModuleId
    }));

    api
      .readModuleSettings({
        moduleId: activeModuleId
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        if (!payload?.ok) {
          setModuleSettingsState({
            ...createDefaultModuleSettingsState(),
            moduleId: activeModuleId,
            loading: false,
            errorMessage: payload?.error?.message ?? "Failed to load module settings"
          });
          return;
        }

        const schema = normalizeSchema(payload?.settings?.schema);
        const values =
          payload?.settings?.values && typeof payload.settings.values === "object"
            ? payload.settings.values
            : {};
        setModuleSettingsState({
          loading: false,
          saving: false,
          errorMessage: null,
          successMessage: null,
          moduleId: activeModuleId,
          schema,
          values,
          redactedFieldIds: payload?.settings?.redactedFieldIds ?? [],
          draftValues: createDraftValuesFromPayload(schema, values),
          dirtyFields: {}
        });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setModuleSettingsState({
          ...createDefaultModuleSettingsState(),
          moduleId: activeModuleId,
          loading: false,
          errorMessage: error?.message ?? "Failed to load module settings"
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeModuleId,
    activeModuleSettingsMeta,
    api,
    createDefaultModuleSettingsState,
    createDraftValuesFromPayload,
    enabled,
    hasSettingsApi,
    isAuthenticated,
    normalizeSchema,
    setModuleSettingsState
  ]);
}

function useSaveModuleSettingsAction({
  api,
  hasSettingsApi,
  moduleSettingsState,
  setModuleSettingsState,
  setSettingsReloadToken,
  normalizeSchema,
  createDraftValuesFromPayload
}) {
  return useCallback(async () => {
    if (!hasSettingsApi) {
      setModuleSettingsState((previous) => ({
        ...previous,
        errorMessage: "Module settings API is unavailable",
        successMessage: null
      }));
      return;
    }

    if (!moduleSettingsState.moduleId) {
      return;
    }

    const patch = {};
    for (const field of moduleSettingsState.schema.fields ?? []) {
      if (moduleSettingsState.dirtyFields[field.id] !== true) {
        continue;
      }

      const draftValue = moduleSettingsState.draftValues[field.id];
      if (field.sensitive && draftValue === "") {
        continue;
      }
      patch[field.id] = draftValue;
    }

    if (Object.keys(patch).length === 0) {
      setModuleSettingsState((previous) => ({
        ...previous,
        successMessage: "No settings changes to save"
      }));
      return;
    }

    setModuleSettingsState((previous) => ({
      ...previous,
      saving: true,
      errorMessage: null,
      successMessage: null
    }));

    try {
      const payload = await api.updateModuleSettings({
        moduleId: moduleSettingsState.moduleId,
        settings: patch
      });

      if (!payload?.ok) {
        setModuleSettingsState((previous) => ({
          ...previous,
          saving: false,
          errorMessage: payload?.error?.message ?? "Failed to save module settings"
        }));
        return;
      }

      const schema = normalizeSchema(payload?.settings?.schema);
      const values =
        payload?.settings?.values && typeof payload.settings.values === "object"
          ? payload.settings.values
          : {};
      setModuleSettingsState((previous) => ({
        ...previous,
        saving: false,
        errorMessage: null,
        successMessage: "Module settings saved",
        schema,
        values,
        redactedFieldIds: payload?.settings?.redactedFieldIds ?? [],
        draftValues: createDraftValuesFromPayload(schema, values),
        dirtyFields: {}
      }));
      setSettingsReloadToken((value) => value + 1);
    } catch (error) {
      setModuleSettingsState((previous) => ({
        ...previous,
        saving: false,
        errorMessage: error?.message ?? "Failed to save module settings"
      }));
    }
  }, [
    api,
    createDraftValuesFromPayload,
    hasSettingsApi,
    moduleSettingsState,
    normalizeSchema,
    setModuleSettingsState,
    setSettingsReloadToken
  ]);
}

export {
  EMPTY_POLICY_STATE,
  useActiveModuleSettingsLoader,
  useSaveModuleSettingsAction,
  useSettingsModulesLoader
};
