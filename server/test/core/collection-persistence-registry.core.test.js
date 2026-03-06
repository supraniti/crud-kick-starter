import { describe, expect, test } from "vitest";
import {
  createCollectionHandlerRegistry,
  createModuleRegistry,
  createPersistencePluginRegistry
} from "../../src/core/index.js";
import { validManifest } from "./helpers/manifest-shared-fixtures.js";

describe("collection handler registry contract", () => {
  test("registers collection handlers and resolves runtime status", () => {
    const registry = createCollectionHandlerRegistry();
    const handler = {
      list: () => ({ items: [], meta: {} })
    };

    const registerResult = registry.register({
      collectionId: "records",
      moduleId: "records",
      handler
    });

    expect(registerResult.ok).toBe(true);
    expect(registry.get("records")).toBe(handler);

    const status = registry.resolveStatus({
      definitions: {
        records: {
          id: "records"
        }
      }
    });
    expect(status.registeredCollectionIds).toEqual(["records"]);
    expect(status.collectionHandlerModuleMap).toEqual({
      records: "records"
    });
    expect(status.diagnostics).toEqual([]);
  });

  test("emits deterministic diagnostics for duplicate and missing handlers", () => {
    const registry = createCollectionHandlerRegistry();
    const firstResult = registry.register({
      collectionId: "records",
      moduleId: "records",
      handler: {
        list: () => ({ items: [], meta: {} })
      }
    });
    const duplicateResult = registry.register({
      collectionId: "records",
      moduleId: "duplicate-records-module",
      handler: {
        list: () => ({ items: [], meta: {} })
      }
    });

    expect(firstResult.ok).toBe(true);
    expect(duplicateResult.ok).toBe(false);
    expect(duplicateResult.error.code).toBe("COLLECTION_HANDLER_DUPLICATE");

    const status = registry.resolveStatus({
      definitions: {
        records: {
          id: "records"
        },
        notes: {
          id: "notes"
        }
      }
    });

    expect(status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "COLLECTION_HANDLER_DUPLICATE",
          collectionId: "records"
        }),
        expect.objectContaining({
          code: "COLLECTION_HANDLER_NOT_REGISTERED",
          collectionId: "notes",
          moduleId: null
        })
      ])
    );
  });

  test("emits mismatch diagnostic when registered module and owner module differ", () => {
    const registry = createCollectionHandlerRegistry();
    const registerResult = registry.register({
      collectionId: "records",
      moduleId: "records-helper-module",
      handler: {
        list: () => ({ items: [], meta: {} })
      }
    });

    expect(registerResult.ok).toBe(true);

    const status = registry.resolveStatus({
      definitions: {
        records: {
          id: "records"
        }
      },
      collectionModuleMap: {
        records: "records"
      }
    });

    expect(status.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "COLLECTION_HANDLER_MODULE_MISMATCH",
          collectionId: "records",
          moduleId: "records",
          registeredModuleId: "records-helper-module"
        })
      ])
    );
  });
});

describe("persistence plugin registry contract", () => {
  function createStubRepository() {
    return {
      async readState() {
        return {};
      },
      async transact(mutator) {
        return mutator({});
      }
    };
  }

  test("registers collection and settings repositories and resolves active status", () => {
    const registry = createPersistencePluginRegistry();
    const moduleRegistry = createModuleRegistry();
    moduleRegistry.discover({
      ...validManifest,
      id: "records",
      name: "Records Module",
      lifecycle: {
        install: "records.install",
        uninstall: "records.uninstall"
      }
    });
    moduleRegistry.install("records");
    moduleRegistry.enable("records");

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

    const recordsRepository = createStubRepository();
    const settingsRepository = createStubRepository();

    const recordsResult = registry.register({
      pluginId: "records-collections",
      moduleId: "records",
      collections: [
        {
          collectionId: "records",
          repository: recordsRepository
        },
        {
          collectionId: "notes",
          repository: recordsRepository
        }
      ]
    });
    const remotesResult = registry.register({
      pluginId: "remotes-settings",
      moduleId: "remotes",
      settings: {
        repository: settingsRepository
      }
    });

    expect(recordsResult.ok).toBe(true);
    expect(remotesResult.ok).toBe(true);
    expect(registry.getCollectionRepository("records")).toBe(recordsRepository);
    expect(registry.getSettingsRepository("remotes")).toBe(settingsRepository);

    const status = registry.resolveStatus({
      moduleRegistry
    });
    expect(status.registeredPluginIds).toEqual([
      "records-collections",
      "remotes-settings"
    ]);
    expect(status.collectionRepositoryModuleMap).toEqual({
      records: "records",
      notes: "records"
    });
    expect(status.activeCollectionRepositoryModuleMap).toEqual({
      records: "records",
      notes: "records"
    });
    expect(status.settingsRepositoryModuleMap).toEqual({
      remotes: "remotes-settings"
    });
    expect(status.activeSettingsRepositoryModuleMap).toEqual({
      remotes: "remotes-settings"
    });
    expect(status.diagnostics).toEqual([]);
  });

  test("rejects unknown fields and duplicate collection ownership deterministically", () => {
    const registry = createPersistencePluginRegistry();
    const repository = createStubRepository();

    const unknownField = registry.register({
      pluginId: "bad",
      moduleId: "records",
      collections: [],
      unknownField: true
    });
    expect(unknownField.ok).toBe(false);
    expect(unknownField.error.code).toBe(
      "PERSISTENCE_PLUGIN_REGISTRATION_UNKNOWN_FIELD"
    );

    const first = registry.register({
      pluginId: "records-one",
      moduleId: "records",
      collections: [
        {
          collectionId: "records",
          repository
        }
      ]
    });
    const duplicateCollection = registry.register({
      pluginId: "records-two",
      moduleId: "records",
      collections: [
        {
          collectionId: "records",
          repository
        }
      ]
    });

    expect(first.ok).toBe(true);
    expect(duplicateCollection.ok).toBe(false);
    expect(duplicateCollection.error.code).toBe(
      "PERSISTENCE_PLUGIN_COLLECTION_DUPLICATE"
    );
  });
});

