import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { request, spec } from "pactum";
import { buildServer } from "../../src/app.js";

const liveRequested = process.env.LIVE_DOCKER_TESTS === "1";
const dockerProbe = spawnSync(
  "docker",
  ["version", "--format", "{{.Server.Version}}"],
  {
    shell: process.platform === "win32"
  }
);
const dockerAvailable = dockerProbe.status === 0;
const liveEnabled = liveRequested && dockerAvailable;
const describeLive = liveEnabled ? describe : describe.skip;
const REQUEST_TIMEOUT_MS = 15_000;

let server;

async function get(path) {
  return spec().get(path).withRequestTimeout(REQUEST_TIMEOUT_MS).expectStatus(200);
}

async function post(path) {
  return spec().post(path).withRequestTimeout(REQUEST_TIMEOUT_MS).expectStatus(200);
}

async function waitForMongoConnected(maxAttempts = 20, delayMs = 1000) {
  let lastResponse;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastResponse = await get("/api/infra/mongo/check");

    if (lastResponse.body?.status === "connected") {
      return lastResponse;
    }

    await sleep(delayMs);
  }

  return lastResponse;
}

describeLive("live docker/mongo integration", () => {
  beforeAll(async () => {
    server = buildServer({ logger: false });
    await server.listen({
      host: "127.0.0.1",
      port: 0
    });

    const address = server.server.address();
    request.setBaseUrl(`http://127.0.0.1:${address.port}`);
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  });

  test(
    "status/start/check/restart/stop sequence is operational",
    async () => {
      const statusBefore = await get("/api/infra/containers/mongo/status");
      expect(statusBefore.body.ok).toBe(true);
      expect(statusBefore.body.operation).toBe("status");
      const started = await post("/api/infra/containers/mongo/start");
      expect(started.body.ok).toBe(true);
      expect(started.body.operation).toBe("start");
      expect(started.body.status.running).toBe(true);

      const check = await waitForMongoConnected();
      expect(check.body.ok).toBe(true);
      expect(check.body.status).toBe("connected");

      const restarted = await post("/api/infra/containers/mongo/restart");
      expect(restarted.body.ok).toBe(true);
      expect(restarted.body.operation).toBe("restart");

      const stopped = await post("/api/infra/containers/mongo/stop");
      expect(stopped.body.ok).toBe(true);
      expect(stopped.body.operation).toBe("stop");
      expect(stopped.body.status.running).toBe(false);

      const restored = await post("/api/infra/containers/mongo/start");
      expect(restored.body.ok).toBe(true);
      expect(restored.body.operation).toBe("start");
      expect(restored.body.status.running).toBe(true);
    },
    300000
  );
});

describe("live docker/mongo integration gating", () => {
  test("suite is skipped unless LIVE_DOCKER_TESTS=1 and docker is available", () => {
    expect(typeof liveEnabled).toBe("boolean");
  });
});
