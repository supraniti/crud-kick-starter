import { resolveReferenceRuntimeDefaults } from "../domains/reference/runtime/services/reference-runtime-defaults-domain-service.js";
import {
  createReferenceRuntimeRegistrationContextWithDefaults
} from "../domains/reference/runtime/services/reference-runtime-registration-context-defaults-domain-service.js";
import { registerReferenceFeatureRoutes } from "./reference-domain-routes/feature-route-registration.js";

export async function registerReferenceDomainRoutes(fastify, options = {}) {
  const runtimeContext = await createReferenceRuntimeRegistrationContextWithDefaults({
    fastify,
    options
  });
  const runtimeDefaults = resolveReferenceRuntimeDefaults();

  registerReferenceFeatureRoutes({
    fastify,
    runtimeContext,
    deployOutputRoot: runtimeDefaults.deployOutputRoot
  });
}
