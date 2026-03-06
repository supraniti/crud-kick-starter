import { expect, test } from "vitest";
import { registerGeneratedCollectionHandlers } from "../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime.mjs";
import { createMutationPipeline, createSchemaTypeRegistry } from "../../src/core/index.js";
import {
  createBadRequestPayload,
  createCollectionHandlerRegistryStub,
  createRepositoryStub
} from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerGeneratedRuntimeDescriptorFieldsSuite() {
test("supports descriptor-driven extra fields, query filters, and reference title hydration", async () => {
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
    authors: [
      {
        id: "aut-001",
        title: "Alice Doe"
      },
      {
        id: "aut-002",
        title: "Bob Roe"
      }
    ]
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
              required: true,
              minLength: 3,
              maxLength: 120
            },
            {
              id: "status",
              type: "enum",
              required: true,
              options: ["draft", "review", "published"],
              defaultValue: "draft"
            },
            {
              id: "category",
              type: "enum",
              required: true,
              options: ["news", "guide", "ops"],
              defaultValue: "news"
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
              id: "summary",
              type: "text",
              required: false,
              minLength: 0,
              maxLength: 240
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
              id: "owner-id",
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
              id: "collaborator-ids",
              type: "reference-multi",
              required: false,
              collectionId: "authors"
            },
            {
              id: "tags",
              type: "enum-multi",
              required: false,
              options: ["design", "ops"]
            },
            {
              id: "score",
              type: "number",
              required: false,
              min: 0,
              max: 10
            },
            {
              id: "featured",
              type: "boolean",
              required: false
            },
            {
              id: "slug",
              type: "computed",
              source: "title"
            },
            {
              id: "summarySlug",
              type: "computed",
              source: "summary"
            },
            {
              id: "summaryCode",
              type: "computed",
              source: "summary",
              transform: "uppercase"
            },
            {
              id: "summaryTrim",
              type: "computed",
              source: "summary",
              resolver: "trim"
            },
            {
              id: "summaryTitle",
              type: "computed",
              source: "summary",
              resolver: "titlecase"
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
  expect(handler).toBeDefined();

  const validation = await handler.validateInput({
    title: "Widget Runtime Generalization",
    labels: ["featured", "engineering"],
    publishedOn: null,
    recordId: "rec-001",
    summary: "Descriptor   driven runtime  behavior",
    sourceUrl: "https://widgets.example.test/runtime-proof",
    ownerId: "aut-001",
    "owner-id": "aut-002",
    collaboratorIds: ["aut-001", "aut-002"],
    "collaborator-ids": ["aut-001", "aut-002"],
    tags: ["design"],
    score: "7.5",
    featured: "true"
  });
  expect(validation.ok).toBe(true);

  const createResult = await handler.create({
    value: validation.value,
    reply: {}
  });
  expect(createResult.ok).toBe(true);
  expect(createResult.item).toEqual(
    expect.objectContaining({
      title: "Widget Runtime Generalization",
      status: "draft",
      category: "news",
      summary: "Descriptor   driven runtime  behavior",
      sourceUrl: "https://widgets.example.test/runtime-proof",
      ownerId: "aut-001",
      "owner-id": "aut-002",
      collaboratorIds: ["aut-001", "aut-002"],
      "collaborator-ids": ["aut-001", "aut-002"],
      tags: ["design"],
      score: 7.5,
      featured: true,
      slug: "widget-runtime-generalization",
      summarySlug: "descriptor-driven-runtime-behavior",
      summaryCode: "DESCRIPTOR   DRIVEN RUNTIME  BEHAVIOR",
      summaryTrim: "Descriptor driven runtime behavior",
      summaryTitle: "Descriptor Driven Runtime Behavior"
    })
  );

  const listResult = await handler.list({
    ownerId: "aut-001",
    "owner-id": "aut-002",
    collaboratorId: "aut-002",
    "collaborator-id": "aut-001",
    tags: "design",
    score: "7.5",
    featured: "true",
    search: "widget"
  });
  expect(listResult.items).toHaveLength(1);
  expect(listResult.items[0]).toEqual(
    expect.objectContaining({
      ownerId: "aut-001",
      ownerTitle: "Alice Doe",
      ownerIdTitle: "Alice Doe",
      "owner-id": "aut-002",
      "owner-title": "Bob Roe",
      collaboratorIds: ["aut-001", "aut-002"],
      collaboratorTitles: ["Alice Doe", "Bob Roe"],
      "collaborator-ids": ["aut-001", "aut-002"],
      "collaborator-titles": ["Alice Doe", "Bob Roe"],
      recordId: "rec-001",
      recordTitle: "Record One",
      score: 7.5,
      featured: true,
      summarySlug: "descriptor-driven-runtime-behavior"
    })
  );
  expect(listResult.filters).toEqual(
    expect.objectContaining({
      ownerId: "aut-001",
      "owner-id": "aut-002",
      collaboratorIds: ["aut-002"],
      "collaborator-ids": ["aut-001"],
      tags: ["design"],
      score: 7.5,
      featured: true,
      search: "widget"
    })
  );

  const invalidUrlValidation = await handler.validateInput({
    title: "Widget Invalid URL",
    status: "review",
    category: "guide",
    labels: ["featured"],
    sourceUrl: "ftp://widgets.example.test/invalid"
  });
  expect(invalidUrlValidation.ok).toBe(false);
  expect(invalidUrlValidation.errors).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: "WIDGET_SOURCE_URL_INVALID_URL"
      })
    ])
  );
});

