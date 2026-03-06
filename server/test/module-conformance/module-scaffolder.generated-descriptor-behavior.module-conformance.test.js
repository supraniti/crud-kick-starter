import { expect, test } from "vitest";
import { registerGeneratedCollectionHandlers } from "../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime.mjs";
import { createMutationPipeline, createSchemaTypeRegistry } from "../../src/core/index.js";
import {
  createBadRequestPayload,
  createCollectionHandlerRegistryStub,
  createRepositoryStub
} from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerGeneratedRuntimeDescriptorBehaviorSuite() {
test("respects canonical behavior descriptors for primary-field uniqueness and publish-date requirement", async () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

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
              required: true,
              minLength: 3,
              maxLength: 120
            },
            {
              id: "status",
              type: "enum",
              required: true,
              options: ["draft", "published"]
            },
            {
              id: "category",
              type: "enum",
              required: true,
              options: ["news", "ops"]
            },
            {
              id: "labels",
              type: "enum-multi",
              required: false,
              options: ["featured"]
            },
            {
              id: "publishedOn",
              type: "date",
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
        idPrefix: "wid",
        behavior: {
          enforcePrimaryFieldUnique: false,
          requirePublishedOnWhenPublished: false
        }
      }
    ]
  });

  const handler = registry.handlers.get("widgets");
  expect(handler).toBeDefined();

  const firstValidation = await handler.validateInput({
    title: "Behavior Override Widget",
    status: "published",
    category: "news",
    labels: ["featured"],
    publishedOn: null
  });
  expect(firstValidation.ok).toBe(true);

  const firstCreate = await handler.create({
    value: firstValidation.value,
    reply: {}
  });
  expect(firstCreate.ok).toBe(true);

  const secondValidation = await handler.validateInput({
    title: "Behavior Override Widget",
    status: "published",
    category: "ops",
    labels: [],
    publishedOn: null
  });
  expect(secondValidation.ok).toBe(true);

  const secondCreate = await handler.create({
    value: secondValidation.value,
    reply: {}
  });
  expect(secondCreate.ok).toBe(true);

  const listResult = await handler.list({});
  expect(listResult.items).toHaveLength(2);
});

test("falls back to manifest behavior descriptors when collection behavior config is omitted", async () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

  registerGeneratedCollectionHandlers({
    registry,
    manifest: {
      id: "widgets",
      collections: [
        {
          id: "widgets",
          behavior: {
            enforcePrimaryFieldUnique: false,
            requirePublishedOnWhenPublished: false
          },
          fields: [
            {
              id: "title",
              type: "text",
              required: true,
              minLength: 3,
              maxLength: 120
            },
            {
              id: "status",
              type: "enum",
              required: true,
              options: ["draft", "published"]
            },
            {
              id: "category",
              type: "enum",
              required: true,
              options: ["news", "ops"]
            },
            {
              id: "labels",
              type: "enum-multi",
              required: false,
              options: ["featured"]
            },
            {
              id: "publishedOn",
              type: "date",
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

  const handler = registry.handlers.get("widgets");
  expect(handler).toBeDefined();

  const firstValidation = await handler.validateInput({
    title: "Manifest Behavior Widget",
    status: "published",
    category: "news",
    labels: ["featured"],
    publishedOn: null
  });
  expect(firstValidation.ok).toBe(true);

  const firstCreate = await handler.create({
    value: firstValidation.value,
    reply: {}
  });
  expect(firstCreate.ok).toBe(true);

  const secondValidation = await handler.validateInput({
    title: "Manifest Behavior Widget",
    status: "published",
    category: "ops",
    labels: [],
    publishedOn: null
  });
  expect(secondValidation.ok).toBe(true);

  const secondCreate = await handler.create({
    value: secondValidation.value,
    reply: {}
  });
  expect(secondCreate.ok).toBe(true);
});

test("preserves legacy behavior key compatibility for uniqueness override", async () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };

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
              required: true,
              minLength: 3,
              maxLength: 120
            },
            {
              id: "status",
              type: "enum",
              required: true,
              options: ["draft", "published"]
            },
            {
              id: "category",
              type: "enum",
              required: true,
              options: ["news", "ops"]
            },
            {
              id: "labels",
              type: "enum-multi",
              required: false,
              options: ["featured"]
            },
            {
              id: "publishedOn",
              type: "date",
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
        idPrefix: "wid",
        behavior: {
          enforceTitleUnique: false,
          requirePublishedOnWhenPublished: false
        }
      }
    ]
  });

  const handler = registry.handlers.get("widgets");
  expect(handler).toBeDefined();

  const firstValidation = await handler.validateInput({
    title: "Legacy Behavior Override Widget",
    status: "published",
    category: "news",
    labels: ["featured"],
    publishedOn: null
  });
  expect(firstValidation.ok).toBe(true);

  const firstCreate = await handler.create({
    value: firstValidation.value,
    reply: {}
  });
  expect(firstCreate.ok).toBe(true);

  const secondValidation = await handler.validateInput({
    title: "Legacy Behavior Override Widget",
    status: "published",
    category: "ops",
    labels: [],
    publishedOn: null
  });
  expect(secondValidation.ok).toBe(true);

  const secondCreate = await handler.create({
    value: secondValidation.value,
    reply: {}
  });
  expect(secondCreate.ok).toBe(true);
});

test("returns deterministic custom-reference validation diagnostics", async () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: [
      {
        id: "rec-001",
        title: "Record One"
      }
    ]
  };
  const authorsRepository = createRepositoryStub({
    authors: []
  });

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
              options: ["draft", "review", "published"]
            },
            {
              id: "category",
              type: "enum",
              required: true,
              options: ["news", "guide", "ops"]
            },
            {
              id: "labels",
              type: "enum-multi",
              required: false,
              options: ["featured", "engineering", "release"]
            },
            {
              id: "publishedOn",
              type: "date",
              required: false
            },
            {
              id: "recordId",
              type: "reference",
              required: false,
              collectionId: "records"
            },
            {
              id: "ownerId",
              type: "reference",
              required: false,
              collectionId: "authors"
            }
          ]
        }
      ]
    },
    state,
    createMutationPipeline,
    createSchemaTypeRegistry,
    badRequest: createBadRequestPayload,
    resolveCollectionRepository: (collectionId) =>
      collectionId === "authors" ? authorsRepository : null,
    moduleId: "widgets",
    collections: [
      {
        collectionId: "widgets",
        entitySingular: "widget",
        idPrefix: "wid"
      }
    ]
  });

  const handler = registry.handlers.get("widgets");
  const validation = await handler.validateInput({
    title: "Widget Missing Owner",
    status: "draft",
    category: "news",
    labels: ["featured"],
    recordId: "rec-001",
    ownerId: "aut-404"
  });
  expect(validation.ok).toBe(false);
  expect(validation.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "WIDGET_OWNER_ID_NOT_FOUND",
        fieldId: "ownerId"
      })
    ])
  );
});

}

registerGeneratedRuntimeDescriptorBehaviorSuite();

export { registerGeneratedRuntimeDescriptorBehaviorSuite };

