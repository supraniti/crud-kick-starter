import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { request, spec } from "pactum";
import { buildServer } from "../../src/app.js";

function createDockerUnavailableContainerManager() {
  function unavailablePayload(operation, id) {
    return {
      ok: false,
      operation,
      container: {
        id,
        label: "Mock Container",
        dockerName: `mock-${id}`,
        tags: ["mock"]
      },
      engine: {
        available: false,
        error: {
          code: "DOCKER_ENGINE_ERROR",
          message: "Docker is not available"
        }
      },
      error: {
        code: "DOCKER_UNAVAILABLE",
        message: "Docker engine is not available"
      },
      timestamp: new Date().toISOString()
    };
  }

  return {
    async status(id) {
      return unavailablePayload("status", id);
    },
    async start(id) {
      return unavailablePayload("start", id);
    },
    async stop(id) {
      return unavailablePayload("stop", id);
    },
    async restart(id) {
      return unavailablePayload("restart", id);
    }
  };
}

let server;

beforeAll(async () => {
  server = buildServer({
    logger: false,
    containerManager: createDockerUnavailableContainerManager()
  });

  await server.listen({
    host: "127.0.0.1",
    port: 0
  });

  const address = server.server.address();
  request.setBaseUrl(`http://127.0.0.1:${address.port}`);
});

afterAll(async () => {
  await server.close();
});

describe("degraded docker-unavailable behavior", () => {
  test("GET container status returns 503 with explicit error code", async () => {
    const response = await spec()
      .get("/api/infra/containers/mongo/status")
      .expectStatus(503);

    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe("DOCKER_UNAVAILABLE");
  });

  test("POST container start returns 503 with explicit error code", async () => {
    const response = await spec()
      .post("/api/infra/containers/mongo/start")
      .expectStatus(503);

    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe("DOCKER_UNAVAILABLE");
    expect(response.body.operation).toBe("start");
  });

  test("GET mongo check returns docker-unavailable structured status", async () => {
    const response = await spec().get("/api/infra/mongo/check").expectStatus(503);

    expect(response.body.ok).toBe(false);
    expect(response.body.status).toBe("docker-unavailable");
    expect(response.body.connectivity.attempted).toBe(false);
    expect(response.body.connectivity.error.code).toBe("DOCKER_UNAVAILABLE");
  });
});
