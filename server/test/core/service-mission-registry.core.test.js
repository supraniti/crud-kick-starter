import { describe, expect, test } from "vitest";
import {
  createMissionRegistry,
  createModuleRegistry,
  createServiceRegistry
} from "../../src/core/index.js";
import { validManifest } from "./helpers/manifest-shared-fixtures.js";

describe("service registry contract", () => {
  test("registers services and resolves active status by module lifecycle", () => {
    const registry = createServiceRegistry();
    const moduleRegistry = createModuleRegistry();
    moduleRegistry.discover({
      ...validManifest,
      id: "remotes",
      name: "Remotes Module",
      lifecycle: {
        install: "remotes.install",
        uninstall: "remotes.uninstall"
      }
    });
    moduleRegistry.install("remotes");
    moduleRegistry.enable("remotes");

    const registerResult = registry.register({
      serviceId: "remote-deploy-connector",
      moduleId: "remotes",
      service: {
        label: "Remote Deploy Connector"
      }
    });

    expect(registerResult.ok).toBe(true);
    expect(registry.get("remote-deploy-connector")).toEqual(
      expect.objectContaining({
        label: "Remote Deploy Connector"
      })
    );

    const statusEnabled = registry.resolveStatus({
      moduleRegistry
    });
    expect(statusEnabled.registeredServiceIds).toEqual(["remote-deploy-connector"]);
    expect(statusEnabled.activeRegisteredServiceIds).toEqual(["remote-deploy-connector"]);
    expect(statusEnabled.serviceModuleMap).toEqual({
      "remote-deploy-connector": "remotes"
    });
    expect(statusEnabled.activeServiceModuleMap).toEqual({
      "remote-deploy-connector": "remotes"
    });
    expect(statusEnabled.diagnostics).toEqual([]);

    moduleRegistry.disable("remotes");
    const statusDisabled = registry.resolveStatus({
      moduleRegistry
    });
    expect(statusDisabled.registeredServiceIds).toEqual(["remote-deploy-connector"]);
    expect(statusDisabled.activeRegisteredServiceIds).toEqual([]);
    expect(statusDisabled.activeServiceModuleMap).toEqual({});
  });

  test("emits deterministic diagnostics for duplicate registration", () => {
    const registry = createServiceRegistry();
    const firstResult = registry.register({
      serviceId: "remote-deploy-connector",
      moduleId: "remotes",
      service: {
        label: "Remote Deploy Connector"
      }
    });
    const duplicateResult = registry.register({
      serviceId: "remote-deploy-connector",
      moduleId: "records",
      service: {
        label: "Duplicate Service"
      }
    });

    expect(firstResult.ok).toBe(true);
    expect(duplicateResult.ok).toBe(false);
    expect(duplicateResult.error.code).toBe("SERVICE_DUPLICATE");
  });

  test("emits deterministic diagnostics when service module is not discovered", () => {
    const registry = createServiceRegistry();
    const moduleRegistry = createModuleRegistry();
    const registerResult = registry.register({
      serviceId: "remote-deploy-connector",
      moduleId: "remotes",
      service: {
        label: "Remote Deploy Connector"
      }
    });

    expect(registerResult.ok).toBe(true);

    const status = registry.resolveStatus({
      moduleRegistry
    });
    expect(status.activeRegisteredServiceIds).toEqual([]);
    expect(status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "SERVICE_MODULE_NOT_DISCOVERED",
          serviceId: "remote-deploy-connector",
          moduleId: "remotes"
        })
      ])
    );
  });
});

