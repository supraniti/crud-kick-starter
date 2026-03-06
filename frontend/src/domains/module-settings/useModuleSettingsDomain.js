import { useCallback, useMemo, useState } from "react";
import {
  EMPTY_POLICY_STATE,
  useActiveModuleSettingsLoader,
  useSaveModuleSettingsAction,
  useSettingsModulesLoader
} from "./useModuleSettingsDomainActions.js";

function createDefaultSettingsModulesState() {
  return {
    loading: false,
    errorMessage: null,
    items: []
  };
}

function createDefaultModuleSettingsState() {
  return {
    loading: false,
    saving: false,
    errorMessage: null,
    successMessage: null,
    moduleId: null,
    schema: {
      fields: []
    },
    values: {},
    redactedFieldIds: [],
    draftValues: {},
    dirtyFields: {}
  };
}

function cloneField(field) {
  return {
    ...field,
    options: Array.isArray(field.options)
      ? field.options.map((option) => ({ ...option }))
      : [],
    fields: Array.isArray(field.fields)
      ? field.fields.map((nestedField) => cloneField(nestedField))
      : []
  };
}

function cloneValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function normalizeSchema(schema) {
  if (!schema || typeof schema !== "object") {
    return {
      fields: []
    };
  }
  return {
    fields: Array.isArray(schema.fields) ? schema.fields.map(cloneField) : []
  };
}

function createDraftValuesFromPayload(schema, values) {
  const draftValues = {};
  for (const field of schema.fields ?? []) {
    if (field.sensitive) {
      draftValues[field.id] = "";
      continue;
    }
    if (field.type === "enum-multi") {
      draftValues[field.id] = Array.isArray(values?.[field.id])
        ? values[field.id].filter((value) => typeof value === "string")
        : [];
      continue;
    }
    draftValues[field.id] = cloneValue(values?.[field.id]);
  }
  return draftValues;
}

function resolveModuleSettingsPersistencePolicy(policyState, moduleId) {
  if (!policyState || !moduleId) {
    return null;
  }

  const policyMap =
    policyState.settingsRepositoryPolicyMap &&
    typeof policyState.settingsRepositoryPolicyMap === "object"
      ? policyState.settingsRepositoryPolicyMap
      : {};
  const activePolicyMap =
    policyState.activeSettingsRepositoryPolicyMap &&
    typeof policyState.activeSettingsRepositoryPolicyMap === "object"
      ? policyState.activeSettingsRepositoryPolicyMap
      : {};
  const policy =
    policyMap[moduleId] && typeof policyMap[moduleId] === "object"
      ? policyMap[moduleId]
      : null;
  if (!policy) {
    return null;
  }

  return {
    ...policy,
    active: Object.prototype.hasOwnProperty.call(activePolicyMap, moduleId)
  };
}

function normalizeRuntimeSettingsPolicyState(runtimeSettingsPolicyState) {
  if (
    !runtimeSettingsPolicyState ||
    typeof runtimeSettingsPolicyState !== "object" ||
    Array.isArray(runtimeSettingsPolicyState)
  ) {
    return null;
  }

  const settingsRepositoryPolicyMap =
    runtimeSettingsPolicyState.settingsRepositoryPolicyMap &&
    typeof runtimeSettingsPolicyState.settingsRepositoryPolicyMap === "object" &&
    !Array.isArray(runtimeSettingsPolicyState.settingsRepositoryPolicyMap)
      ? runtimeSettingsPolicyState.settingsRepositoryPolicyMap
      : null;
  const activeSettingsRepositoryPolicyMap =
    runtimeSettingsPolicyState.activeSettingsRepositoryPolicyMap &&
    typeof runtimeSettingsPolicyState.activeSettingsRepositoryPolicyMap === "object" &&
    !Array.isArray(runtimeSettingsPolicyState.activeSettingsRepositoryPolicyMap)
      ? runtimeSettingsPolicyState.activeSettingsRepositoryPolicyMap
      : null;

  if (!settingsRepositoryPolicyMap || !activeSettingsRepositoryPolicyMap) {
    return null;
  }

  return {
    settingsRepositoryPolicyMap,
    activeSettingsRepositoryPolicyMap
  };
}

function useModuleSettingsDomain({
  api,
  isAuthenticated,
  enabled = false,
  activeModuleId,
  runtimeSettingsPolicyState = null
}) {
  const [settingsModulesState, setSettingsModulesState] = useState(() =>
    createDefaultSettingsModulesState()
  );
  const [moduleSettingsState, setModuleSettingsState] = useState(() =>
    createDefaultModuleSettingsState()
  );
  const [settingsPolicyState, setSettingsPolicyState] = useState(() => ({
    ...EMPTY_POLICY_STATE
  }));
  const [settingsReloadToken, setSettingsReloadToken] = useState(0);
  const hasSettingsApi =
    typeof api?.listSettingsModules === "function" &&
    typeof api?.readModuleSettings === "function" &&
    typeof api?.updateModuleSettings === "function";
  const hasRuntimeApi = typeof api?.readModulesRuntime === "function";
  const runtimePolicyStateInput = useMemo(
    () => normalizeRuntimeSettingsPolicyState(runtimeSettingsPolicyState),
    [
      runtimeSettingsPolicyState?.settingsRepositoryPolicyMap,
      runtimeSettingsPolicyState?.activeSettingsRepositoryPolicyMap
    ]
  );

  useSettingsModulesLoader({
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
  });

  const activeModuleSettingsMeta = useMemo(
    () =>
      settingsModulesState.items.find((item) => item.moduleId === activeModuleId) ?? null,
    [activeModuleId, settingsModulesState.items]
  );
  const activeModuleSettingsPersistencePolicy = useMemo(
    () => resolveModuleSettingsPersistencePolicy(settingsPolicyState, activeModuleId),
    [activeModuleId, settingsPolicyState]
  );

  useActiveModuleSettingsLoader({
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
  });

  const handleSettingsFieldChange = useCallback((fieldId, value) => {
    setModuleSettingsState((previous) => ({
      ...previous,
      draftValues: {
        ...previous.draftValues,
        [fieldId]: value
      },
      dirtyFields: {
        ...previous.dirtyFields,
        [fieldId]: true
      },
      errorMessage: null,
      successMessage: null
    }));
  }, []);

  const handleSaveModuleSettings = useSaveModuleSettingsAction({
    api,
    hasSettingsApi,
    moduleSettingsState,
    setModuleSettingsState,
    setSettingsReloadToken,
    normalizeSchema,
    createDraftValuesFromPayload
  });

  return {
    settingsModulesState,
    activeModuleSettingsMeta,
    activeModuleSettingsPersistencePolicy,
    moduleSettingsState,
    isActiveModuleSettingsAvailable: activeModuleSettingsMeta !== null,
    handleSettingsFieldChange,
    handleSaveModuleSettings
  };
}

export { useModuleSettingsDomain };
