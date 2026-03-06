import {
  resolveLegacyQuickActionRouteAction
} from "../../runtime/view-registry.jsx";
import { isModuleRouteViewActionType } from "../../runtime/shared-capability-bridges/route-view-catalog.mjs";

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function resolveModuleViewActions(viewRegistration) {
  if (!viewRegistration || typeof viewRegistration !== "object") {
    return [];
  }

  const resolved = [];
  const seenActionIds = new Set();
  const registeredActions = Array.isArray(viewRegistration.actions)
    ? viewRegistration.actions.filter((action) => action && typeof action === "object")
    : [];
  const actionById = new Map(
    registeredActions
      .filter((action) => typeof action.id === "string" && action.id.length > 0)
      .map((action) => [action.id, action])
  );

  if (Array.isArray(viewRegistration.quickActions)) {
    for (const quickActionId of viewRegistration.quickActions) {
      if (typeof quickActionId !== "string" || quickActionId.length === 0) {
        continue;
      }

      if (seenActionIds.has(quickActionId)) {
        continue;
      }

      const actionDefinition =
        actionById.get(quickActionId) ?? resolveLegacyQuickActionRouteAction(quickActionId);
      if (!actionDefinition) {
        continue;
      }

      seenActionIds.add(quickActionId);
      resolved.push(actionDefinition);
    }
  }

  if (registeredActions.length > 0) {
    for (const action of registeredActions) {
      if (!action || typeof action !== "object") {
        continue;
      }

      const actionId = typeof action.id === "string" ? action.id : "";
      if (actionId.length === 0 || seenActionIds.has(actionId)) {
        continue;
      }

      seenActionIds.add(actionId);
      resolved.push(action);
    }
  }

  return resolved;
}

function runModuleViewAction({
  actionId,
  viewActions,
  activeViewRegistration,
  route,
  navigate,
  moduleRuntimeItems
}) {
  const action = viewActions.find((candidate) => candidate.id === actionId);
  if (!action) {
    return;
  }

  if (isModuleRouteViewActionType(action.type)) {
    if (typeof activeViewRegistration?.runAction !== "function") {
      return;
    }

    try {
      activeViewRegistration.runAction({
        action,
        route,
        navigate,
        moduleRuntimeItems
      });
    } catch {
      // Module-owned action handlers are isolated; failures are treated as no-op.
    }
    return;
  }

  if (action.type === "external") {
    const href = typeof action.href === "string" ? action.href : "";
    if (href.length === 0) {
      return;
    }

    if (action.target === "self") {
      window.location.assign(href);
      return;
    }

    window.open(href, "_blank", "noopener,noreferrer");
    return;
  }

  if (action.type === "navigate" && isPlainObject(action.route)) {
    const routeModuleId =
      typeof action.route.moduleId === "string" ? action.route.moduleId : "";
    if (routeModuleId.length === 0) {
      return;
    }

    navigate(
      {
        moduleId: routeModuleId,
        ...(isPlainObject(action.route.state) ? action.route.state : {})
      },
      { replace: false }
    );
  }
}

export { isPlainObject, resolveModuleViewActions, runModuleViewAction };
