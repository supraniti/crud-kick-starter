import { expect, test } from "vitest";
import { registerGeneratedCollectionHandlers } from "../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime.mjs";
import { createMutationPipeline, createSchemaTypeRegistry } from "../../src/core/index.js";
import {
  createBadRequestPayload,
  createCollectionHandlerRegistryStub
} from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerGeneratedRuntimeDescriptorValidationSuite() {
test("rejects invalid generated primaryField descriptors deterministically", () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

  try {
    registerGeneratedCollectionHandlers({
      registry,
      manifest: {
        id: "widgets",
        collections: [
          {
            id: "widgets",
            primaryField: "status",
            fields: [
              {
                id: "status",
                type: "enum",
                required: true,
                options: ["draft", "published"]
              }
            ]
          }
        ]
      },
      state,
      createMutationPipeline,
      createSchemaTypeRegistry,
      badRequest: createBadRequestPayload,
      moduleId: "widgets",
      collections: [
        {
          collectionId: "widgets",
          entitySingular: "widget",
          idPrefix: "wid",
          primaryField: "status"
        }
      ]
    });
    throw new Error("Expected invalid primaryField registration to throw");
  } catch (error) {
    expect(error?.code).toBe("GENERATED_COLLECTION_CONFIG_INVALID");
    expect(error?.message).toBe(
      "Generated collection 'widgets' requires primaryField 'status' to use field type 'text'"
    );
  }
});

test("rejects unsupported manifest field families deterministically", () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

  try {
    registerGeneratedCollectionHandlers({
      registry,
      manifest: {
        id: "widgets",
        collections: [
          {
            id: "widgets",
            fields: [
              {
                id: "title",
                type: "text",
                required: true
              },
              {
                id: "metadata",
                type: "json",
                required: false
              }
            ]
          }
        ]
      },
      state,
      createMutationPipeline,
      createSchemaTypeRegistry,
      badRequest: createBadRequestPayload,
      moduleId: "widgets",
      collections: [
        {
          collectionId: "widgets",
          entitySingular: "widget",
          idPrefix: "wid"
        }
      ]
    });
    throw new Error("Expected unsupported field registration to throw");
  } catch (error) {
    expect(error?.code).toBe("GENERATED_COLLECTION_FIELD_TYPE_UNSUPPORTED");
    expect(error?.details).toEqual(
      expect.arrayContaining([
        "collections.widgets.fields[1] 'metadata' uses unsupported type 'json'"
      ])
    );
  }
});

test("rejects unsupported computed resolvers deterministically", () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

  try {
    registerGeneratedCollectionHandlers({
      registry,
      manifest: {
        id: "widgets",
        collections: [
          {
            id: "widgets",
            fields: [
              {
                id: "title",
                type: "text",
                required: true
              },
              {
                id: "slug",
                type: "computed",
                source: "title",
                resolver: "reverse"
              }
            ]
          }
        ]
      },
      state,
      createMutationPipeline,
      createSchemaTypeRegistry,
      badRequest: createBadRequestPayload,
      moduleId: "widgets",
      collections: [
        {
          collectionId: "widgets",
          entitySingular: "widget",
          idPrefix: "wid"
        }
      ]
    });
    throw new Error("Expected unsupported computed resolver registration to throw");
  } catch (error) {
    expect(error?.code).toBe("GENERATED_COLLECTION_FIELD_TYPE_UNSUPPORTED");
    expect(error?.details).toEqual(
      expect.arrayContaining([
        "collections.widgets.fields[1] 'slug' uses unsupported computed resolver 'reverse'"
      ])
    );
  }
});

