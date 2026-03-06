import { describe, expect, test } from "vitest";
import { createDockerControlAdapter, evaluateSafeguard } from "../../src/core/index.js";

describe("safeguard contract evaluator", () => {
  test("returns allow for zero dependencies", () => {
    const result = evaluateSafeguard({
      action: "delete",
      entityType: "tag",
      entityId: "t-1",
      impact: {
        dependentCount: 0,
        dependentIds: []
      }
    });

    expect(result.ok).toBe(true);
    expect(result.decision).toBe("allow");
    expect(result.code).toBe("SAFEGUARD_ALLOW");
  });

  test("returns require-confirmation when dependencies exist", () => {
    const result = evaluateSafeguard({
      action: "delete",
      entityType: "tag",
      entityId: "t-1",
      impact: {
        dependentCount: 2,
        dependentIds: ["a-1", "a-2"]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.decision).toBe("require-confirmation");
    expect(result.code).toBe("SAFEGUARD_CONFIRMATION_REQUIRED");
  });

  test("returns deny for blocked hard-rule actions", () => {
    const result = evaluateSafeguard({
      action: "drop-collection",
      entityType: "type",
      entityId: "articles",
      impact: {
        dependentCount: 9,
        dependentIds: ["1"]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.decision).toBe("deny");
    expect(result.code).toBe("SAFEGUARD_DENY");
  });

  test("returns structured invalid-input payload", () => {
    const result = evaluateSafeguard({});

    expect(result.ok).toBe(false);
    expect(result.decision).toBe("deny");
    expect(result.code).toBe("SAFEGUARD_INPUT_INVALID");
  });
});

describe("docker control adapter boundary", () => {
  test("normalizes success payloads", async () => {
    const adapter = createDockerControlAdapter({
      containerManager: {
        async status() {
          return {
            ok: true,
            operation: "status",
            container: {
              id: "mongo",
              dockerName: "crud-control-mongo"
            },
            engine: {
              available: true
            },
            status: {
              running: false
            },
            timestamp: "2026-02-11T00:00:00.000Z"
          };
        },
        async start() {
          throw new Error("unused");
        },
        async stop() {
          throw new Error("unused");
        },
        async restart() {
          throw new Error("unused");
        }
      }
    });

    const payload = await adapter.status("mongo");
    expect(payload.ok).toBe(true);
    expect(payload.operation).toBe("status");
    expect(payload.container.id).toBe("mongo");
    expect(payload.engine.available).toBe(true);
  });

  test("normalizes thrown errors into structured failure payload", async () => {
    const adapter = createDockerControlAdapter({
      containerManager: {
        async status() {
          const error = new Error("Unknown container id: unknown");
          error.code = "UNKNOWN_CONTAINER_ID";
          throw error;
        },
        async start() {
          throw new Error("unused");
        },
        async stop() {
          throw new Error("unused");
        },
        async restart() {
          throw new Error("unused");
        }
      }
    });

    const payload = await adapter.status("unknown");
    expect(payload.ok).toBe(false);
    expect(payload.operation).toBe("status");
    expect(payload.error.code).toBe("UNKNOWN_CONTAINER_ID");
  });
});