test("honors manifest primaryField ownership for search, sort, and conflict semantics", async () => {
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
          primaryField: "name",
          fields: [
            {
              id: "name",
              type: "text",
              required: true,
              minLength: 2,
              maxLength: 80
            },
            {
              id: "nameSlug",
              type: "computed",
              source: "name"
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
        primaryField: "name"
      }
    ]
  });

  const handler = registry.handlers.get("widgets");
  expect(handler).toBeDefined();

  const zuluValidation = await handler.validateInput({
    name: "Zulu Widget"
  });
  expect(zuluValidation.ok).toBe(true);
  const zuluCreate = await handler.create({
    value: zuluValidation.value,
    reply: {}
  });
  expect(zuluCreate.ok).toBe(true);
  expect(zuluCreate.item.nameSlug).toBe("zulu-widget");

  const alphaValidation = await handler.validateInput({
    name: "Alpha Widget"
  });
  expect(alphaValidation.ok).toBe(true);
  const alphaCreate = await handler.create({
    value: alphaValidation.value,
    reply: {}
  });
  expect(alphaCreate.ok).toBe(true);
  expect(alphaCreate.item.nameSlug).toBe("alpha-widget");

  const sortedList = await handler.list({});
  expect(sortedList.items.map((item) => item.name)).toEqual([
    "Alpha Widget",
    "Zulu Widget"
  ]);

  const searchList = await handler.list({
    search: "alpha"
  });
  expect(searchList.items).toHaveLength(1);
  expect(searchList.items[0].name).toBe("Alpha Widget");
  expect(searchList.filters.search).toBe("alpha");

  const duplicateValidation = await handler.validateInput({
    name: "Alpha Widget"
  });
  expect(duplicateValidation.ok).toBe(true);
  const duplicateCreate = await handler.create({
    value: duplicateValidation.value,
    reply: {}
  });
  expect(duplicateCreate.ok).toBe(false);
  expect(duplicateCreate.statusCode).toBe(409);
  expect(duplicateCreate.payload.error).toEqual(
    expect.objectContaining({
      code: "WIDGET_NAME_CONFLICT",
      message: "Widget name 'Alpha Widget' already exists"
    })
  );
});

test("applies settings-driven computed resolver options via module settings repository", async () => {
  const registry = createCollectionHandlerRegistryStub();
  const state = {
    records: []
  };
  const settingsRepository = createRepositoryStub({
    widgets: {
      slugMaxLength: 8
    }
  });

  registerGeneratedCollectionHandlers({
    registry,
    manifest: {
      id: "widgets",
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "slugMaxLength",
            label: "Slug Max Length",
            type: "number",
            required: true,
            min: 1,
            max: 120,
            defaultValue: 64
          }
        ]
      },
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
    },
    state,
    createMutationPipeline,
    createSchemaTypeRegistry,
    badRequest: createBadRequestPayload,
    resolveSettingsRepository: (moduleId) =>
      moduleId === "widgets" ? settingsRepository : null,
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

  const createValidation = await handler.validateInput({
    title: "Resolver Settings Runtime"
  });
  expect(createValidation.ok).toBe(true);
  const createResult = await handler.create({
    value: createValidation.value,
    reply: {}
  });
  expect(createResult.ok).toBe(true);
  expect(createResult.item.slug).toBe("resolver");

  await settingsRepository.transact(async (workingState) => {
    workingState.widgets = {
      slugMaxLength: 13
    };
    return {
      commit: true,
      value: null
    };
  });

  const itemId = createResult.item.id;
  const updateValidation = await handler.validateInput({
    title: "Settings Runtime Updated"
  });
  expect(updateValidation.ok).toBe(true);
  const updateResult = await handler.update({
    body: {
      title: "Settings Runtime Updated"
    },
    value: updateValidation.value,
    item: {
      id: itemId
    },
    reply: {}
  });
  expect(updateResult.ok).toBe(true);
  expect(updateResult.item.slug).toBe("settings-runt");
});

test("uses collection fieldDescriptors when manifest collection fields are omitted", async () => {
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
          fields: []
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
        fieldDescriptors: [
          {
            id: "title",
            label: "Title",
            type: "text",
            required: true,
            minLength: 3,
            maxLength: 120
          },
          {
            id: "status",
            label: "Status",
            type: "enum",
            required: true,
            options: ["draft", "live"]
          },
          {
            id: "category",
            label: "Category",
            type: "enum",
            required: true,
            options: ["news", "ops"]
          },
          {
            id: "labels",
            label: "Labels",
            type: "enum-multi",
            required: false,
            options: ["featured"]
          },
          {
            id: "publishedOn",
            label: "Published On",
            type: "date",
            required: false
          },
          {
            id: "dispatchCode",
            label: "Dispatch Code",
            type: "computed",
            source: "title",
            transform: "uppercase"
          }
        ]
      }
    ]
  });

  const handler = registry.handlers.get("widgets");
  expect(handler).toBeDefined();

  const validation = await handler.validateInput({
    title: "Descriptor Backed Widget",
    status: "live",
    category: "ops",
    labels: ["featured"],
    publishedOn: null
  });
  expect(validation.ok).toBe(true);

  const createResult = await handler.create({
    value: validation.value,
    reply: {}
  });
  expect(createResult.ok).toBe(true);
  expect(createResult.item).toEqual(
    expect.objectContaining({
      title: "Descriptor Backed Widget",
      status: "live",
      category: "ops",
      dispatchCode: "DESCRIPTOR BACKED WIDGET"
    })
  );
});

}

registerGeneratedRuntimeDescriptorFieldsSuite();

export { registerGeneratedRuntimeDescriptorFieldsSuite };
