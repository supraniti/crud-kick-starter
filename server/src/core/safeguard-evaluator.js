function invalidInputPayload(message, field = null) {
  return {
    ok: false,
    decision: "deny",
    severity: "critical",
    code: "SAFEGUARD_INPUT_INVALID",
    message,
    details: {
      field
    }
  };
}

export function evaluateSafeguard(input, options = {}) {
  if (!input || typeof input !== "object") {
    return invalidInputPayload("Safeguard input must be an object");
  }

  const { action, entityType, entityId, impact } = input;
  if (typeof action !== "string" || action.length === 0) {
    return invalidInputPayload("Action is required", "action");
  }

  if (typeof entityType !== "string" || entityType.length === 0) {
    return invalidInputPayload("Entity type is required", "entityType");
  }

  if (typeof entityId !== "string" || entityId.length === 0) {
    return invalidInputPayload("Entity id is required", "entityId");
  }

  if (!impact || typeof impact !== "object") {
    return invalidInputPayload("Impact object is required", "impact");
  }

  const dependentCount = Number.isInteger(impact.dependentCount)
    ? impact.dependentCount
    : null;
  if (dependentCount === null || dependentCount < 0) {
    return invalidInputPayload(
      "Impact dependentCount must be a non-negative integer",
      "impact.dependentCount"
    );
  }

  if (!Array.isArray(impact.dependentIds)) {
    return invalidInputPayload(
      "Impact dependentIds must be an array",
      "impact.dependentIds"
    );
  }

  const denyActions = options.denyActions ?? ["drop-collection", "purge"];
  if (denyActions.includes(action)) {
    return {
      ok: true,
      decision: "deny",
      severity: "critical",
      code: "SAFEGUARD_DENY",
      message: `Action '${action}' is blocked by hard safeguard policy`,
      details: {
        action,
        entityType,
        entityId,
        impactSummary: `${dependentCount} dependencies impacted`
      }
    };
  }

  if (dependentCount > 0) {
    return {
      ok: true,
      decision: "require-confirmation",
      severity: "warning",
      code: "SAFEGUARD_CONFIRMATION_REQUIRED",
      message: `Action '${action}' affects dependent records`,
      details: {
        action,
        entityType,
        entityId,
        impactSummary: `${dependentCount} dependent records`,
        dependentIds: [...impact.dependentIds]
      }
    };
  }

  return {
    ok: true,
    decision: "allow",
    severity: "info",
    code: "SAFEGUARD_ALLOW",
    message: `Action '${action}' is safe to execute`,
    details: {
      action,
      entityType,
      entityId,
      impactSummary: "No dependent records"
    }
  };
}
