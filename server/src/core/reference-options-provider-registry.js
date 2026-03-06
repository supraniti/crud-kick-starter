function createDiagnostic(code, message, details = {}) {
  return {
    code,
    message,
    ...details
  };
}

function normalizeDiagnosticEntries(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }

  return entries
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({ ...entry }));
}

function isReferenceOptionsProviderContract(provider) {
  return (
    provider &&
    typeof provider === "object" &&
    typeof provider.listOptions === "function"
  );
}

function normalizeProviderRegistrationInput({ referenceCollectionId, moduleId, provider }) {
  const normalizedCollectionId =
    typeof referenceCollectionId === "string" ? referenceCollectionId.trim() : "";
  if (normalizedCollectionId.length === 0) {
    return {
      ok: false,
      diagnostic: createDiagnostic(
        "REFERENCE_OPTIONS_PROVIDER_REGISTRATION_INVALID",
        "Reference options provider registration requires a non-empty referenceCollectionId",
        {
          moduleId: moduleId ?? null
        }
      )
    };
  }

  const normalizedModuleId = typeof moduleId === "string" ? moduleId.trim() : "";
  if (normalizedModuleId.length === 0) {
    return {
      ok: false,
      diagnostic: createDiagnostic(
        "REFERENCE_OPTIONS_PROVIDER_REGISTRATION_INVALID",
        `Reference options provider '${normalizedCollectionId}' requires a non-empty moduleId`,
        {
          referenceCollectionId: normalizedCollectionId,
          moduleId: moduleId ?? null
        }
      )
    };
  }

  if (!isReferenceOptionsProviderContract(provider)) {
    return {
      ok: false,
      diagnostic: createDiagnostic(
        "REFERENCE_OPTIONS_PROVIDER_REGISTRATION_INVALID",
        `Reference options provider '${normalizedCollectionId}' requires a provider with listOptions`,
        {
          referenceCollectionId: normalizedCollectionId,
          moduleId: normalizedModuleId
        }
      )
    };
  }

  return {
    ok: true,
    value: {
      referenceCollectionId: normalizedCollectionId,
      moduleId: normalizedModuleId,
      provider
    }
  };
}

function registerReferenceOptionsProvider(
  providersByCollectionId,
  registrationDiagnostics,
  input
) {
  const validation = normalizeProviderRegistrationInput(input);
  if (!validation.ok) {
    registrationDiagnostics.push(validation.diagnostic);
    return {
      ok: false,
      error: validation.diagnostic
    };
  }

  const { referenceCollectionId, moduleId, provider } = validation.value;
  if (providersByCollectionId.has(referenceCollectionId)) {
    const existing = providersByCollectionId.get(referenceCollectionId);
    const diagnostic = createDiagnostic(
      "REFERENCE_OPTIONS_PROVIDER_DUPLICATE",
      `Reference options provider for '${referenceCollectionId}' is already registered`,
      {
        referenceCollectionId,
        moduleId,
        firstModuleId: existing.moduleId ?? null
      }
    );
    registrationDiagnostics.push(diagnostic);
    return {
      ok: false,
      error: diagnostic
    };
  }

  providersByCollectionId.set(referenceCollectionId, {
    referenceCollectionId,
    moduleId,
    provider: {
      listOptions: provider.listOptions,
      ...(typeof provider.listValidationRows === "function"
        ? { listValidationRows: provider.listValidationRows }
        : {})
    }
  });

  return {
    ok: true
  };
}

function getReferenceOptionsProvider(providersByCollectionId, referenceCollectionId) {
  return providersByCollectionId.get(referenceCollectionId)?.provider ?? null;
}

function getReferenceOptionsProviderRegistration(providersByCollectionId, referenceCollectionId) {
  const entry = providersByCollectionId.get(referenceCollectionId);
  if (!entry) {
    return null;
  }

  return {
    referenceCollectionId: entry.referenceCollectionId,
    moduleId: entry.moduleId,
    provider: entry.provider
  };
}

function listReferenceOptionsProviderRegistrations(providersByCollectionId) {
  return [...providersByCollectionId.values()]
    .map((entry) => ({
      referenceCollectionId: entry.referenceCollectionId,
      moduleId: entry.moduleId
    }))
    .sort((left, right) =>
      left.referenceCollectionId.localeCompare(right.referenceCollectionId)
    );
}

function resolveReferenceOptionsProviderStatus(
  providersByCollectionId,
  registrationDiagnostics,
  options = {}
) {
  const moduleRegistry = options.moduleRegistry ?? null;
  const extraDiagnostics = normalizeDiagnosticEntries(options.additionalDiagnostics);
  const entries = listReferenceOptionsProviderRegistrations(providersByCollectionId);
  const referenceOptionsProviderModuleMap = {};
  const activeReferenceOptionsProviderModuleMap = {};
  const diagnostics = [...registrationDiagnostics, ...extraDiagnostics];

  for (const entry of entries) {
    referenceOptionsProviderModuleMap[entry.referenceCollectionId] = entry.moduleId;

    if (!moduleRegistry) {
      activeReferenceOptionsProviderModuleMap[entry.referenceCollectionId] = entry.moduleId;
      continue;
    }

    const state = moduleRegistry.getState(entry.moduleId);
    if (state === null) {
      diagnostics.push(
        createDiagnostic(
          "REFERENCE_OPTIONS_PROVIDER_MODULE_NOT_DISCOVERED",
          `Reference options provider '${entry.referenceCollectionId}' module '${entry.moduleId}' is not discovered`,
          {
            referenceCollectionId: entry.referenceCollectionId,
            moduleId: entry.moduleId
          }
        )
      );
      continue;
    }

    if (state === "enabled") {
      activeReferenceOptionsProviderModuleMap[entry.referenceCollectionId] = entry.moduleId;
    }
  }

  return {
    registeredReferenceCollectionIds: entries.map((entry) => entry.referenceCollectionId),
    activeRegisteredReferenceCollectionIds: Object.keys(
      activeReferenceOptionsProviderModuleMap
    ).sort(),
    referenceOptionsProviderModuleMap,
    activeReferenceOptionsProviderModuleMap,
    diagnostics
  };
}

export function createReferenceOptionsProviderRegistry() {
  const providersByCollectionId = new Map();
  const registrationDiagnostics = [];

  const register = (input) =>
    registerReferenceOptionsProvider(providersByCollectionId, registrationDiagnostics, input);
  const get = (referenceCollectionId) =>
    getReferenceOptionsProvider(providersByCollectionId, referenceCollectionId);
  const getRegistration = (referenceCollectionId) =>
    getReferenceOptionsProviderRegistration(providersByCollectionId, referenceCollectionId);
  const list = () => listReferenceOptionsProviderRegistrations(providersByCollectionId);
  const resolveStatus = (options = {}) =>
    resolveReferenceOptionsProviderStatus(
      providersByCollectionId,
      registrationDiagnostics,
      options
    );

  return {
    register,
    get,
    getRegistration,
    list,
    resolveStatus
  };
}
