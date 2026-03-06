import {
  dedupeRouteViewActions,
  dedupeRouteViewQuickActions
} from "../../../shared-capability-bridges/route-view-catalog.mjs";
import { VIEW_REGISTRATION_CODES } from "./00-route-state-and-constants.js";
import { validateViewDescriptor } from "./02-validate-view-descriptor.js";

function createViewRegistry(descriptors) {
  const registrations = new Map();
  const diagnostics = [];

  for (const [index, descriptor] of descriptors.entries()) {
    const validated = validateViewDescriptor(descriptor, index);
    if (!validated.ok) {
      diagnostics.push(validated.error);
      continue;
    }

    const {
      moduleId,
      render,
      usesCollectionsDomain,
      routeStateAdapter,
      requiredDomains,
      runAction
    } =
      validated.value;
    if (registrations.has(moduleId)) {
      diagnostics.push({
        code: VIEW_REGISTRATION_CODES.DUPLICATE_MODULE,
        message: `View registration for module '${moduleId}' is duplicated`,
        index,
        moduleId
      });
      continue;
    }

    registrations.set(moduleId, {
      moduleId,
      render,
      usesCollectionsDomain,
      routeStateAdapter,
      requiredDomains,
      quickActions: dedupeRouteViewQuickActions(validated.value.quickActions),
      actions: dedupeRouteViewActions(validated.value.actions),
      runAction
    });
  }

  return {
    registrations,
    diagnostics
  };
}

export { createViewRegistry };
