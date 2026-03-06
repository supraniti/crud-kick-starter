import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { request, spec } from "pactum";
import { buildServer } from "../../src/app.js";

function createMockContainerManager() {
  const baseContainer = {
    id: "mongo",
    label: "MongoDB",
    dockerName: "crud-control-mongo",
    tags: ["database", "mongo"]
  };

  function payload(operation, state) {
    return {
      ok: true,
      operation,
      container: baseContainer,
      engine: {
        available: true
      },
      status: state,
      timestamp: new Date().toISOString()
    };
  }

  return {
    async status(id) {
      if (id !== "mongo") {
        const error = new Error(`Unknown container id: ${id}`);
        error.code = "UNKNOWN_CONTAINER_ID";
        error.statusCode = 404;
        throw error;
      }

      return payload("status", {
        exists: true,
        running: false,
        state: "exited",
        statusText: "exited"
      });
    },
    async start(id) {
      if (id !== "mongo") {
        return this.status(id);
      }

      return payload("start", {
        exists: true,
        running: true,
        state: "running",
        statusText: "running"
      });
    },
    async stop(id) {
      if (id !== "mongo") {
        return this.status(id);
      }

      return payload("stop", {
        exists: true,
        running: false,
        state: "exited",
        statusText: "exited"
      });
    },
    async restart(id) {
      if (id !== "mongo") {
        return this.status(id);
      }

      return payload("restart", {
        exists: true,
        running: true,
        state: "running",
        statusText: "running"
      });
    }
  };
}

let server;

beforeAll(async () => {
  server = buildServer({
    logger: false,
    containerManager: createMockContainerManager()
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

describe("system contract endpoints", () => {
  test("GET /health returns structured payload", async () => {
    const response = await spec().get("/health").expectStatus(200);
    const body = response.body;

    expect(body.ok).toBe(true);
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("crud-control-server");
    expect(typeof body.uptimeSeconds).toBe("number");
    expect(typeof body.timestamp).toBe("string");
  });

  test("GET /ready returns structured readiness payload", async () => {
    const response = await spec().get("/ready").expectStatus(200);
    const body = response.body;

    expect(body.ok).toBe(true);
    expect(body.status).toBe("ready");
    expect(body.checks.server.status).toBe("up");
    expect(body.checks.docker.status).toBe("available");
    expect(typeof body.timestamp).toBe("string");
  });

  test("GET /api/system/ping returns pong payload", async () => {
    const response = await spec().get("/api/system/ping").expectStatus(200);
    const body = response.body;

    expect(body.ok).toBe(true);
    expect(body.ping).toBe("pong");
    expect(typeof body.timestamp).toBe("string");
  });
});

describe("infra contract endpoints", () => {
  test("GET /api/infra/containers/:id/status returns structured container state", async () => {
    const response = await spec()
      .get("/api/infra/containers/mongo/status")
      .expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.operation).toBe("status");
    expect(response.body.container.id).toBe("mongo");
    expect(response.body.engine.available).toBe(true);
    expect(response.body.status.state).toBe("exited");
  });

  test("GET /api/infra/containers/:id/status returns 404 for unknown ids", async () => {
    const response = await spec()
      .get("/api/infra/containers/unknown/status")
      .expectStatus(404);

    expect(response.body.ok).toBe(false);
    expect(response.body.error.code).toBe("UNKNOWN_CONTAINER_ID");
  });

  test("GET /api/infra/mongo/check returns structured non-running status", async () => {
    const response = await spec().get("/api/infra/mongo/check").expectStatus(200);

    expect(response.body.ok).toBe(false);
    expect(response.body.status).toBe("container-not-running");
    expect(response.body.connectivity.attempted).toBe(false);
    expect(response.body.connectivity.error.code).toBe(
      "MONGO_CONTAINER_NOT_RUNNING"
    );
  });

  test("POST /api/infra/containers/:id/start returns structured start payload", async () => {
    const response = await spec()
      .post("/api/infra/containers/mongo/start")
      .expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.operation).toBe("start");
    expect(response.body.status.running).toBe(true);
    expect(response.body.status.state).toBe("running");
  });

  test("POST /api/infra/containers/:id/stop returns structured stop payload", async () => {
    const response = await spec()
      .post("/api/infra/containers/mongo/stop")
      .expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.operation).toBe("stop");
    expect(response.body.status.running).toBe(false);
    expect(response.body.status.state).toBe("exited");
  });

  test("POST /api/infra/containers/:id/restart returns structured restart payload", async () => {
    const response = await spec()
      .post("/api/infra/containers/mongo/restart")
      .expectStatus(200);

    expect(response.body.ok).toBe(true);
    expect(response.body.operation).toBe("restart");
    expect(response.body.status.running).toBe(true);
    expect(response.body.status.state).toBe("running");
  });
});
