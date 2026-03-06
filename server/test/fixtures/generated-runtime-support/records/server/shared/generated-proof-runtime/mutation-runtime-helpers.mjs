import { singularFromValue } from "./shared-utils.mjs";
import {
  resolveCollectionFieldTypePlugin
} from "../../../shared/collection-field-type-plugin-registry.mjs";

const SCHEMA_KIND_SET = new Set(["text", "number", "boolean", "json", "ref"]);
const FIELD_TYPE_TO_SCHEMA_KIND = Object.freeze({
  number: "number",
  boolean: "boolean",
  enum: "text",
  date: "text",
  computed: "text",
  text: "text",
  url: "text",
  "enum-multi": "json",
  "structured-object": "json",
  "structured-object-array": "json",
  "reference-multi": "json"
});

function resolvePluginSchemaKind(fieldDescriptor = {}) {
  const fieldTypePlugin = resolveCollectionFieldTypePlugin(fieldDescriptor?.type);
  if (!fieldTypePlugin || typeof fieldTypePlugin !== "object") {
    return null;
  }

  const declaredKind =
    typeof fieldTypePlugin.schema?.kind === "string"
      ? fieldTypePlugin.schema.kind.trim().toLowerCase()
      : "";
  if (SCHEMA_KIND_SET.has(declaredKind)) {
    return declaredKind;
  }

  return null;
}

function isFieldRequired(fieldDescriptor) {
  return fieldDescriptor.required === true;
}

function resolveReferenceCollectionId(fieldDescriptor) {
  return typeof fieldDescriptor.collectionId === "string" && fieldDescriptor.collectionId.length > 0
    ? fieldDescriptor.collectionId
    : "records";
}

function toReferenceSchemaDescriptor(fieldDescriptor) {
  const refCollectionId = resolveReferenceCollectionId(fieldDescriptor);
  return {
    kind: "ref",
    required: isFieldRequired(fieldDescriptor),
    refType: `reference-${singularFromValue(refCollectionId)}-item`
  };
}

function toSimpleSchemaDescriptor(kind, fieldDescriptor) {
  return {
    kind,
    required: isFieldRequired(fieldDescriptor)
  };
}

function resolveSchemaKindFromFieldDescriptor(fieldDescriptor) {
  const pluginSchemaKind = resolvePluginSchemaKind(fieldDescriptor);
  if (pluginSchemaKind) {
    return pluginSchemaKind;
  }
  if (fieldDescriptor.type === "reference") {
    return "ref";
  }
  return FIELD_TYPE_TO_SCHEMA_KIND[fieldDescriptor.type] ?? "text";
}

function toSchemaFieldDescriptor(fieldDescriptor) {
  const schemaKind = resolveSchemaKindFromFieldDescriptor(fieldDescriptor);
  if (schemaKind === "ref") {
    return toReferenceSchemaDescriptor(fieldDescriptor);
  }
  return toSimpleSchemaDescriptor(schemaKind, fieldDescriptor);
}

function buildSchemaFieldsForDefinition(definition) {
  if (!Array.isArray(definition.manifestFieldDescriptors) || definition.manifestFieldDescriptors.length === 0) {
    const primaryFieldId =
      typeof definition.primaryField === "string" && definition.primaryField.length > 0
        ? definition.primaryField
        : "title";
    const fields = {
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
      category: {
        kind: "text",
        required: true
      },
      labels: {
        kind: "json",
        required: false
      },
      publishedOn: {
        kind: "text",
        required: false
      },
      recordId: {
        kind: "text",
        required: false
      }
    };

    if (Array.isArray(definition.computedFields)) {
      for (const computedField of definition.computedFields) {
        if (typeof computedField?.id !== "string" || computedField.id.length === 0) {
          continue;
        }
        fields[computedField.id] = {
          kind: "text",
          required: false
        };
      }
    }

    if (!fields[primaryFieldId]) {
      fields[primaryFieldId] = {
        kind: "text",
        required: true
      };
    } else {
      fields[primaryFieldId] = {
        ...fields[primaryFieldId],
        required: true
      };
    }

    return fields;
  }

  const primaryFieldId =
    typeof definition.primaryField === "string" && definition.primaryField.length > 0
      ? definition.primaryField
      : "title";
  const fields = {
    id: {
      kind: "text",
      required: true
    }
  };

  for (const fieldDescriptor of definition.manifestFieldDescriptors) {
    fields[fieldDescriptor.id] = toSchemaFieldDescriptor(fieldDescriptor);
  }

  if (!fields[primaryFieldId]) {
    fields[primaryFieldId] = {
      kind: "text",
      required: true
    };
  } else {
    fields[primaryFieldId] = {
      ...fields[primaryFieldId],
      required: true
    };
  }

  return fields;
}

function buildCollectionSchemaTypeRegistry(createSchemaTypeRegistry, definitions) {
  if (typeof createSchemaTypeRegistry !== "function") {
    throw new Error("createSchemaTypeRegistry is required for generated collection handlers");
  }

  const registry = createSchemaTypeRegistry();
  for (const definition of definitions) {
    registry.register({
      contractVersion: 1,
      typeKey: definition.schemaTypeKey,
      fields: buildSchemaFieldsForDefinition(definition)
    });
  }

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
          message: firstError?.message ?? `Schema validation failed for '${typeKey}'`
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

function resolveConflictFieldId(error) {
  if (typeof error?.fieldId === "string" && error.fieldId.length > 0) {
    return error.fieldId;
  }
  if (typeof error?.field === "string" && error.field.length > 0) {
    return error.field;
  }
  return null;
}

function resolveConflictCode(error, fallbackCode) {
  return typeof error?.code === "string" && error.code.length > 0
    ? error.code
    : fallbackCode;
}

function resolveConflictMessage(error, fallbackMessage) {
  return typeof error?.message === "string" && error.message.length > 0
    ? error.message
    : fallbackMessage;
}

function appendConflictOptionalFields(conflict, error, fieldId) {
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
}

function toValidationConflict(error, index) {
  const fallbackCode = "MUTATION_VALIDATION_FAILED";
  const fallbackMessage = "Mutation validation failed";
  const fieldId = resolveConflictFieldId(error);
  const conflict = {
    order: index,
    code: resolveConflictCode(error, fallbackCode),
    message: resolveConflictMessage(error, fallbackMessage)
  };
  appendConflictOptionalFields(conflict, error, fieldId);
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
  fallbackCode,
  errorPayload
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
        payload:
          typeof errorPayload === "function"
            ? errorPayload(mutationError.code, mutationError.message)
            : {
                ok: false,
                error: {
                  code: mutationError.code,
                  message: mutationError.message
                },
                timestamp: new Date().toISOString()
              }
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
    payload:
      typeof errorPayload === "function"
        ? errorPayload(
            safeguard.code ?? "SAFEGUARD_CONFIRMATION_REQUIRED",
            safeguard.message ?? "Mutation requires safeguard confirmation"
          )
        : {
            ok: false,
            error: {
              code: safeguard.code ?? "SAFEGUARD_CONFIRMATION_REQUIRED",
              message: safeguard.message ?? "Mutation requires safeguard confirmation"
            },
            timestamp: new Date().toISOString()
          }
  };
}

export {
  buildCollectionSchemaTypeRegistry,
  createAllowSafeguard,
  createSchemaValidationStage,
  runMutationPipeline
};
