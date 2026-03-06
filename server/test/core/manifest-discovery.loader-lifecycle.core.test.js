import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  registerCollectionFieldTypePlugin,
  unregisterCollectionFieldTypePlugin
} from "../../src/core/shared/capability-contracts/local-kernel/collection-field-type-plugin-registry.mjs";
import {
  createModuleLoader,
  createModuleRegistry,
  discoverModulesFromDirectory,
  validateModuleManifest
} from "../../src/core/index.js";
import { validManifest } from "./helpers/manifest-shared-fixtures.js";

describe("module registry/loader scaffold", () => {
  test("supports discover -> install -> uninstall lifecycle", async () => {
    const registry = createModuleRegistry();
    const loader = createModuleLoader({
      registry,
      hookExecutor: async () => ({ ok: true })
    });

    loader.discover(validManifest);
    expect(registry.getState("products")).toBe("discovered");

    await loader.install("products");
    expect(registry.getState("products")).toBe("installed");

    await loader.uninstall("products");
    expect(registry.getState("products")).toBe("uninstalled");
  });

  test("moves to failed on install hook failure", async () => {
    const registry = createModuleRegistry();
    const loader = createModuleLoader({
      registry,
      hookExecutor: async () => ({ ok: false })
    });

    loader.discover(validManifest);

    await expect(loader.install("products")).rejects.toThrow(
      "Install hook failed for module products"
    );
    expect(registry.getState("products")).toBe("failed");
  });

  test("rejects duplicate route segment ownership across modules", () => {
    const registry = createModuleRegistry();

    registry.discover({
      ...validManifest,
      ui: {
        navigation: {
          routeSegment: "dispatch-center"
        }
      }
    });

    let caughtError = null;
    try {
      registry.discover({
        ...validManifest,
        id: "records",
        name: "Records Module",
        lifecycle: {
          install: "records.install",
          uninstall: "records.uninstall"
        },
        ui: {
          navigation: {
            routeSegment: "dispatch-center"
          }
        }
      });
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toEqual(
      expect.objectContaining({
        code: "MODULE_ROUTE_SEGMENT_DUPLICATE"
      })
    );
    expect(caughtError?.details).toEqual(
      expect.objectContaining({
        code: "MODULE_ROUTE_SEGMENT_DUPLICATE",
        field: "ui.navigation.routeSegment",
        routeSegment: "dispatch-center",
        moduleId: "records",
        firstModuleId: "products"
      })
    );
  });

  test("rejects duplicate module id discovery deterministically", () => {
    const registry = createModuleRegistry();

    registry.discover(validManifest);

    expect(() => registry.discover(validManifest)).toThrow(
      "Module 'products' has already been discovered"
    );
  });
});

