import { cloneFieldValue } from "./field-value-normalizers.mjs";
import {
  createAllowSafeguard,
  createSchemaValidationStage,
  runMutationPipeline
} from "./mutation-runtime-helpers.mjs";
import {
  createReferenceLookup,
  parseCollectionQuery,
  resolveCollectionRow
} from "./query-and-reference-helpers.mjs";
import {
  codeFor,
  codeForField,
  hasTitleConflict,
  validateCollectionCrossField,
  validateCollectionInput,
  validateReferenceFieldConflicts
} from "./input-validation-helpers.mjs";
import {
  applyComputedFields,
  toCreateNext,
  toUpdateNext
} from "./state-and-item-helpers.mjs";
import { errorPayload } from "./handler-runtime-helpers.mjs";
import {
  readPrimaryFieldValue,
  readPrimaryFieldValueForSearch,
  resolvePrimaryFieldConflictCode,
  resolvePrimaryFieldId
} from "./collection-handler-primary-field-helpers.mjs";
function createReferenceLookupWithState({
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  workingState,
  primaryFieldByCollection = null
}) {
  return createReferenceLookup({
    referenceState: state,
    resolveCollectionRepository,
    resolveProviderValidationRows,
    workingState,
    ...(primaryFieldByCollection ? { primaryFieldByCollection } : {})
  });
}
function createCollectionMutationValidationHooks({
  schemaTypeRegistry,
  definition,
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  workingState
}) {
  return {
    validateField: createSchemaValidationStage({
      schemaTypeRegistry,
      typeKey: definition.schemaTypeKey,
      errorCode: codeFor(definition, "SCHEMA_VALIDATION_FAILED")
    }),
    validateItem: async (input) => {
      const crossFieldError = validateCollectionCrossField(input.next, definition);
      if (crossFieldError) {
        return {
          ok: false,
          errors: [crossFieldError]
        };
      }

      const referenceConflicts = await validateReferenceFieldConflicts(
        createReferenceLookupWithState({
          state,
          resolveCollectionRepository,
          resolveProviderValidationRows,
          workingState
        }),
        input.next,
        definition
      );
      if (referenceConflicts.length > 0) {
        return {
          ok: false,
          errors: referenceConflicts
        };
      }

      return {
        ok: true
      };
    },
    evaluateSafeguard: async (safeguardInput) => createAllowSafeguard(safeguardInput)
  };
}
function applyCreateCollectionMutation({ definition, workingState, input }) {
  const primaryFieldValue = readPrimaryFieldValue(input.next, definition);
  if (
    definition.behavior.enforcePrimaryFieldUnique &&
    hasTitleConflict(workingState, definition, primaryFieldValue)
  ) {
    const primaryFieldId = resolvePrimaryFieldId(definition);
    return {
      ok: false,
      error: {
        code: resolvePrimaryFieldConflictCode(definition),
        message: `${definition.entityTitle} ${primaryFieldId} '${primaryFieldValue}' already exists`,
        statusCode: 409
      }
    };
  }

  const item = {
    ...input.next
  };
  for (const fieldDescriptor of definition.mutableFieldDescriptors) {
    item[fieldDescriptor.id] = cloneFieldValue(
      fieldDescriptor,
      input.next[fieldDescriptor.id]
    );
  }
  workingState[definition.stateKey].push(item);

  return {
    ok: true,
    result: item
  };
}
function applyUpdateCollectionMutation({ definition, workingState, runtimeContext, input }) {
  const primaryFieldValue = readPrimaryFieldValue(input.next, definition);
  if (
    definition.behavior.enforcePrimaryFieldUnique &&
    hasTitleConflict(workingState, definition, primaryFieldValue, input.current.id)
  ) {
    const primaryFieldId = resolvePrimaryFieldId(definition);
    return {
      ok: false,
      error: {
        code: resolvePrimaryFieldConflictCode(definition),
        message: `${definition.entityTitle} ${primaryFieldId} '${primaryFieldValue}' already exists`,
        statusCode: 409
      }
    };
  }

  const item = input.current;
  for (const fieldDescriptor of definition.mutableFieldDescriptors) {
    item[fieldDescriptor.id] = cloneFieldValue(
      fieldDescriptor,
      input.next[fieldDescriptor.id]
    );
  }
  applyComputedFields(item, definition, runtimeContext);

  return {
    ok: true,
    result: item
  };
}
function createCollectionCreatePipeline({
  createMutationPipeline,
  schemaTypeRegistry,
  definition,
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  workingState
}) {
  const validationHooks = createCollectionMutationValidationHooks({
    schemaTypeRegistry,
    definition,
    state,
    resolveCollectionRepository,
    resolveProviderValidationRows,
    workingState
  });

  return createMutationPipeline({
    hooks: {
      ...validationHooks,
      applyMutation: async (input) => applyCreateCollectionMutation({
        definition,
        workingState,
        input
      })
    }
  });
}
function createCollectionUpdatePipeline({
  createMutationPipeline,
  schemaTypeRegistry,
  definition,
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  workingState,
  runtimeContext
}) {
  const validationHooks = createCollectionMutationValidationHooks({
    schemaTypeRegistry,
    definition,
    state,
    resolveCollectionRepository,
    resolveProviderValidationRows,
    workingState
  });

  return createMutationPipeline({
    hooks: {
      ...validationHooks,
      applyMutation: async (input) => applyUpdateCollectionMutation({
        definition,
        workingState,
        runtimeContext,
        input
      })
    }
  });
}
function createUnsupportedFilterError(unsupportedFilter, definition) {
  const fieldDescriptor = unsupportedFilter.fieldDescriptor ?? {};
  const fieldId =
    typeof fieldDescriptor.id === "string" && fieldDescriptor.id.length > 0
      ? fieldDescriptor.id
      : null;
  const codeSuffix =
    typeof unsupportedFilter.codeSuffix === "string" && unsupportedFilter.codeSuffix.length > 0
      ? unsupportedFilter.codeSuffix
      : "FILTER_UNSUPPORTED";
  const message =
    typeof unsupportedFilter.message === "string" && unsupportedFilter.message.length > 0
      ? unsupportedFilter.message
      : fieldId
        ? `Field '${fieldId}' does not support filtering`
        : "Filter is not supported";

  return {
    code: fieldId ? codeForField(definition, fieldId, codeSuffix) : codeFor(definition, codeSuffix),
    message,
    ...(fieldId ? { fieldId } : {}),
    ...(typeof fieldDescriptor.type === "string" ? { fieldType: fieldDescriptor.type } : {})
  };
}
function validateCollectionQueryInput(query = {}, definition) {
  const parsed = parseCollectionQuery(query, definition);
  if (!Array.isArray(parsed.unsupportedFieldFilters) || parsed.unsupportedFieldFilters.length === 0) {
    return {
      ok: true,
      parsed
    };
  }

  return {
    ok: false,
    parsed,
    errors: parsed.unsupportedFieldFilters.map((unsupportedFilter) =>
      createUnsupportedFilterError(unsupportedFilter, definition)
    )
  };
}
function matchesCollectionFilterValue(activeFilter, itemValue) {
  if (
    activeFilter.fieldDescriptor.type === "enum-multi" ||
    activeFilter.fieldDescriptor.type === "reference-multi"
  ) {
    return (
      Array.isArray(itemValue) &&
      activeFilter.value.every((value) => itemValue.includes(value))
    );
  }

  if (activeFilter.fieldDescriptor.type === "text" && typeof itemValue === "string") {
    return itemValue.toLowerCase() === activeFilter.value;
  }

  return itemValue === activeFilter.value;
}
function matchesCollectionQuery(item, parsed, definition) {
  for (const activeFilter of parsed.activeFieldFilters) {
    const fieldId = activeFilter.fieldDescriptor.id;
    const itemValue = item?.[fieldId];
    if (!matchesCollectionFilterValue(activeFilter, itemValue)) {
      return false;
    }
  }

  if (parsed.search && !readPrimaryFieldValueForSearch(item, definition).includes(parsed.search)) {
    return false;
  }

  return true;
}
function compareCollectionRows(left, right, definition) {
  const leftPrimary = readPrimaryFieldValue(left, definition);
  const rightPrimary = readPrimaryFieldValue(right, definition);
  if (leftPrimary !== rightPrimary) {
    return leftPrimary.localeCompare(rightPrimary);
  }

  const leftId = typeof left?.id === "string" ? left.id : "", rightId = typeof right?.id === "string" ? right.id : "";
  return leftId.localeCompare(rightId);
}
function filterAndSortCollectionRows(workingState, parsed, definition) {
  return [...workingState[definition.stateKey]]
    .filter((item) => matchesCollectionQuery(item, parsed, definition))
    .sort((left, right) => compareCollectionRows(left, right, definition));
}
function createValidateQueryHandler(definition) {
  return (query) => {
    const queryValidation = validateCollectionQueryInput(query, definition);
    if (!queryValidation.ok) {
      return {
        ok: false,
        errors: queryValidation.errors
      };
    }

    return {
      ok: true
    };
  };
}
function createListHandler({
  definition,
  repository,
  readWorkingState,
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  primaryFieldByCollection
}) {
  return async (query) => {
    const workingState = await readWorkingState(repository);
    const queryValidation = validateCollectionQueryInput(query, definition);
    const parsed = queryValidation.parsed;
    const filtered = filterAndSortCollectionRows(workingState, parsed, definition);

    const referenceLookup = createReferenceLookupWithState({
      state,
      resolveCollectionRepository,
      resolveProviderValidationRows,
      workingState,
      primaryFieldByCollection
    });
    const items = filtered
      .slice(parsed.offset, parsed.offset + parsed.limit)
      .map((item) => resolveCollectionRow(item, definition, referenceLookup));

    return {
      items: await Promise.all(items),
      meta: {
        total: filtered.length,
        offset: parsed.offset,
        limit: parsed.limit
      },
      filters: parsed.filters
    };
  };
}
function createFindByIdHandler({ definition, repository, readWorkingState }) {
  return async (itemId) => {
    const workingState = await readWorkingState(repository);
    return workingState[definition.stateKey].find((item) => item.id === itemId) ?? null;
  };
}
function createResolveRowHandler({
  definition,
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  primaryFieldByCollection
}) {
  const referenceLookup = createReferenceLookupWithState({
    state,
    resolveCollectionRepository,
    resolveProviderValidationRows,
    primaryFieldByCollection
  });

  return async (item) => resolveCollectionRow(item, definition, referenceLookup);
}
function createValidateInputHandler({
  definition,
  repository,
  readWorkingState,
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows
}) {
  return async (input, options) => {
    const validation = validateCollectionInput(input, definition, options);
    const workingState = await readWorkingState(repository);
    const referenceConflicts = await validateReferenceFieldConflicts(
      createReferenceLookupWithState({
        state,
        resolveCollectionRepository,
        resolveProviderValidationRows,
        workingState
      }),
      validation.value,
      definition
    );
    const errors = [...validation.errors, ...referenceConflicts];
    return {
      ok: errors.length === 0,
      value: validation.value,
      errors
    };
  };
}
function createCreateHandler({
  definition,
  repository,
  mutateWorkingState,
  createMutationPipeline,
  schemaTypeRegistry,
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  badRequest
}) {
  return ({ value, reply }) =>
    mutateWorkingState(repository, async (workingState, runtimeContext) => {
      const next = toCreateNext(workingState, definition, value, runtimeContext);
      const result = await runMutationPipeline({
        pipeline: createCollectionCreatePipeline({
          createMutationPipeline,
          schemaTypeRegistry,
          definition,
          state,
          resolveCollectionRepository,
          resolveProviderValidationRows,
          workingState
        }),
        input: {
          action: "create",
          entityType: definition.entitySingular,
          entityId: next.id,
          current: null,
          next
        },
        reply,
        badRequest,
        fallbackCode: codeFor(definition, "MUTATION_FAILED"),
        errorPayload
      });

      return {
        commit: result.ok,
        value: result
      };
    });
}
function createUpdateHandler({
  definition,
  repository,
  mutateWorkingState,
  createMutationPipeline,
  schemaTypeRegistry,
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  badRequest
}) {
  return ({ body, value, item, reply }) =>
    mutateWorkingState(repository, async (workingState, runtimeContext) => {
      const currentItem =
        workingState[definition.stateKey].find((entry) => entry.id === item?.id) ?? null;
      if (!currentItem) {
        return {
          commit: false,
          value: {
            ok: false,
            statusCode: 404,
            payload: errorPayload(
              "ITEM_NOT_FOUND",
              `Item '${item?.id ?? "unknown"}' was not found in collection '${definition.collectionId}'`
            )
          }
        };
      }

      const next = toUpdateNext(
        currentItem,
        body,
        value,
        definition,
        runtimeContext
      );
      const result = await runMutationPipeline({
        pipeline: createCollectionUpdatePipeline({
          createMutationPipeline,
          schemaTypeRegistry,
          definition,
          state,
          resolveCollectionRepository,
          resolveProviderValidationRows,
          workingState,
          runtimeContext
        }),
        input: {
          action: "update",
          entityType: definition.entitySingular,
          entityId: currentItem.id,
          current: currentItem,
          next
        },
        reply,
        badRequest,
        fallbackCode: codeFor(definition, "MUTATION_FAILED"),
        errorPayload
      });

      return {
        commit: result.ok,
        value: result
      };
    });
}
function createFindIndexHandler({ definition, repository, readWorkingState }) {
  return async (itemId) => {
    const workingState = await readWorkingState(repository);
    return workingState[definition.stateKey].findIndex((item) => item.id === itemId);
  };
}
function createRemoveByIndexHandler({ definition, repository, mutateWorkingState }) {
  return (_, itemId) =>
    mutateWorkingState(repository, async (workingState) => {
      const index = workingState[definition.stateKey].findIndex((item) => item.id === itemId);
      if (index < 0) {
        return {
          commit: false,
          value: null
        };
      }

      workingState[definition.stateKey].splice(index, 1);
      return {
        commit: true,
        value: null
      };
    });
}
function createGeneratedCollectionHandler({
  definition,
  repository,
  readWorkingState,
  mutateWorkingState,
  createMutationPipeline,
  schemaTypeRegistry,
  state,
  resolveCollectionRepository,
  resolveProviderValidationRows,
  primaryFieldByCollection,
  badRequest
}) {
  return {
    validateQuery: createValidateQueryHandler(definition),
    list: createListHandler({
      definition,
      repository,
      readWorkingState,
      state,
      resolveCollectionRepository,
      resolveProviderValidationRows,
      primaryFieldByCollection
    }),
    findById: createFindByIdHandler({
      definition,
      repository,
      readWorkingState
    }),
    resolveRow: createResolveRowHandler({
      definition,
      state,
      resolveCollectionRepository,
      resolveProviderValidationRows,
      primaryFieldByCollection
    }),
    validateInput: createValidateInputHandler({
      definition,
      repository,
      readWorkingState,
      state,
      resolveCollectionRepository,
      resolveProviderValidationRows
    }),
    hasAnyMutableField: (body) =>
      definition.mutableFieldList.some((fieldName) => body[fieldName] !== undefined),
    emptyUpdateCode: codeFor(definition, "UPDATE_EMPTY"),
    create: createCreateHandler({
      definition,
      repository,
      mutateWorkingState,
      createMutationPipeline,
      schemaTypeRegistry,
      state,
      resolveCollectionRepository,
      resolveProviderValidationRows,
      badRequest
    }),
    update: createUpdateHandler({
      definition,
      repository,
      mutateWorkingState,
      createMutationPipeline,
      schemaTypeRegistry,
      state,
      resolveCollectionRepository,
      resolveProviderValidationRows,
      badRequest
    }),
    findIndex: createFindIndexHandler({
      definition,
      repository,
      readWorkingState
    }),
    removeByIndex: createRemoveByIndexHandler({
      definition,
      repository,
      mutateWorkingState
    })
  };
}

export { createGeneratedCollectionHandler, resolvePrimaryFieldId };
