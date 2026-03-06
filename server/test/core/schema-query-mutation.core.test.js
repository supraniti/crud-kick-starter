import { describe, expect, test } from "vitest";
import {
  createMutationPipeline,
  createQueryPipeline,
  createSchemaTypeRegistry,
  DEFAULT_QUERY_STAGE_ORDER,
  validateTypeDefinition
} from "../../src/core/index.js";

describe("schema/type registry contract", () => {
  const articleType = {
    contractVersion: 1,
    typeKey: "article",
    fields: {
      title: {
        kind: "text",
        required: true
      },
      views: {
        kind: "number"
      },
      authorId: {
        kind: "ref",
        refType: "author"
      }
    }
  };

  test("accepts valid type definitions", () => {
    const result = validateTypeDefinition(articleType);

    expect(result.ok).toBe(true);
    expect(result.value.typeKey).toBe("article");
  });

  test("rejects invalid ref descriptors missing refType", () => {
    const result = validateTypeDefinition({
      ...articleType,
      fields: {
        ...articleType.fields,
        authorId: {
          kind: "ref"
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("SCHEMA_FIELD_DESCRIPTOR_INVALID");
  });

  test("validates item required-field and kind constraints", () => {
    const registry = createSchemaTypeRegistry();
    registry.register(articleType);

    const missingTitle = registry.validateItem("article", {
      views: 12
    });
    expect(missingTitle.ok).toBe(false);
    expect(missingTitle.errors[0].code).toBe("SCHEMA_ITEM_REQUIRED_FIELD_MISSING");

    const badViewsType = registry.validateItem("article", {
      title: "Post",
      views: "12"
    });
    expect(badViewsType.ok).toBe(false);
    expect(badViewsType.errors[0].code).toBe("SCHEMA_ITEM_FIELD_TYPE_MISMATCH");
  });
});

describe("query pipeline contract", () => {
  test("executes stages in deterministic order", async () => {
    const orderTrace = [];
    const pipeline = createQueryPipeline({
      stages: {
        project: (value) => {
          orderTrace.push("project");
          return value.map((item) => ({ id: item.id, score: item.score }));
        },
        sort: (value) => {
          orderTrace.push("sort");
          return [...value].sort((a, b) => a.score - b.score);
        },
        filter: (value) => {
          orderTrace.push("filter");
          return value.filter((item) => item.score >= 2);
        },
        slice: (value) => {
          orderTrace.push("slice");
          return value.slice(0, 2);
        },
        resolve: (value) => {
          orderTrace.push("resolve");
          return {
            ok: true,
            data: value.map((item) => ({ ...item, resolved: true })),
            meta: { count: value.length }
          };
        }
      }
    });

    const result = await pipeline.run([
      { id: "a", score: 2, ignored: 1 },
      { id: "b", score: 1, ignored: 1 },
      { id: "c", score: 3, ignored: 1 }
    ]);

    expect(result.ok).toBe(true);
    expect(result.executedStages).toEqual(DEFAULT_QUERY_STAGE_ORDER);
    expect(orderTrace).toEqual(DEFAULT_QUERY_STAGE_ORDER);
    expect(result.data[0].resolved).toBe(true);
    expect(result.stageMeta.resolve.count).toBe(2);
  });

  test("short-circuits on stage errors", async () => {
    const pipeline = createQueryPipeline({
      stages: {
        filter: () => {
          throw new Error("filter exploded");
        }
      }
    });

    const result = await pipeline.run([{ id: "a" }]);
    expect(result.ok).toBe(false);
    expect(result.stage).toBe("filter");
    expect(result.error.code).toBe("QUERY_PIPELINE_STAGE_ERROR");
    expect(result.executedStages).toEqual(["project", "sort"]);
  });
});

describe("mutation pipeline contract", () => {
  const baseInput = {
    action: "delete",
    entityType: "tag",
    entityId: "t-1",
    current: { id: "t-1", label: "Tag A" },
    next: { id: "t-1", label: "Tag A" }
  };

  test("returns validation-failed when validation stage reports errors", async () => {
    const pipeline = createMutationPipeline({
      hooks: {
        validateField: async () => ({
          ok: false,
          errors: [{ code: "FIELD_ERROR", message: "Invalid field" }]
        })
      }
    });

    const result = await pipeline.run(baseInput);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("validation-failed");
    expect(result.errors[0].code).toBe("FIELD_ERROR");
  });

  test("requires confirmation for dependent impacts", async () => {
    const pipeline = createMutationPipeline();
    const result = await pipeline.run({
      ...baseInput,
      impact: {
        dependentCount: 3,
        dependentIds: ["a", "b", "c"]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("confirmation-required");
    expect(result.safeguard.code).toBe("SAFEGUARD_CONFIRMATION_REQUIRED");
  });

  test("denies blocked hard-rule actions", async () => {
    const pipeline = createMutationPipeline();
    const result = await pipeline.run({
      ...baseInput,
      action: "drop-collection",
      impact: {
        dependentCount: 0,
        dependentIds: []
      }
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("denied");
    expect(result.safeguard.code).toBe("SAFEGUARD_DENY");
  });

  test("applies when validations pass and confirmation is provided", async () => {
    const pipeline = createMutationPipeline({
      hooks: {
        applyMutation: async (input) => ({
          ok: true,
          result: {
            ...input.next,
            persisted: true
          }
        })
      }
    });

    const result = await pipeline.run({
      ...baseInput,
      confirmed: true,
      impact: {
        dependentCount: 1,
        dependentIds: ["a-1"]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("applied");
    expect(result.result.persisted).toBe(true);
  });

  test("propagates apply mutation statusCode on failed result", async () => {
    const pipeline = createMutationPipeline({
      hooks: {
        applyMutation: async () => ({
          ok: false,
          error: {
            code: "RECORD_TITLE_CONFLICT",
            message: "Record title already exists",
            statusCode: 409
          }
        })
      }
    });

    const result = await pipeline.run(baseInput);
    expect(result.ok).toBe(false);
    expect(result.status).toBe("failed");
    expect(result.stage).toBe("applyMutation");
    expect(result.error.code).toBe("RECORD_TITLE_CONFLICT");
    expect(result.error.statusCode).toBe(409);
  });
});