describe("mission registry contract", () => {
  test("registers missions and resolves active status by module lifecycle", () => {
    const registry = createMissionRegistry();
    const moduleRegistry = createModuleRegistry();
    moduleRegistry.discover({
      ...validManifest,
      id: "remotes",
      name: "Remotes Module",
      lifecycle: {
        install: "remotes.install",
        uninstall: "remotes.uninstall"
      }
    });
    moduleRegistry.install("remotes");
    moduleRegistry.enable("remotes");

    const registerResult = registry.register({
      missionId: "remote-deploy-mission",
      moduleId: "remotes",
      mission: {
        label: "Remote Deploy Mission"
      }
    });

    expect(registerResult.ok).toBe(true);
    expect(registry.get("remote-deploy-mission")).toEqual(
      expect.objectContaining({
        label: "Remote Deploy Mission"
      })
    );

    const statusEnabled = registry.resolveStatus({
      moduleRegistry
    });
    expect(statusEnabled.registeredMissionIds).toEqual(["remote-deploy-mission"]);
    expect(statusEnabled.activeRegisteredMissionIds).toEqual(["remote-deploy-mission"]);
    expect(statusEnabled.missionModuleMap).toEqual({
      "remote-deploy-mission": "remotes"
    });
    expect(statusEnabled.activeMissionModuleMap).toEqual({
      "remote-deploy-mission": "remotes"
    });
    expect(statusEnabled.diagnostics).toEqual([]);

    moduleRegistry.disable("remotes");
    const statusDisabled = registry.resolveStatus({
      moduleRegistry
    });
    expect(statusDisabled.registeredMissionIds).toEqual(["remote-deploy-mission"]);
    expect(statusDisabled.activeRegisteredMissionIds).toEqual([]);
    expect(statusDisabled.activeMissionModuleMap).toEqual({});
  });

  test("emits deterministic diagnostics for duplicate registration", () => {
    const registry = createMissionRegistry();
    const firstResult = registry.register({
      missionId: "remote-deploy-mission",
      moduleId: "remotes",
      mission: {
        label: "Remote Deploy Mission"
      }
    });
    const duplicateResult = registry.register({
      missionId: "remote-deploy-mission",
      moduleId: "records",
      mission: {
        label: "Duplicate Mission"
      }
    });

    expect(firstResult.ok).toBe(true);
    expect(duplicateResult.ok).toBe(false);
    expect(duplicateResult.error.code).toBe("MISSION_DUPLICATE");
  });

  test("normalizes mission payload metadata and rejects invalid field contracts", () => {
    const registry = createMissionRegistry();

    const validRegistration = registry.register({
      missionId: "normalized-mission",
      moduleId: "remotes",
      mission: {
        label: "Normalized Mission",
        payload: {
          fields: [
            {
              id: "remoteId",
              type: "text",
              defaultValue: null
            },
            {
              id: "hold",
              type: "boolean",
              defaultValue: false
            },
            {
              id: "mode",
              type: "enum",
              options: [
                {
                  value: "safe",
                  label: "Safe"
                },
                {
                  value: "fast",
                  label: "Fast"
                }
              ],
              defaultValue: "safe"
            }
          ]
        }
      }
    });

    expect(validRegistration.ok).toBe(true);
    expect(registry.get("normalized-mission")).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          fields: expect.arrayContaining([
            expect.objectContaining({
              id: "remoteId",
              type: "text",
              defaultValue: null
            }),
            expect.objectContaining({
              id: "hold",
              type: "boolean",
              defaultValue: false
            }),
            expect.objectContaining({
              id: "mode",
              type: "enum",
              options: expect.arrayContaining([
                expect.objectContaining({
                  value: "safe",
                  label: "Safe"
                })
              ])
            })
          ])
        })
      })
    );

    const invalidRegistration = registry.register({
      missionId: "invalid-mission",
      moduleId: "remotes",
      mission: {
        label: "Invalid Mission",
        payload: {
          fields: [
            {
              id: "bad",
              type: "enum",
              options: [],
              defaultValue: "x"
            }
          ]
        }
      }
    });

    expect(invalidRegistration.ok).toBe(false);
    expect(invalidRegistration.error.code).toBe("MISSION_REGISTRATION_INVALID");
  });

  test("emits deterministic diagnostics when mission module is not discovered", () => {
    const registry = createMissionRegistry();
    const moduleRegistry = createModuleRegistry();
    const registerResult = registry.register({
      missionId: "remote-deploy-mission",
      moduleId: "remotes",
      mission: {
        label: "Remote Deploy Mission"
      }
    });

    expect(registerResult.ok).toBe(true);

    const status = registry.resolveStatus({
      moduleRegistry
    });
    expect(status.activeRegisteredMissionIds).toEqual([]);
    expect(status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MISSION_MODULE_NOT_DISCOVERED",
          missionId: "remote-deploy-mission",
          moduleId: "remotes"
        })
      ])
    );
  });
});

