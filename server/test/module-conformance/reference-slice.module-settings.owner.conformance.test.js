import { afterAll, beforeAll, describe } from "vitest";
import { request } from "pactum";
import { buildServer } from "../../src/app.js";
import { createMockContainerManager } from "./helpers/reference-slice-runtime-test-helpers.js";
import { registerReferenceSliceModuleSettingsConformanceSuite } from "./module-settings.module-conformance.test.js";
import { registerReferenceSliceModuleSettingsPersistenceConformanceSuite } from "./module-settings.persistence.module-conformance.test.js";

const SUITE_HOST_TIMEOUT_MS = 30_000;

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
  await server.close();
}, SUITE_HOST_TIMEOUT_MS);

describe("reference slice module settings owner conformance", () => {
  registerReferenceSliceModuleSettingsConformanceSuite();
  registerReferenceSliceModuleSettingsPersistenceConformanceSuite();
});
