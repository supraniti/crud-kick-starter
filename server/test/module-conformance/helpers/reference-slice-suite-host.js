import { afterAll, beforeAll } from "vitest";
import { request } from "pactum";
import { buildServer } from "../../../src/app.js";
import { createMockContainerManager } from "./reference-slice-runtime-test-helpers.js";

const SUITE_HOST_TIMEOUT_MS = 30_000;

function registerReferenceSliceSuiteWithServer(registerSuite) {
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
  }, SUITE_HOST_TIMEOUT_MS);

  afterAll(async () => {
    if (server) {
      await server.close();
    }
  }, SUITE_HOST_TIMEOUT_MS);

  registerSuite();
}

export { registerReferenceSliceSuiteWithServer };