test("rejects invalid manifest field defaults deterministically", () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

  try {
    registerGeneratedCollectionHandlers({
      registry,
      manifest: {
        id: "widgets",
        collections: [
          {
            id: "widgets",
            fields: [
              {
                id: "title",
                type: "text",
                required: true
              },
              {
                id: "status",
                type: "enum",
                required: true,
                options: ["draft", "review"],
                defaultValue: "published"
              }
            ]
          }
        ]
      },
      state,
      createMutationPipeline,
      createSchemaTypeRegistry,
      badRequest: createBadRequestPayload,
      moduleId: "widgets",
      collections: [
        {
          collectionId: "widgets",
          entitySingular: "widget",
          idPrefix: "wid"
        }
      ]
    });
    throw new Error("Expected invalid default registration to throw");
  } catch (error) {
    expect(error?.code).toBe("GENERATED_COLLECTION_FIELD_TYPE_UNSUPPORTED");
    expect(error?.details).toEqual(
      expect.arrayContaining([
        "collections.widgets.fields[1] 'status' has invalid defaultValue: defaultValue 'published' is not in options"
      ])
    );
  }
});

test("rejects unsupported collection behavior descriptors deterministically", () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

  try {
    registerGeneratedCollectionHandlers({
      registry,
      manifest: {
        id: "widgets",
        collections: [
          {
            id: "widgets",
            fields: [
              {
                id: "title",
                type: "text",
                required: true
              }
            ]
          }
        ]
      },
      state,
      createMutationPipeline,
      createSchemaTypeRegistry,
      badRequest: createBadRequestPayload,
      moduleId: "widgets",
      collections: [
        {
          collectionId: "widgets",
          entitySingular: "widget",
          idPrefix: "wid",
          behavior: {
            unsupportedBehaviorField: true
          }
        }
      ]
    });
    throw new Error("Expected unsupported behavior registration to throw");
  } catch (error) {
    expect(error?.code).toBe("GENERATED_COLLECTION_BEHAVIOR_UNSUPPORTED");
    expect(error?.details).toEqual(
      expect.arrayContaining([
        "collections.widgets.behavior.unsupportedBehaviorField is not supported"
      ])
    );
  }
});

test("rejects conflicting generated behavior compatibility values deterministically", () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

  try {
    registerGeneratedCollectionHandlers({
      registry,
      manifest: {
        id: "widgets",
        collections: [
          {
            id: "widgets",
            fields: [
              {
                id: "title",
                type: "text",
                required: true
              }
            ]
          }
        ]
      },
      state,
      createMutationPipeline,
      createSchemaTypeRegistry,
      badRequest: createBadRequestPayload,
      moduleId: "widgets",
      collections: [
        {
          collectionId: "widgets",
          entitySingular: "widget",
          idPrefix: "wid",
          behavior: {
            enforcePrimaryFieldUnique: true,
            enforceTitleUnique: false
          }
        }
      ]
    });
    throw new Error("Expected conflicting behavior registration to throw");
  } catch (error) {
    expect(error?.code).toBe("GENERATED_COLLECTION_BEHAVIOR_UNSUPPORTED");
    expect(error?.details).toEqual(
      expect.arrayContaining([
        "collections.widgets.behavior.enforcePrimaryFieldUnique and enforceTitleUnique must match when both are provided"
      ])
    );
  }
});

test("rejects conflicting generated length compatibility values deterministically", () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

  try {
    registerGeneratedCollectionHandlers({
      registry,
      manifest: {
        id: "widgets",
        collections: [
          {
            id: "widgets",
            fields: [
              {
                id: "title",
                type: "text",
                required: true
              }
            ]
          }
        ]
      },
      state,
      createMutationPipeline,
      createSchemaTypeRegistry,
      badRequest: createBadRequestPayload,
      moduleId: "widgets",
      collections: [
        {
          collectionId: "widgets",
          entitySingular: "widget",
          idPrefix: "wid",
          primaryFieldMinLength: 5,
          titleMinLength: 3
        }
      ]
    });
    throw new Error("Expected conflicting length registration to throw");
  } catch (error) {
    expect(error?.code).toBe("GENERATED_COLLECTION_CONFIG_INVALID");
    expect(error?.details).toEqual(
      expect.arrayContaining([
        "collections.widgets.primaryFieldMinLength and titleMinLength must match when both are provided"
      ])
    );
  }
});
}

registerGeneratedRuntimeDescriptorValidationSuite();

export { registerGeneratedRuntimeDescriptorValidationSuite };
