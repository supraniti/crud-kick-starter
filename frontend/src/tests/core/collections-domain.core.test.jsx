import { describe, expect, test } from "vitest";
import {
  buildCollectionMutationPayload,
  buildCollectionListOptions,
  createDefaultCollectionFilterState,
  createDefaultCollectionFormState,
  getCollectionEntityLabel,
  resolveCollectionSchemaFields,
  singularizeCollectionLabel
} from "../../domains/collections/domain-helpers.js";
import {
  registerCollectionFieldTypePlugin,
  unregisterCollectionFieldTypePlugin
} from "../../runtime/shared-capability-bridges/collection-field-type-plugin-registry.mjs";

describe("collections domain manifest-truth defaults", () => {
  test("does not inject static records/notes fields when schema metadata is unavailable", () => {
    expect(resolveCollectionSchemaFields(null, "records")).toEqual([]);
    expect(resolveCollectionSchemaFields(undefined, "notes")).toEqual([]);

    expect(createDefaultCollectionFilterState("records", null)).toEqual({
      search: ""
    });

    const formState = createDefaultCollectionFormState("records", null);
    expect(formState).toEqual({
      itemId: null,
      saving: false,
      errorMessage: null,
      successMessage: null,
      errorActions: []
    });
  });

  test("derives deterministic singular labels for common plural collection ids", () => {
    expect(getCollectionEntityLabel("dispatches")).toBe("dispatch");
    expect(getCollectionEntityLabel("stories")).toBe("story");
    expect(getCollectionEntityLabel("categories")).toBe("category");
    expect(getCollectionEntityLabel("glass")).toBe("glass");
    expect(getCollectionEntityLabel("news")).toBe("news");
  });

  test("derives deterministic singular labels for collection UI copy boundaries", () => {
    expect(singularizeCollectionLabel("Dispatches")).toBe("Dispatch");
    expect(singularizeCollectionLabel("Stories")).toBe("Story");
    expect(singularizeCollectionLabel("Categories")).toBe("Category");
    expect(singularizeCollectionLabel("Glass")).toBe("Glass");
    expect(singularizeCollectionLabel("News")).toBe("News");
  });

  test("prefers explicit entitySingular metadata from schema and collection payloads", () => {
    expect(
      getCollectionEntityLabel("dispatches", {
        collectionSchema: {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "dispatch"
        }
      })
    ).toBe("dispatch");

    expect(
      getCollectionEntityLabel("dispatches", {
        collection: {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "dispatch"
        }
      })
    ).toBe("dispatch");
  });

  test("derives form defaults from schema field defaultValue metadata deterministically", () => {
    const formState = createDefaultCollectionFormState("digests", {
      id: "digests",
      fields: [
        {
          id: "title",
          label: "Title",
          type: "text",
          defaultValue: "Digest Default Title"
        },
        {
          id: "status",
          label: "Status",
          type: "enum",
          options: ["draft", "review", "published"],
          defaultValue: "review"
        },
        {
          id: "sourceUrl",
          label: "Source URL",
          type: "url",
          defaultValue: "https://digests.example.test/default"
        }
      ]
    });

    expect(formState.title).toBe("Digest Default Title");
    expect(formState.status).toBe("review");
    expect(formState.sourceUrl).toBe("https://digests.example.test/default");
  });

  test("builds reference-multi query keys for both camelCase and kebab-case field ids", () => {
    const listOptions = buildCollectionListOptions(
      "dispatches",
      {
        search: "",
        linkedDocIds: "doc-001",
        "linked-docs-ids": "doc-002"
      },
      {
        id: "dispatches",
        fields: [
          {
            id: "linkedDocIds",
            label: "Linked Docs",
            type: "reference-multi",
            collectionId: "docs"
          },
          {
            id: "linked-docs-ids",
            label: "Linked Docs (Kebab)",
            type: "reference-multi",
            collectionId: "docs"
          }
        ]
      }
    );

    expect(listOptions).toEqual(
      expect.objectContaining({
        linkedDocId: "doc-001",
        "linked-docs-id": "doc-002"
      })
    );
  });

  test("keeps plugin structured-object payloads as objects for mutation requests", () => {
    const fieldType = "test-plugin-structured-object-payload";
    registerCollectionFieldTypePlugin(
      {
        type: fieldType,
        schema: {
          kind: "json"
        },
        frontend: {
          editor: {
            variant: "structured-object"
          }
        }
      },
      {
        overwrite: true
      }
    );

    try {
      const collectionSchema = {
        id: "plugin-structured",
        fields: [
          {
            id: "title",
            label: "Title",
            type: "text"
          },
          {
            id: "profile",
            label: "Profile",
            type: fieldType,
            constraints: {
              objectSchema: {
                properties: [
                  {
                    id: "mode",
                    label: "Mode",
                    type: "enum",
                    required: true,
                    options: ["open", "moderated"]
                  }
                ]
              }
            }
          }
        ]
      };

      const formState = createDefaultCollectionFormState("plugin-structured", collectionSchema);
      expect(formState.profile).toEqual(
        expect.objectContaining({
          mode: expect.any(String)
        })
      );

      const payload = buildCollectionMutationPayload(
        "plugin-structured",
        {
          ...formState,
          title: "Profile A",
          profile: {
            mode: "moderated"
          }
        },
        collectionSchema
      );

      expect(payload.profile).toEqual({
        mode: "moderated"
      });
    } finally {
      unregisterCollectionFieldTypePlugin(fieldType);
    }
  });
});
