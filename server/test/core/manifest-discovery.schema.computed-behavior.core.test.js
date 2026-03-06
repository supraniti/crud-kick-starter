import { expect, test } from "vitest";
import { validateModuleManifest } from "../../src/core/index.js";
import { validManifest } from "./helpers/manifest-shared-fixtures.js";

function registerManifestDiscoverySchemaComputedBehaviorSuite() {
  test("accepts computed field settings bindings for supported resolver options", () => {
    const result = validateModuleManifest({
      ...validManifest,
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "slugMaxLength",
            label: "Slug Max Length",
            type: "number",
            required: true,
            min: 12,
            max: 120,
            defaultValue: 64
          }
        ]
      },
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "dispatch",
          primaryField: "title",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            { id: "title", type: "text", required: true },
            {
              id: "slug",
              type: "computed",
              source: "title",
              resolver: "slugify",
              settings: {
                maxLength: "slugMaxLength"
              }
            }
          ]
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.value.collections[0].fields[1]).toEqual(
      expect.objectContaining({
        id: "slug",
        type: "computed",
        source: "title",
        resolver: "slugify",
        settings: {
          maxLength: "slugMaxLength"
        }
      })
    );
  });

  test("rejects computed field settings bindings when module settings definition is missing", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "dispatch",
          primaryField: "title",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            { id: "title", type: "text", required: true },
            {
              id: "slug",
              type: "computed",
              source: "title",
              resolver: "slugify",
              settings: {
                maxLength: "slugMaxLength"
              }
            }
          ]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.fields.1.settings");
  });

  test("rejects computed field settings bindings when setting id or type is incompatible", () => {
    const unknownSettingResult = validateModuleManifest({
      ...validManifest,
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "otherValue",
            label: "Other Value",
            type: "number",
            required: true,
            defaultValue: 32
          }
        ]
      },
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "dispatch",
          primaryField: "title",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            { id: "title", type: "text", required: true },
            {
              id: "slug",
              type: "computed",
              source: "title",
              resolver: "slugify",
              settings: {
                maxLength: "slugMaxLength"
              }
            }
          ]
        }
      ]
    });
    expect(unknownSettingResult.ok).toBe(false);
    expect(unknownSettingResult.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(unknownSettingResult.error.field).toBe("collections.0.fields.1.settings.maxLength");
    expect(unknownSettingResult.error.message).toContain("unknown module setting");

    const mismatchedTypeResult = validateModuleManifest({
      ...validManifest,
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "slugMaxLength",
            label: "Slug Max Length",
            type: "text",
            required: false,
            defaultValue: "64"
          }
        ]
      },
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "dispatch",
          primaryField: "title",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            { id: "title", type: "text", required: true },
            {
              id: "slug",
              type: "computed",
              source: "title",
              resolver: "slugify",
              settings: {
                maxLength: "slugMaxLength"
              }
            }
          ]
        }
      ]
    });
    expect(mismatchedTypeResult.ok).toBe(false);
    expect(mismatchedTypeResult.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(mismatchedTypeResult.error.field).toBe(
      "collections.0.fields.1.settings.maxLength"
    );
    expect(mismatchedTypeResult.error.message).toContain("requires setting type number");
  });

  test("rejects collection field settings on non-computed fields deterministically", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "dispatch",
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
              required: true,
              settings: {
                maxLength: "slugMaxLength"
              }
            }
          ]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.fields.0.settings");
  });

  test("accepts optional collection behavior and preserves canonical aliases", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "records",
          label: "Records",
          entitySingular: "record",
          primaryField: "title",
          description: "Records collection",
          behavior: {
            enforcePrimaryFieldUnique: false
          },
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [{ id: "title", type: "text", required: true }]
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.value.collections[0].behavior).toEqual({
      enforcePrimaryFieldUnique: false,
      enforceTitleUnique: false
    });
  });

  test("rejects conflicting collection behavior compatibility values", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "records",
          label: "Records",
          entitySingular: "record",
          primaryField: "title",
          behavior: {
            enforcePrimaryFieldUnique: true,
            enforceTitleUnique: false
          },
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [{ id: "title", type: "text", required: true }]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.behavior.enforceTitleUnique");
  });

  test("rejects invalid collection entitySingular shape", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "records",
          label: "Records",
          entitySingular: "Record",
          primaryField: "title",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [{ id: "title", type: "text", required: true }]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.entitySingular");
  });

  test("accepts optional runtime collection handler entrypoint", () => {
    const result = validateModuleManifest({
      ...validManifest,
      runtime: {
        collectionHandlers: "./server/collection-handlers.mjs",
        services: "./server/runtime-services.mjs",
        missions: "./server/runtime-missions.mjs",
        persistence: "./server/persistence-plugins.mjs"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value.runtime).toEqual({
      collectionHandlers: "./server/collection-handlers.mjs",
      services: "./server/runtime-services.mjs",
      missions: "./server/runtime-missions.mjs",
      persistence: "./server/persistence-plugins.mjs"
    });
  });

  test("accepts optional ui navigation route segment override", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        navigation: {
          routeSegment: "dispatch-center"
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value.ui.navigation.routeSegment).toBe("dispatch-center");
  });

}

export { registerManifestDiscoverySchemaComputedBehaviorSuite };
