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

describe("module filesystem discovery", () => {
  test("discovers valid module manifests from modules directory", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const productsDir = path.join(tempRoot, "products");
    const recordsDir = path.join(tempRoot, "records");

    await fs.mkdir(productsDir, { recursive: true });
    await fs.mkdir(recordsDir, { recursive: true });

    await fs.writeFile(
      path.join(productsDir, "module.json"),
      JSON.stringify(validManifest, null, 2),
      "utf8"
    );
    await fs.writeFile(
      path.join(recordsDir, "module.json"),
      JSON.stringify(
        {
          ...validManifest,
          id: "records",
          name: "Records Module",
          lifecycle: {
            install: "records.install",
            uninstall: "records.uninstall"
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const registry = createModuleRegistry();
    const loader = createModuleLoader({
      registry,
      hookExecutor: async () => ({ ok: true })
    });

    const result = await discoverModulesFromDirectory({
      modulesDir: tempRoot,
      loader,
      autoInstall: true,
      autoEnable: true,
      resolveManifestTrackingStatus: async () => ({
        tracking: "tracked",
        reason: "test-stub"
      })
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.manifests.map((manifest) => manifest.id)).toEqual(["products", "records"]);
    expect(result.manifests[0].source).toEqual(
      expect.objectContaining({
        moduleDir: expect.any(String),
        manifestPath: expect.any(String),
        tracking: "tracked",
        trackingReason: "test-stub"
      })
    );
    expect(result.sourcePosture).toEqual(
      expect.objectContaining({
        trackedModuleIds: ["products", "records"],
        untrackedModuleIds: [],
        unknownModuleIds: [],
        hasUntrackedModules: false,
        reproducible: true,
        warningCount: 0
      })
    );
    expect(registry.getState("products")).toBe("enabled");
    expect(registry.getState("records")).toBe("enabled");

    await fs.rm(tempRoot, {
      recursive: true,
      force: true
    });
  });

  test("registers module field-type plugins before manifest validation during discovery", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const pluginType = "json-ish-probe";
    const consumerDir = path.join(tempRoot, "aa-consumer");
    const providerDir = path.join(tempRoot, "zz-provider");
    const consumerManifest = {
      ...validManifest,
      id: "plugin-consumer",
      name: "Plugin Consumer Module",
      lifecycle: {
        install: "plugin-consumer.install",
        uninstall: "plugin-consumer.uninstall"
      },
      collections: [
        {
          id: "records",
          label: "Records",
          entitySingular: "record",
          primaryField: "title",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            {
              id: "title",
              type: "text",
              required: true
            },
            {
              id: "payload",
              type: pluginType,
              required: false
            }
          ]
        }
      ]
    };
    const providerManifest = {
      ...validManifest,
      id: "plugin-provider",
      name: "Plugin Provider Module",
      lifecycle: {
        install: "plugin-provider.install",
        uninstall: "plugin-provider.uninstall"
      },
      runtime: {
        fieldTypePlugins: "./server/field-type-plugins.mjs"
      }
    };

    expect(validateModuleManifest(consumerManifest).ok).toBe(false);

    try {
      await fs.mkdir(consumerDir, { recursive: true });
      await fs.mkdir(path.join(providerDir, "server"), { recursive: true });
      await fs.writeFile(
        path.join(consumerDir, "module.json"),
        JSON.stringify(consumerManifest, null, 2),
        "utf8"
      );
      await fs.writeFile(
        path.join(providerDir, "module.json"),
        JSON.stringify(providerManifest, null, 2),
        "utf8"
      );
      await fs.writeFile(
        path.join(providerDir, "server", "field-type-plugins.mjs"),
        [
          "export const collectionFieldTypePlugins = [",
          "  {",
          `    type: \"${pluginType}\",`,
          "    schema: { kind: \"text\" },",
          "    runtime: {",
          "      normalizeInputValue: (value) => (typeof value === \"string\" ? value : \"\"),",
          "      normalizeStoredValue: (value) => (typeof value === \"string\" ? value : \"\"),",
          "      defaultValue: () => \"\",",
          "      validateInputValue: () => []",
          "    },",
          "    frontend: {",
          "      editor: { variant: \"text-input\", inputType: \"text\" },",
          "      cell: { variant: \"text\" }",
          "    }",
          "  }",
          "];"
        ].join("\n"),
        "utf8"
      );

      const registry = createModuleRegistry();
      const loader = createModuleLoader({
        registry,
        hookExecutor: async () => ({ ok: true })
      });

      const result = await discoverModulesFromDirectory({
        modulesDir: tempRoot,
        loader,
        autoInstall: true,
        autoEnable: true
      });

      expect(result.ok).toBe(true);
      expect(result.diagnostics).toEqual([]);
      expect(result.manifests.map((manifest) => manifest.id)).toEqual([
        "plugin-consumer",
        "plugin-provider"
      ]);

      const consumerValidationAfter = validateModuleManifest(consumerManifest);
      expect(consumerValidationAfter.ok).toBe(true);
    } finally {
      unregisterCollectionFieldTypePlugin(pluginType);
      await fs.rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("surfaces deterministic diagnostics when module field-type plugin schema.kind is missing", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const providerDir = path.join(tempRoot, "provider-missing-schema-kind");
    const providerManifest = {
      ...validManifest,
      id: "provider-missing-schema-kind",
      name: "Provider Missing Schema Kind",
      lifecycle: {
        install: "provider-missing-schema-kind.install",
        uninstall: "provider-missing-schema-kind.uninstall"
      },
      runtime: {
        fieldTypePlugins: "./server/field-type-plugins.mjs"
      }
    };

    try {
      await fs.mkdir(path.join(providerDir, "server"), { recursive: true });
      await fs.writeFile(
        path.join(providerDir, "module.json"),
        JSON.stringify(providerManifest, null, 2),
        "utf8"
      );
      await fs.writeFile(
        path.join(providerDir, "server", "field-type-plugins.mjs"),
        [
          "export const collectionFieldTypePlugins = [",
          "  {",
          "    type: \"missing-schema-kind\",",
          "    runtime: {",
          "      normalizeInputValue: (value) => value,",
          "      normalizeStoredValue: (value) => value,",
          "      defaultValue: () => null,",
          "      validateInputValue: () => []",
          "    },",
          "    frontend: {",
          "      editor: { variant: \"text-input\", inputType: \"text\" },",
          "      cell: { variant: \"text\" }",
          "    }",
          "  }",
          "];"
        ].join("\n"),
        "utf8"
      );

      const registry = createModuleRegistry();
      const loader = createModuleLoader({
        registry,
        hookExecutor: async () => ({ ok: true })
      });

      const result = await discoverModulesFromDirectory({
        modulesDir: tempRoot,
        loader,
        autoInstall: true,
        autoEnable: true
      });

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_FIELD_TYPE_PLUGIN_REGISTRATION_FAILED",
            pluginType: "missing-schema-kind",
            reason: "plugin schema.kind must be one of: text, number, boolean, json, ref"
          })
        ])
      );
    } finally {
      unregisterCollectionFieldTypePlugin("missing-schema-kind");
      await fs.rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("surfaces deterministic diagnostics when module field-type plugin schema.kind is invalid", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const providerDir = path.join(tempRoot, "provider-invalid-schema-kind");
    const providerManifest = {
      ...validManifest,
      id: "provider-invalid-schema-kind",
      name: "Provider Invalid Schema Kind",
      lifecycle: {
        install: "provider-invalid-schema-kind.install",
        uninstall: "provider-invalid-schema-kind.uninstall"
      },
      runtime: {
        fieldTypePlugins: "./server/field-type-plugins.mjs"
      }
    };

    try {
      await fs.mkdir(path.join(providerDir, "server"), { recursive: true });
      await fs.writeFile(
        path.join(providerDir, "module.json"),
        JSON.stringify(providerManifest, null, 2),
        "utf8"
      );
      await fs.writeFile(
        path.join(providerDir, "server", "field-type-plugins.mjs"),
        [
          "export const collectionFieldTypePlugins = [",
          "  {",
          "    type: \"invalid-schema-kind\",",
          "    schema: { kind: \"map\" },",
          "    runtime: {",
          "      normalizeInputValue: (value) => value,",
          "      normalizeStoredValue: (value) => value,",
          "      defaultValue: () => null,",
          "      validateInputValue: () => []",
          "    },",
          "    frontend: {",
          "      editor: { variant: \"text-input\", inputType: \"text\" },",
          "      cell: { variant: \"text\" }",
          "    }",
          "  }",
          "];"
        ].join("\n"),
        "utf8"
      );

      const registry = createModuleRegistry();
      const loader = createModuleLoader({
        registry,
        hookExecutor: async () => ({ ok: true })
      });

      const result = await discoverModulesFromDirectory({
        modulesDir: tempRoot,
        loader,
        autoInstall: true,
        autoEnable: true
      });

      expect(result.ok).toBe(false);
      expect(result.diagnostics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "COLLECTION_FIELD_TYPE_PLUGIN_REGISTRATION_FAILED",
            pluginType: "invalid-schema-kind",
            reason: "plugin schema.kind must be one of: text, number, boolean, json, ref"
          })
        ])
      );
    } finally {
      unregisterCollectionFieldTypePlugin("invalid-schema-kind");
      await fs.rm(tempRoot, {
        recursive: true,
        force: true
      });
    }
  });

  test("surfaces untracked module source posture warnings deterministically", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const productsDir = path.join(tempRoot, "products");

    await fs.mkdir(productsDir, { recursive: true });
    await fs.writeFile(
      path.join(productsDir, "module.json"),
      JSON.stringify(validManifest, null, 2),
      "utf8"
    );

    const result = await discoverModulesFromDirectory({
      modulesDir: tempRoot,
      loader: createModuleLoader({}),
      resolveManifestTrackingStatus: async () => ({
        tracking: "untracked",
        reason: "test-untracked"
      })
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(result.sourcePosture).toEqual(
      expect.objectContaining({
        trackedModuleIds: [],
        untrackedModuleIds: ["products"],
        unknownModuleIds: [],
        hasUntrackedModules: true,
        reproducible: false,
        warningCount: 1,
        warnings: [
          expect.objectContaining({
            code: "MODULE_SOURCE_UNTRACKED",
            moduleId: "products",
            reason: "test-untracked"
          })
        ]
      })
    );
    expect(result.manifests[0].source).toEqual(
      expect.objectContaining({
        tracking: "untracked",
        trackingReason: "test-untracked"
      })
    );

    await fs.rm(tempRoot, {
      recursive: true,
      force: true
    });
  });

  test("returns diagnostics for parse failures without crashing", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const badDir = path.join(tempRoot, "broken-module");

    await fs.mkdir(badDir, { recursive: true });
    await fs.writeFile(path.join(badDir, "module.json"), "{ not-json ", "utf8");

    const result = await discoverModulesFromDirectory({
      modulesDir: tempRoot,
      loader: createModuleLoader({})
    });

    expect(result.ok).toBe(false);
    expect(result.manifests).toEqual([]);
    expect(result.diagnostics.length).toBe(1);
    expect(result.diagnostics[0].code).toBe("MODULE_MANIFEST_PARSE_FAILED");

    await fs.rm(tempRoot, {
      recursive: true,
      force: true
    });
  });

  test("surfaces route segment collision diagnostics without crashing", async () => {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "crud-control-modules-"));
    const dispatchesDir = path.join(tempRoot, "dispatches");
    const productsDir = path.join(tempRoot, "products");

    await fs.mkdir(dispatchesDir, { recursive: true });
    await fs.mkdir(productsDir, { recursive: true });
    await fs.writeFile(
      path.join(dispatchesDir, "module.json"),
      JSON.stringify(
        {
          ...validManifest,
          id: "dispatch-center",
          name: "Dispatch Center",
          lifecycle: {
            install: "dispatch-center.install",
            uninstall: "dispatch-center.uninstall"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await fs.writeFile(
      path.join(productsDir, "module.json"),
      JSON.stringify(
        {
          ...validManifest,
          ui: {
            navigation: {
              routeSegment: "dispatch-center"
            }
          }
        },
        null,
        2
      ),
      "utf8"
    );

    const result = await discoverModulesFromDirectory({
      modulesDir: tempRoot,
      loader: createModuleLoader({})
    });

    expect(result.ok).toBe(false);
    expect(result.manifests.map((manifest) => manifest.id)).toEqual(["dispatch-center"]);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]).toEqual(
      expect.objectContaining({
        code: "MODULE_ROUTE_SEGMENT_DUPLICATE"
      })
    );
    expect(result.diagnostics[0].path).toContain(path.join("products", "module.json"));

    await fs.rm(tempRoot, {
      recursive: true,
      force: true
    });
  });
});

