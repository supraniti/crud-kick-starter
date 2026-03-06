import {
  toReferenceMultiQueryKey
} from "../../../../core/shared/capability-contracts/reference-field-key-utils.js";

const DELETE_POLICY_RESTRICT = "restrict";
const DELETE_POLICY_NULLIFY = "nullify";
const DELETE_POLICY_IGNORE = "ignore";
const WORKSPACE_REFERENCE_OPTIONS_LIMIT = 200;

function hasOwn(input, key) {
  return Object.prototype.hasOwnProperty.call(input ?? {}, key);
}

function isRepositoryContract(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.readState === "function" &&
    typeof value.transact === "function"
  );
}

function rowsForCollection(state, collectionId) {
  return Array.isArray(state?.[collectionId]) ? state[collectionId] : [];
}

function normalizeDeletePolicyToken(value) {
  if (typeof value !== "string") {
    return DELETE_POLICY_IGNORE;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === DELETE_POLICY_RESTRICT || normalized === DELETE_POLICY_NULLIFY) {
    return normalized;
  }

  return DELETE_POLICY_IGNORE;
}

function isReferenceField(field) {
  const type = typeof field?.type === "string" ? field.type.trim().toLowerCase() : "";
  return type === "reference" || type === "reference-multi";
}

function fieldReferencesCollection(field, collectionId) {
  return (
    isReferenceField(field) &&
    typeof field?.collectionId === "string" &&
    field.collectionId === collectionId
  );
}

function fieldContainsReferenceToItem(field, row, itemId) {
  if (!isReferenceField(field) || !row || typeof row !== "object") {
    return false;
  }

  if (field.type === "reference-multi") {
    const values = Array.isArray(row[field.id]) ? row[field.id] : [];
    return values.includes(itemId);
  }

  return row[field.id] === itemId;
}

function buildReferenceFilterKey(field) {
  return field.type === "reference-multi" ? toReferenceMultiQueryKey(field.id) : field.id;
}

function createReferenceRouteActionDescriptor({
  referencingCollectionId,
  referencingCollectionLabel,
  referencingModuleId,
  field,
  targetItemId
}) {
  const filterKey = buildReferenceFilterKey(field);
  const filterValue = targetItemId;
  const routeModuleId =
    typeof referencingModuleId === "string" && referencingModuleId.length > 0
      ? referencingModuleId
      : referencingCollectionId;

  return {
    id: `show-referencing-${referencingCollectionId}-${field.id}`.toLowerCase(),
    label: `Show referencing ${referencingCollectionLabel ?? referencingCollectionId}`,
    type: "navigate",
    route: {
      moduleId: routeModuleId,
      state: {
        collectionId: referencingCollectionId,
        [filterKey]: filterValue
      }
    }
  };
}

function collectionNotFoundPayload(collectionId) {
  return {
    ok: false,
    error: {
      code: "COLLECTION_NOT_FOUND",
      message: `Collection '${collectionId}' was not found`
    },
    timestamp: new Date().toISOString()
  };
}

function itemNotFoundPayload(collectionId, itemId) {
  return {
    ok: false,
    error: {
      code: "ITEM_NOT_FOUND",
      message: `Item '${itemId}' was not found in collection '${collectionId}'`
    },
    timestamp: new Date().toISOString()
  };
}

function collectionPersistenceFailedPayload(collectionId, action, error) {
  return {
    ok: false,
    error: {
      code: error?.code ?? "REFERENCE_STATE_PERSISTENCE_FAILED",
      message:
        error?.message ??
        `Collection '${collectionId}' ${action} persistence failed`
    },
    timestamp: new Date().toISOString()
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
        : "COLLECTION_VALIDATION_FAILED",
    message:
      typeof error?.message === "string" && error.message.length > 0
        ? error.message
        : "Collection validation failed"
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

function badRequestWithConflicts(reply, errors = [], fallbackCode = "COLLECTION_VALIDATION_FAILED") {
  reply.code(400);
  const conflicts = Array.isArray(errors)
    ? errors.map((error, index) => toValidationConflict(error, index))
    : [];
  const firstConflict = conflicts[0] ?? {
    code: fallbackCode,
    message: "Collection validation failed"
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

function deleteRestrictedPayload(collectionId, itemId, restrictDependencies = []) {
  const referenceCount = restrictDependencies.reduce(
    (count, entry) => count + (entry.referenceCount ?? 0),
    0
  );
  const actions = [
    ...new Map(
      restrictDependencies
        .map((entry) => entry.action)
        .filter((entry) => entry && typeof entry === "object")
        .map((action) => [action.id, action])
    ).values()
  ];

  return {
    ok: false,
    error: {
      code: "REFERENCE_DELETE_RESTRICTED",
      message: `Cannot delete '${itemId}' from '${collectionId}' because ${referenceCount} referencing item(s) still point to it`,
      impact: {
        referenceCount,
        dependencies: restrictDependencies.map((entry) => ({
          referencingCollectionId: entry.referencingCollectionId,
          referencingCollectionLabel: entry.referencingCollectionLabel,
          referencingModuleId: entry.referencingModuleId,
          fieldId: entry.field.id,
          fieldType: entry.field.type,
          policy: entry.policy,
          referenceCount: entry.referenceCount,
          referencingItemIds: entry.referencingItemIds
        }))
      },
      actions
    },
    timestamp: new Date().toISOString()
  };
}

export {
  DELETE_POLICY_IGNORE,
  DELETE_POLICY_NULLIFY,
  DELETE_POLICY_RESTRICT,
  WORKSPACE_REFERENCE_OPTIONS_LIMIT,
  badRequestWithConflicts,
  collectionNotFoundPayload,
  collectionPersistenceFailedPayload,
  createReferenceRouteActionDescriptor,
  deleteRestrictedPayload,
  fieldContainsReferenceToItem,
  fieldReferencesCollection,
  hasOwn,
  isReferenceField,
  isRepositoryContract,
  itemNotFoundPayload,
  normalizeDeletePolicyToken,
  rowsForCollection
};
