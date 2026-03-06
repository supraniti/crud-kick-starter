function errorPayload(code, message) {
  return {
    ok: false,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  };
}

function buildCollectionSchemaTypeRegistry(createSchemaTypeRegistry) {
  if (typeof createSchemaTypeRegistry !== "function") {
    throw new Error("createSchemaTypeRegistry is required for records collection handlers");
  }

  const registry = createSchemaTypeRegistry();
  registry.register({
    contractVersion: 1,
    typeKey: "reference-record-item",
    fields: {
      id: {
        kind: "text",
        required: true
      },
      title: {
        kind: "text",
        required: true
      },
      status: {
        kind: "text",
        required: true
      },
      score: {
        kind: "number",
        required: true
      },
      featured: {
        kind: "boolean",
        required: true
      },
      publishedOn: {
        kind: "text",
        required: false
      },
      noteIds: {
        kind: "json",
        required: false
      },
      slug: {
        kind: "text",
        required: false
      }
    }
  });
  registry.register({
    contractVersion: 1,
    typeKey: "reference-note-item",
    fields: {
      id: {
        kind: "text",
        required: true
      },
      title: {
        kind: "text",
        required: true
      },
      category: {
        kind: "text",
        required: true
      },
      labels: {
        kind: "json",
        required: false
      },
      priority: {
        kind: "number",
        required: true
      },
      pinned: {
        kind: "boolean",
        required: true
      },
      dueDate: {
        kind: "text",
        required: false
      },
      recordId: {
        kind: "ref",
        required: false,
        refType: "reference-record-item"
      },
      slug: {
        kind: "text",
        required: false
      }
    }
  });

  return registry;
}

function createSchemaValidationStage({
  schemaTypeRegistry,
  typeKey,
  errorCode
}) {
  return async (input) => {
    const schemaValidation = schemaTypeRegistry.validateItem(typeKey, input.next ?? {});
    if (schemaValidation.ok) {
      return {
        ok: true
      };
    }

    const firstError = schemaValidation.errors[0];
    return {
      ok: false,
      errors: [
        {
          code: errorCode,
          message:
            firstError?.message ??
            `Schema validation failed for '${typeKey}'`
        }
      ]
    };
  };
}

function createAllowSafeguard(safeguardInput = {}) {
  return {
    ok: true,
    decision: "allow",
    severity: "none",
    code: "SAFEGUARD_ALLOW",
    action: safeguardInput.action ?? "mutate",
    entityType: safeguardInput.entityType ?? "collection-item",
    entityId: safeguardInput.entityId ?? "unknown",
    impact: {
      dependentCount: 0,
      dependentIds: []
    },
    message: "No safeguard intervention required"
  };
}

function resolveValidationConflictFieldId(error) {
  if (typeof error?.fieldId === "string" && error.fieldId.length > 0) {
    return error.fieldId;
  }

  if (typeof error?.field === "string" && error.field.length > 0) {
    return error.field;
  }

  return null;
}

function toValidationConflict(error, index) {
  const fieldId = resolveValidationConflictFieldId(error);
  const conflict = {
    order: index,
    code:
      typeof error?.code === "string" && error.code.length > 0
        ? error.code
        : "MUTATION_VALIDATION_FAILED",
    message:
      typeof error?.message === "string" && error.message.length > 0
        ? error.message
        : "Mutation validation failed"
  };

  if (fieldId) {
    conflict.fieldId = fieldId;
  }
  if (typeof error?.fieldType === "string") {
    conflict.fieldType = error.fieldType;
  }
  if (typeof error?.referenceCollectionId === "string") {
    conflict.referenceCollectionId = error.referenceCollectionId;
  }
  if (Array.isArray(error?.missingReferenceIds)) {
    conflict.missingReferenceIds = [...error.missingReferenceIds];
  }
  if (typeof error?.missingCount === "number") {
    conflict.missingCount = error.missingCount;
  }
  if (typeof error?.summary === "string") {
    conflict.summary = error.summary;
  }

  return conflict;
}

function buildValidationErrorPayload(reply, errors = [], fallbackCode = "MUTATION_VALIDATION_FAILED") {
  if (typeof reply?.code === "function") {
    reply.code(400);
  } else if (typeof reply?.status === "function") {
    reply.status(400);
  }
  const conflicts = Array.isArray(errors)
    ? errors.map((error, index) => toValidationConflict(error, index))
    : [];
  const firstConflict = conflicts[0] ?? {
    code: fallbackCode,
    message: "Mutation validation failed"
  };

  return {
    ok: false,
    error: {
      code: firstConflict.code,
      message: firstConflict.message,
      ...(conflicts.length > 0 ? { conflicts } : {})
    },
    timestamp: new Date().toISOString()
  };
}

async function runMutationPipeline({
  pipeline,
  input,
  reply,
  badRequest,
  fallbackCode
}) {
  const result = await pipeline.run({
    ...input,
    confirmed: true,
    impact: {
      dependentCount: 0,
      dependentIds: []
    }
  });

  if (result.ok) {
    return {
      ok: true,
      item: result.result
    };
  }

  if (result.status === "validation-failed") {
    return {
      ok: false,
      payload: buildValidationErrorPayload(reply, result.errors, fallbackCode)
    };
  }

  if (result.status === "failed") {
    const mutationError = result.error ?? {
      code: fallbackCode,
      message: "Mutation execution failed"
    };
    if (typeof mutationError.statusCode === "number") {
      return {
        ok: false,
        statusCode: mutationError.statusCode,
        payload: errorPayload(mutationError.code, mutationError.message)
      };
    }

    return {
      ok: false,
      payload: buildValidationErrorPayload(reply, [mutationError], fallbackCode)
    };
  }

  const safeguard = result.safeguard ?? {};
  return {
    ok: false,
    statusCode: 409,
    payload: errorPayload(
      safeguard.code ?? "SAFEGUARD_CONFIRMATION_REQUIRED",
      safeguard.message ?? "Mutation requires safeguard confirmation"
    )
  };
}

export {
  buildCollectionSchemaTypeRegistry,
  createAllowSafeguard,
  createSchemaValidationStage,
  errorPayload,
  runMutationPipeline
};
