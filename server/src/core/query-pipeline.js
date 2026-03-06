export const DEFAULT_QUERY_STAGE_ORDER = [
  "project",
  "sort",
  "filter",
  "slice",
  "resolve"
];

function pipelineError(stage, code, message, executedStages) {
  return {
    ok: false,
    stage,
    error: {
      code,
      message
    },
    executedStages
  };
}

function normalizeStageOutput(output, previousData) {
  if (output === undefined) {
    return {
      ok: true,
      data: previousData,
      meta: null
    };
  }

  if (output && typeof output === "object" && Object.hasOwn(output, "ok")) {
    if (output.ok !== true) {
      return {
        ok: false
      };
    }

    return {
      ok: true,
      data: output.data,
      meta: output.meta ?? null
    };
  }

  return {
    ok: true,
    data: output,
    meta: null
  };
}

export function createQueryPipeline(options = {}) {
  const order = options.order ?? DEFAULT_QUERY_STAGE_ORDER;
  const stageOverrides = options.stages ?? {};

  return {
    async run(input, context = {}) {
      let data = input;
      const executedStages = [];
      const stageMeta = {};

      for (const stageName of order) {
        if (!DEFAULT_QUERY_STAGE_ORDER.includes(stageName)) {
          return pipelineError(
            stageName,
            "QUERY_PIPELINE_STAGE_UNKNOWN",
            `Unknown query pipeline stage '${stageName}'`,
            [...executedStages]
          );
        }

        const stage = stageOverrides[stageName] ?? ((value) => value);

        let output;
        try {
          output = await stage(data, {
            ...context,
            stage: stageName,
            executedStages: [...executedStages]
          });
        } catch (error) {
          return pipelineError(
            stageName,
            "QUERY_PIPELINE_STAGE_ERROR",
            error?.message ?? "Query stage execution failed",
            [...executedStages]
          );
        }

        const normalized = normalizeStageOutput(output, data);
        if (!normalized.ok) {
          return pipelineError(
            stageName,
            "QUERY_PIPELINE_STAGE_OUTPUT_INVALID",
            `Stage '${stageName}' returned invalid output`,
            [...executedStages]
          );
        }

        data = normalized.data;
        if (normalized.meta !== null) {
          stageMeta[stageName] = normalized.meta;
        }
        executedStages.push(stageName);
      }

      return {
        ok: true,
        data,
        executedStages,
        stageMeta
      };
    }
  };
}
