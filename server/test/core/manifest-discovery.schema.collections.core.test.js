import { expect, test } from "vitest";
import { validateModuleManifest } from "../../src/core/index.js";
import { validManifest } from "./helpers/manifest-shared-fixtures.js";

function registerManifestDiscoverySchemaCollectionsSuite() {
  test("accepts valid manifests", () => {
    const result = validateModuleManifest(validManifest);

    expect(result.ok).toBe(true);
    expect(result.value.id).toBe("products");
    expect(result.value.contractVersion).toBe(1);
  });

  test("rejects duplicate capabilities", () => {
    const result = validateModuleManifest({
      ...validManifest,
      capabilities: ["schema", "schema"]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_DUPLICATE_CAPABILITY");
  });

  test("rejects unsupported contract version", () => {
    const result = validateModuleManifest({
      ...validManifest,
      contractVersion: 99
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe(
      "MODULE_MANIFEST_CONTRACT_VERSION_UNSUPPORTED"
    );
  });

  test("accepts optional collection definitions", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "records",
          label: "Records",
          entitySingular: "record",
          primaryField: "title",
          description: "Records collection",
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
    expect(result.value.collections).toEqual([
      expect.objectContaining({
        id: "records",
        label: "Records",
        entitySingular: "record",
        primaryField: "title"
      })
    ]);
  });

  test("accepts collection field families including reference-multi and normalizes computed resolver aliases", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "dispatch",
          primaryField: "title",
          description: "Dispatches collection",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            { id: "title", type: "text", required: true, minLength: 3, maxLength: 80 },
            { id: "sourceUrl", type: "url", required: false, minLength: 0, maxLength: 2048 },
            { id: "ownerId", type: "reference", required: false, collectionId: "authors" },
            {
              id: "collaboratorIds",
              type: "reference-multi",
              required: false,
              collectionId: "authors"
            },
            { id: "dispatchCode", type: "computed", source: "title", transform: "uppercase" },
            { id: "dispatchTitle", type: "computed", source: "title", resolver: "titlecase" }
          ]
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.value.collections[0].fields).toEqual([
      {
        id: "title",
        type: "text",
        required: true,
        minLength: 3,
        maxLength: 80
      },
      {
        id: "sourceUrl",
        type: "url",
        required: false,
        minLength: 0,
        maxLength: 2048
      },
      {
        id: "ownerId",
        type: "reference",
        required: false,
        collectionId: "authors"
      },
      {
        id: "collaboratorIds",
        type: "reference-multi",
        required: false,
        collectionId: "authors"
      },
      {
        id: "dispatchCode",
        type: "computed",
        required: false,
        source: "title",
        resolver: "uppercase",
        transform: "uppercase"
      },
      {
        id: "dispatchTitle",
        type: "computed",
        required: false,
        source: "title",
        resolver: "titlecase",
        transform: "titlecase"
      }
    ]);
  });

  test("accepts kebab-case collection field ids and primaryField/source references", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "dispatch",
          primaryField: "headline-title",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            { id: "headline-title", type: "text", required: true, minLength: 3, maxLength: 120 },
            { id: "published-on", type: "date", required: false },
            {
              id: "headline-slug",
              type: "computed",
              source: "headline-title",
              resolver: "slugify"
            }
          ]
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.value.collections[0].primaryField).toBe("headline-title");
    expect(result.value.collections[0].fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "headline-title",
          type: "text",
          required: true
        }),
        expect.objectContaining({
          id: "headline-slug",
          type: "computed",
          source: "headline-title",
          resolver: "slugify",
          transform: "slugify"
        })
      ])
    );
  });

  test("accepts reference field delete-policy and referenceUi metadata", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "authors",
          label: "Authors",
          entitySingular: "author",
          primaryField: "name",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            { id: "name", type: "text", required: true },
            { id: "handle", type: "text", required: true }
          ]
        },
        {
          id: "posts",
          label: "Posts",
          entitySingular: "post",
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
              id: "authorId",
              type: "reference",
              required: false,
              collectionId: "authors",
              labelField: "handle",
              onDelete: "restrict",
              onDeleteSetting: "author-delete-policy",
              referenceUi: {
                inlineCreate: true,
                inlineCreateDefaults: [{ fieldId: "name", sourceFieldId: "title" }]
              }
            },
            {
              id: "coAuthorIds",
              type: "reference-multi",
              required: false,
              collectionId: "authors",
              labelField: "handle",
              onDelete: "nullify",
              referenceUi: {
                optionsFilter: {
                  fieldId: "handle",
                  value: "@internal"
                },
                visibleWhen: {
                  sourceFieldId: "authorId",
                  collectionId: "authors",
                  matchField: "id",
                  valueField: "handle",
                  equals: "@internal"
                }
              }
            }
          ]
        }
      ]
    });

    expect(result.ok).toBe(true);
    const posts = result.value.collections.find((collection) => collection.id === "posts");
    expect(posts.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "authorId",
          type: "reference",
          collectionId: "authors",
          labelField: "handle",
          onDelete: "restrict",
          onDeleteSetting: "author-delete-policy",
          referenceUi: {
            inlineCreate: true,
            inlineCreateDefaults: [{ fieldId: "name", sourceFieldId: "title" }]
          }
        }),
        expect.objectContaining({
          id: "coAuthorIds",
          type: "reference-multi",
          collectionId: "authors",
          labelField: "handle",
          onDelete: "nullify",
          referenceUi: {
            optionsFilter: {
              fieldId: "handle",
              value: "@internal"
            },
            visibleWhen: {
              sourceFieldId: "authorId",
              collectionId: "authors",
              matchField: "id",
              valueField: "handle",
              equals: "@internal"
            }
          }
        })
      ])
    );
  });

  test("rejects unsupported reference delete policies deterministically", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "posts",
          label: "Posts",
          entitySingular: "post",
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
              id: "authorId",
              type: "reference",
              required: false,
              collectionId: "authors",
              onDelete: "cascade"
            }
          ]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.fields.1.onDelete");
  });

  test("rejects referenceUi metadata on non-reference fields", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "posts",
          label: "Posts",
          entitySingular: "post",
          primaryField: "title",
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            { id: "title", type: "text", required: true, referenceUi: { inlineCreate: true } }
          ]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.fields.0.referenceUi");
  });

  test("rejects invalid collection field id shape deterministically", () => {
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
          fields: [{ id: "HeadlineTitle", type: "text", required: true }]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.fields.0.id");
  });

  test("accepts deterministic collection field default values including default/defaultValue aliases", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "digests",
          label: "Digests",
          entitySingular: "digest",
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
              minLength: 3,
              maxLength: 120,
              defaultValue: "  digest default title  "
            },
            {
              id: "status",
              type: "enum",
              required: true,
              options: ["draft", "review", "published"],
              default: "Review"
            },
            {
              id: "labels",
              type: "enum-multi",
              required: false,
              options: ["featured", "release"],
              defaultValue: ["release", "featured", "release"]
            },
            {
              id: "sourceUrl",
              type: "url",
              required: false,
              minLength: 0,
              maxLength: 2048,
              defaultValue: "https://digests.example.test/default"
            },
            {
              id: "publishedOn",
              type: "date",
              required: false,
              defaultValue: "2026-02-17"
            },
            {
              id: "recordId",
              type: "reference",
              required: false,
              collectionId: "records",
              defaultValue: "rec-001"
            }
          ]
        }
      ]
    });

    expect(result.ok).toBe(true);
    const fields = result.value.collections[0].fields;
    expect(fields.find((field) => field.id === "title")).toEqual(
      expect.objectContaining({
        defaultValue: "digest default title"
      })
    );
    expect(fields.find((field) => field.id === "status")).toEqual(
      expect.objectContaining({
        defaultValue: "review"
      })
    );
    expect(fields.find((field) => field.id === "labels")).toEqual(
      expect.objectContaining({
        defaultValue: ["release", "featured"]
      })
    );
    expect(fields.find((field) => field.id === "sourceUrl")).toEqual(
      expect.objectContaining({
        defaultValue: "https://digests.example.test/default"
      })
    );
    expect(fields.find((field) => field.id === "publishedOn")).toEqual(
      expect.objectContaining({
        defaultValue: "2026-02-17"
      })
    );
    expect(fields.find((field) => field.id === "recordId")).toEqual(
      expect.objectContaining({
        defaultValue: "rec-001"
      })
    );
  });

  test("rejects conflicting collection default/defaultValue aliases deterministically", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "digests",
          label: "Digests",
          entitySingular: "digest",
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
              id: "status",
              type: "enum",
              required: true,
              options: ["draft", "review", "published"],
              default: "draft",
              defaultValue: "review"
            }
          ]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.fields.0.defaultValue");
  });

  test("rejects invalid collection url and computed defaults deterministically", () => {
    const urlDefaultResult = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "digests",
          label: "Digests",
          entitySingular: "digest",
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
              id: "sourceUrl",
              type: "url",
              required: false,
              defaultValue: "ftp://digests.example.test/bad"
            }
          ]
        }
      ]
    });
    expect(urlDefaultResult.ok).toBe(false);
    expect(urlDefaultResult.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(urlDefaultResult.error.field).toBe("collections.0.fields.0.defaultValue");

    const computedDefaultResult = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "digests",
          label: "Digests",
          entitySingular: "digest",
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
              id: "slug",
              type: "computed",
              source: "title",
              defaultValue: "digest-proof"
            }
          ]
        }
      ]
    });
    expect(computedDefaultResult.ok).toBe(false);
    expect(computedDefaultResult.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(computedDefaultResult.error.field).toBe("collections.0.fields.0.defaultValue");
  });

  test("rejects unsupported collection field type deterministically", () => {
    const result = validateModuleManifest({
      ...validManifest,
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
            { id: "title", type: "text", required: true },
            { id: "payload", type: "json", required: false }
          ]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.fields.1.type");
  });

  test("rejects collection primaryField mismatch deterministically", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: [
        {
          id: "records",
          label: "Records",
          entitySingular: "record",
          primaryField: "name",
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
    expect(result.error.field).toBe("collections.0.primaryField");
  });

  test("rejects unsupported collection computed resolver deterministically", () => {
    const result = validateModuleManifest({
      ...validManifest,
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
            { id: "title", type: "text", required: true },
            { id: "slug", type: "computed", source: "title", resolver: "reverse" }
          ]
        }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections.0.fields.1.resolver");
  });

}

export { registerManifestDiscoverySchemaCollectionsSuite };
