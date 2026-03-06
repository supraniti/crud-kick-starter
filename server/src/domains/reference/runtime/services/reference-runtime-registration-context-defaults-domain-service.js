import { createMutationPipeline } from "../../../../core/mutation-pipeline.js";
import { createSchemaTypeRegistry } from "../../../../core/schema-type-registry.js";
import {
  registerCollectionHandlersForDiscoveredModules
} from "../registrars/discovered-collection-handlers-runtime-registrar-domain-service.js";
import {
  registerMissionsForDiscoveredModules
} from "../registrars/discovered-missions-runtime-registrar-domain-service.js";
import {
  registerPersistencePluginsForDiscoveredModules
} from "../registrars/discovered-persistence-plugins-runtime-registrar-domain-service.js";
import {
  registerReferenceOptionsProvidersForDiscoveredModules
} from "../registrars/discovered-reference-options-providers-runtime-registrar-domain-service.js";
import {
  registerServicesForDiscoveredModules
} from "../registrars/discovered-services-runtime-registrar-domain-service.js";
import {
  buildReferenceStatePersistenceSummary,
  createJobsRuntime,
  createReferenceRepositories,
  createRuntimeInfrastructure,
  hydrateReferenceStateSlices,
  registerReferenceStateCloseHook,
  resolveReferenceStatePersistence
} from "./reference-runtime-infrastructure-domain-service.js";
import {
  createReferenceRuntimeRegistrationContext
} from "./reference-runtime-registration-context-domain-service.js";
import {
  normalizeReferenceOptionsProviderPolicy,
  resolveReferenceOptionsProviderLifecycleGate,
  resolveReferenceOptionsProviderRegistration
} from "./reference-options-provider-policy-runtime-domain-service.js";
import {
  buildCollectionValidationProfiles,
  nextRecordId,
  validateNoteInput,
  validateRecordCrossFieldConstraints,
  validateRecordInput
} from "../../collections/services/reference-collection-runtime-domain-service.js";
import {
  augmentPersistenceResolutionWithPolicyMaps,
  resolveCollectionDefinitions
} from "./reference-runtime-payload-domain-service.js";
import { resolveModuleSettingsDefinitions } from "../../settings/services/reference-module-settings-runtime-domain-service.js";
import {
  badRequest,
  createReferenceState,
  slugifyTitle
} from "./reference-state-utils-domain-service.js";

export async function createReferenceRuntimeRegistrationContextWithDefaults({
  fastify,
  options = {}
}) {
  const referenceOptionsProviderPolicy = normalizeReferenceOptionsProviderPolicy(
    options.referenceOptionsProviderPolicy
  );

  return createReferenceRuntimeRegistrationContext({
    fastify,
    options,
    referenceOptionsProviderPolicy,
    createReferenceState,
    resolveReferenceStatePersistence,
    hydrateReferenceStateSlices,
    createReferenceRepositories,
    createJobsRuntime,
    registerReferenceStateCloseHook,
    createRuntimeInfrastructure,
    buildReferenceStatePersistenceSummary,
    registerPersistencePluginsForDiscoveredModules,
    registerCollectionHandlersForDiscoveredModules,
    registerReferenceOptionsProvidersForDiscoveredModules,
    registerServicesForDiscoveredModules,
    registerMissionsForDiscoveredModules,
    createMutationPipeline,
    createSchemaTypeRegistry,
    buildCollectionValidationProfiles,
    validateRecordInput,
    validateNoteInput,
    badRequest,
    validateRecordCrossFieldConstraints,
    nextRecordId,
    slugifyTitle,
    resolveReferenceOptionsProviderRegistration,
    resolveReferenceOptionsProviderLifecycleGate,
    resolveCollectionDefinitions,
    augmentPersistenceResolutionWithPolicyMaps,
    resolveModuleSettingsDefinitions
  });
}
