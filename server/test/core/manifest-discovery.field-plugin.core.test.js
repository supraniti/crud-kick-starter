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

describe("collection field type plugin contract", () => {
  test("rejects registration when schema.kind is missing", () => {
    const pluginType = "contract-missing-schema-kind";
    try {
      const registration = registerCollectionFieldTypePlugin({
        type: pluginType,
        runtime: {
          normalizeInputValue: (value) => value,
          normalizeStoredValue: (value) => value,
          defaultValue: () => null,
          validateInputValue: () => []
        },
        frontend: {
          editor: {
            variant: "text-input",
            inputType: "text"
          },
          cell: {
            variant: "text"
          }
        }
      });

      expect(registration.ok).toBe(false);
      expect(registration.reason).toBe(
        "plugin schema.kind must be one of: text, number, boolean, json, ref"
      );
    } finally {
      unregisterCollectionFieldTypePlugin(pluginType);
    }
  });

  test("rejects registration when schema.kind is unsupported", () => {
    const pluginType = "contract-invalid-schema-kind";
    try {
      const registration = registerCollectionFieldTypePlugin({
        type: pluginType,
        schema: {
          kind: "list"
        },
        runtime: {
          normalizeInputValue: (value) => value,
          normalizeStoredValue: (value) => value,
          defaultValue: () => null,
          validateInputValue: () => []
        },
        frontend: {
          editor: {
            variant: "text-input",
            inputType: "text"
          },
          cell: {
            variant: "text"
          }
        }
      });

      expect(registration.ok).toBe(false);
      expect(registration.reason).toBe(
        "plugin schema.kind must be one of: text, number, boolean, json, ref"
      );
    } finally {
      unregisterCollectionFieldTypePlugin(pluginType);
    }
  });
});

