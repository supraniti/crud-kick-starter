import { evaluateSafeguard as defaultEvaluateSafeguard } from "./safeguard-evaluator.js";

function validationError(code, message, field = null) {
  return {
    code,
    message,
    field
  };
}

function normalizeValidationResult(result, fallbackCode, fallbackMessage) {
  if (result === undefined || result === null) {
    return {
      ok: true,
      errors: []
    };
  }

  if (result.ok === true) {
    return {
      ok: true,
      errors: []
    };
  }

  if (result.ok === false) {
    return {
      ok: false,
      errors: Array.isArray(result.errors)
        ? result.errors
        : [validationError(fallbackCode, fallbackMessage)]
    };
  }

  return {
    ok: false,
    errors: [
      validationError(
        "MUTATION_PIPELINE_STAGE_OUTPUT_INVALID",
        "Validation stage returned invalid output"
      )
    ]
  };
}

function inputValidation(input) {
  const errors = [];

  if (!input || typeof input !== "object") {
    errors.push(validationError("MUTATION_INPUT_INVALID", "Mutation input must be an object"));
    return errors;
  }

  if (typeof input.action !== "string" || input.action.length === 0) {
    errors.push(validationError("MUTATION_INPUT_INVALID", "action is required", "action"));
  }

  if (typeof input.entityType !== "string" || input.entityType.length === 0) {
    errors.push(
      validationError("MUTATION_INPUT_INVALID", "entityType is required", "entityType")
    );
  }

  if (typeof input.entityId !== "string" || input.entityId.length === 0) {
    errors.push(validationError("MUTATION_INPUT_INVALID", "entityId is required", "entityId"));
  }

  return errors;
}

function createPipelineHooks(options = {}) {
  const hooks = options.hooks ?? {};
  return {
    validateField: hooks.validateField ?? (async () => ({ ok: true })),
    validateItem: hooks.validateItem ?? (async () => ({ ok: true })),
    validateCollection: hooks.validateCollection ?? (async () => ({ ok: true })),
    evaluateSafeguard: hooks.evaluateSafeguard ?? defaultEvaluateSafeguard,
    applyMutation: hooks.applyMutation ?? (async (input) => ({ ok: true, result: input.next }))
  };
}

function buildValidationStages(hooks) {
  return [
    {
      name: "validateField",
      handler: hooks.validateField,
      fallbackCode: "MUTATION_VALIDATE_FIELD_FAILED",
      fallbackMessage: "Field validation failed"
    },
    {
      name: "validateItem",
      handler: hooks.validateItem,
      fallbackCode: "MUTATION_VALIDATE_ITEM_FAILED",
      fallbackMessage: "Item validation failed"
    },
    {
      name: "validateCollection",
      handler: hooks.validateCollection,
      fallbackCode: "MUTATION_VALIDATE_COLLECTION_FAILED",
      fallbackMessage: "Collection validation failed"
    }
  ];
}

function createStageFailure(stage, error, fallbackMessage) {
  return {
    ok: false,
    status: "failed",
    stage,
    error: {
      code: "MUTATION_PIPELINE_STAGE_ERROR",
      message: error?.message ?? fallbackMessage
    }
  };
}

async function executeStage(handler, input, context, stageName, fallbackMessage) {
  try {
    return {
      ok: true,
      value: await handler(input, context)
    };
  } catch (error) {
    return {
      ok: false,
      value: createStageFailure(stageName, error, fallbackMessage)
    };
  }
}

async function executeValidationStages(stages, input, context, errors) {
  for (const stage of stages) {
    const stageExecution = await executeStage(
      stage.handler,
      input,
      context,
      stage.name,
      "Mutation stage execution failed"
    );
    if (!stageExecution.ok) {
      return stageExecution.value;
    }

    const normalized = normalizeValidationResult(
      stageExecution.value,
      stage.fallbackCode,
      stage.fallbackMessage
    );
    if (!normalized.ok) {
      errors.push(...normalized.errors);
    }
  }

  return null;
}

function buildSafeguardInput(input) {
  return (
    input.safeguardInput ?? {
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      impact: input.impact ?? {
        dependentCount: 0,
        dependentIds: []
      }
    }
  );
}

async function evaluatePipelineSafeguard(evaluateSafeguard, input, context) {
  return executeStage(
    evaluateSafeguard,
    buildSafeguardInput(input),
    context,
    "evaluateSafeguard",
    "Safeguard stage failed"
  );
}

function resolveApplyMutationFailure(applyResult, safeguard) {
  return {
    ok: false,
    status: "failed",
    stage: "applyMutation",
    error: {
      code: applyResult.error?.code ?? "MUTATION_APPLY_FAILED",
      message: applyResult.error?.message ?? "Mutation apply failed",
      ...(typeof applyResult.error?.statusCode === "number"
        ? {
            statusCode: applyResult.error.statusCode
          }
        : {})
    },
    safeguard
  };
}

async function executeApplyMutation(applyMutation, input, context, safeguard) {
  const stageExecution = await executeStage(
    applyMutation,
    input,
    context,
    "applyMutation",
    "Apply stage failed"
  );
  if (!stageExecution.ok) {
    return {
      ok: false,
      value: stageExecution.value
    };
  }

  const applyResult = stageExecution.value;
  if (applyResult?.ok === false) {
    return {
      ok: false,
      value: resolveApplyMutationFailure(applyResult, safeguard)
    };
  }

  return {
    ok: true,
    value: applyResult
  };
}

function createMutationPipelineRunner(hooks) {
  const validationStages = buildValidationStages(hooks);

  return async function run(input, context = {}) {
    const errors = inputValidation(input);
    if (errors.length > 0) {
      return {
        ok: false,
        status: "validation-failed",
        errors
      };
    }

    const validationStageFailure = await executeValidationStages(
      validationStages,
      input,
      context,
      errors
    );
    if (validationStageFailure) {
      return validationStageFailure;
    }

    if (errors.length > 0) {
      return {
        ok: false,
        status: "validation-failed",
        errors
      };
    }

    const safeguardEvaluation = await evaluatePipelineSafeguard(
      hooks.evaluateSafeguard,
      input,
      context
    );
    if (!safeguardEvaluation.ok) {
      return safeguardEvaluation.value;
    }

    const safeguard = safeguardEvaluation.value;
    if (safeguard?.decision === "deny") {
      return {
        ok: false,
        status: "denied",
        safeguard
      };
    }

    if (safeguard?.decision === "require-confirmation" && !input.confirmed) {
      return {
        ok: false,
        status: "confirmation-required",
        safeguard
      };
    }

    const applyMutationResult = await executeApplyMutation(
      hooks.applyMutation,
      input,
      context,
      safeguard
    );
    if (!applyMutationResult.ok) {
      return applyMutationResult.value;
    }

    return {
      ok: true,
      status: "applied",
      result: applyMutationResult.value?.result ?? applyMutationResult.value ?? input.next,
      safeguard
    };
  };
}

export function createMutationPipeline(options = {}) {
  const hooks = createPipelineHooks(options);

  return {
    run: createMutationPipelineRunner(hooks)
  };
}
