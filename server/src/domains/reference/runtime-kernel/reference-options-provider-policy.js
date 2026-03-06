const REFERENCE_OPTIONS_PROVIDER_POLICY_ENABLED_ONLY = "enabled-only";
const REFERENCE_OPTIONS_PROVIDER_POLICY_ALWAYS_AVAILABLE = "always-available";

function normalizeReferenceOptionsProviderPolicy(value) {
  if (typeof value !== "string") {
    return REFERENCE_OPTIONS_PROVIDER_POLICY_ENABLED_ONLY;
  }

  const normalized = value.trim().toLowerCase();
  if (
    normalized === REFERENCE_OPTIONS_PROVIDER_POLICY_ENABLED_ONLY ||
    normalized === REFERENCE_OPTIONS_PROVIDER_POLICY_ALWAYS_AVAILABLE
  ) {
    return normalized;
  }

  return REFERENCE_OPTIONS_PROVIDER_POLICY_ENABLED_ONLY;
}

function resolveReferenceOptionsProviderRegistration(
  referenceOptionsProviderRegistry,
  referenceCollectionId
) {
  if (!referenceOptionsProviderRegistry || typeof referenceCollectionId !== "string") {
    return null;
  }

  if (typeof referenceOptionsProviderRegistry.getRegistration === "function") {
    return referenceOptionsProviderRegistry.getRegistration(referenceCollectionId);
  }

  const provider =
    typeof referenceOptionsProviderRegistry.get === "function"
      ? referenceOptionsProviderRegistry.get(referenceCollectionId)
      : null;
  if (!provider) {
    return null;
  }

  return {
    referenceCollectionId,
    moduleId: null,
    provider
  };
}

function resolveReferenceOptionsProviderLifecycleGate({
  providerRegistration,
  moduleRegistry,
  referenceOptionsProviderPolicy
}) {
  const policy = normalizeReferenceOptionsProviderPolicy(referenceOptionsProviderPolicy);
  if (policy !== REFERENCE_OPTIONS_PROVIDER_POLICY_ENABLED_ONLY) {
    return {
      ok: true,
      policy,
      moduleId: providerRegistration?.moduleId ?? null,
      moduleState: null
    };
  }

  const moduleId = providerRegistration?.moduleId;
  if (typeof moduleId !== "string" || moduleId.length === 0) {
    return {
      ok: true,
      policy,
      moduleId: null,
      moduleState: null
    };
  }

  if (!moduleRegistry || typeof moduleRegistry.getState !== "function") {
    return {
      ok: true,
      policy,
      moduleId,
      moduleState: "unknown"
    };
  }

  const moduleState = moduleRegistry.getState(moduleId);
  if (moduleState !== "enabled") {
    return {
      ok: false,
      policy,
      moduleId,
      moduleState
    };
  }

  return {
    ok: true,
    policy,
    moduleId,
    moduleState
  };
}

export {
  REFERENCE_OPTIONS_PROVIDER_POLICY_ENABLED_ONLY,
  REFERENCE_OPTIONS_PROVIDER_POLICY_ALWAYS_AVAILABLE,
  normalizeReferenceOptionsProviderPolicy,
  resolveReferenceOptionsProviderRegistration,
  resolveReferenceOptionsProviderLifecycleGate
};
