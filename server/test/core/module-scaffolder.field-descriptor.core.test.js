import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { scaffoldModule } from "../../scripts/module-scaffold.mjs";
import { createTempModulesDir } from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerModuleScaffolderContractCoreFieldDescriptorSuite() {
test("accepts multi-collection profile-driven scaffold input", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "libraries",
      routeSegment: "libraries",
      navigationTitle: "Libraries",
      collections: [
        {
          id: "books",
          label: "Books",
          entitySingular: "Book",
          idPrefix: "bok"
        },
        {
          id: "journals",
          label: "Journals",
          entitySingular: "Journal",
          idPrefix: "jou"
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  expect(result.files).toHaveLength(4);

  const moduleDir = path.resolve(targetDir, "libraries");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const handlers = await fs.readFile(
    path.resolve(moduleDir, "server", "collection-handlers.mjs"),
    "utf8"
  );
  const persistence = await fs.readFile(
    path.resolve(moduleDir, "server", "persistence-plugins.mjs"),
    "utf8"
  );

  expect(manifest.collections.map((collection) => collection.id)).toEqual([
    "books",
    "journals"
  ]);
  expect(handlers).toContain('"collectionId": "books"');
  expect(handlers).toContain('"collectionId": "journals"');
  expect(handlers).not.toContain('"fieldDescriptors": [');
  expect(persistence).toContain("createLibrariesRepository");
  expect(persistence).not.toContain('"fieldDescriptors": [');
});

test("derives deterministic singularization for -es collection labels", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "dispatches",
      routeSegment: "dispatches",
      navigationTitle: "Dispatches",
      collections: [
        {
          id: "dispatches",
          label: "Dispatches"
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);

  const moduleDir = path.resolve(targetDir, "dispatches");
  const manifest = JSON.parse(await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8"));
  const handlers = await fs.readFile(
    path.resolve(moduleDir, "server", "collection-handlers.mjs"),
    "utf8"
  );
  const persistence = await fs.readFile(
    path.resolve(moduleDir, "server", "persistence-plugins.mjs"),
    "utf8"
  );

  expect(manifest.collections[0].entitySingular).toBe("dispatch");
  expect(handlers).toContain('"entitySingular": "dispatch"');
  expect(persistence).toContain('"entitySingular": "dispatch"');
  expect(handlers).not.toContain('"entitySingular": "dispatche"');
  expect(persistence).not.toContain('"entitySingular": "dispatche"');
});

test("applies profile generator primitives and persistence mode to generated artifacts", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "catalogs",
      routeSegment: "catalogs",
      navigationTitle: "Catalogs",
      persistenceMode: "file",
      collections: [
        {
          id: "catalogs",
          label: "Catalogs",
          entitySingular: "Catalog",
          idPrefix: "cat",
          statusOptions: ["draft", "published", "archived"],
          categoryOptions: ["docs", "ops"],
          labelOptions: ["priority", "internal"],
          referenceCollectionId: "authors",
          titleMinLength: 5,
          titleMaxLength: 80,
          includeComputedSlug: false
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);

  const moduleDir = path.resolve(targetDir, "catalogs");
  const manifest = JSON.parse(await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8"));
  const persistence = await fs.readFile(
    path.resolve(moduleDir, "server", "persistence-plugins.mjs"),
    "utf8"
  );

  const fields = manifest.collections[0].fields;
  const titleField = fields.find((field) => field.id === "title");
  const statusField = fields.find((field) => field.id === "status");
  const categoryField = fields.find((field) => field.id === "category");
  const labelsField = fields.find((field) => field.id === "labels");
  const recordIdField = fields.find((field) => field.id === "recordId");
  const slugField = fields.find((field) => field.id === "slug");

  expect(titleField).toEqual(
    expect.objectContaining({
      minLength: 5,
      maxLength: 80
    })
  );
  expect(statusField?.options).toEqual(["draft", "published", "archived"]);
  expect(categoryField?.options).toEqual(["docs", "ops"]);
  expect(labelsField?.options).toEqual(["priority", "internal"]);
  expect(recordIdField?.collectionId).toBe("authors");
  expect(slugField).toBeUndefined();

  expect(persistence).toContain('const CATALOGS_PERSISTENCE_MODE = "file";');
  expect(persistence).toContain("persistenceMode: CATALOGS_PERSISTENCE_MODE");
  expect(persistence).toContain("persistenceMode: options.persistenceMode ?? CATALOGS_PERSISTENCE_MODE");
  expect(persistence).toContain('"collectionId": "catalogs"');
  expect(persistence).not.toContain('"fieldDescriptors": [');
  expect(persistence).not.toContain('"referenceCollectionId"');
  expect(persistence).not.toContain('"primaryFieldMinLength"');
  expect(persistence).not.toContain('"includeComputedSlug"');
});

test("accepts canonical primary-field length profile options and emits lean runtime descriptors", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "handbooks",
      routeSegment: "handbooks",
      navigationTitle: "Handbooks",
      collections: [
        {
          id: "handbooks",
          label: "Handbooks",
          primaryFieldMinLength: 6,
          primaryFieldMaxLength: 90
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);

  const moduleDir = path.resolve(targetDir, "handbooks");
  const manifest = JSON.parse(await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8"));
  const handlers = await fs.readFile(
    path.resolve(moduleDir, "server", "collection-handlers.mjs"),
    "utf8"
  );

  const titleField = manifest.collections[0].fields.find((field) => field.id === "title");
  expect(titleField).toEqual(
    expect.objectContaining({
      minLength: 6,
      maxLength: 90
    })
  );
  expect(handlers).toContain('"collectionId": "handbooks"');
  expect(handlers).not.toContain('"primaryFieldMinLength"');
  expect(handlers).not.toContain('"titleMinLength"');
});

test("accepts profile extraFields primitives and emits deterministic manifest/runtime artifacts", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "briefs",
      routeSegment: "briefs",
      navigationTitle: "Briefs",
      collections: [
        {
          id: "briefs",
          label: "Briefs",
          entitySingular: "Brief",
          idPrefix: "brf",
          extraFields: [
            {
              id: "summary",
              label: "Summary",
              type: "text",
              required: false,
              minLength: 0,
              maxLength: 240
            },
            {
              id: "ownerId",
              label: "Owner",
              type: "reference",
              required: false,
              collectionId: "authors"
            },
            {
              id: "collaboratorIds",
              label: "Collaborators",
              type: "reference-multi",
              required: false,
              collectionId: "authors"
            },
            {
              id: "tags",
              label: "Tags",
              type: "enum-multi",
              required: false,
              options: ["design", "ops"]
            },
            {
              id: "priority",
              label: "Priority",
              type: "number",
              required: false,
              min: 0,
              max: 10
            },
            {
              id: "published",
              label: "Published",
              type: "boolean",
              required: false
            },
            {
              id: "summarySlug",
              label: "Summary Slug",
              type: "computed",
              source: "summary"
            }
          ]
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);

  const moduleDir = path.resolve(targetDir, "briefs");
  const manifest = JSON.parse(await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8"));
  const handlers = await fs.readFile(
    path.resolve(moduleDir, "server", "collection-handlers.mjs"),
    "utf8"
  );

  const fields = manifest.collections[0].fields;
  expect(fields.find((field) => field.id === "summary")).toEqual(
    expect.objectContaining({
      type: "text",
      maxLength: 240
    })
  );
  expect(fields.find((field) => field.id === "ownerId")).toEqual(
    expect.objectContaining({
      type: "reference",
      collectionId: "authors"
    })
  );
  expect(fields.find((field) => field.id === "collaboratorIds")).toEqual(
    expect.objectContaining({
      type: "reference-multi",
      collectionId: "authors"
    })
  );
  expect(fields.find((field) => field.id === "tags")).toEqual(
    expect.objectContaining({
      type: "enum-multi",
      options: ["design", "ops"]
    })
  );
  expect(fields.find((field) => field.id === "priority")).toEqual(
    expect.objectContaining({
      type: "number",
      min: 0,
      max: 10
    })
  );
  expect(fields.find((field) => field.id === "published")).toEqual(
    expect.objectContaining({
      type: "boolean"
    })
  );
  expect(fields.find((field) => field.id === "summarySlug")).toEqual(
    expect.objectContaining({
      type: "computed",
      source: "summary",
      resolver: "slugify",
      transform: "slugify"
    })
  );

  expect(handlers).toContain('"collectionId": "briefs"');
  expect(handlers).not.toContain('"extraFields": [');
  expect(handlers).not.toContain('"fieldDescriptors": [');
});

test("accepts explicit collection field descriptors and emits descriptor-driven artifacts", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "dispatches",
      routeSegment: "dispatches",
      navigationTitle: "Dispatches",
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          entitySingular: "Dispatch",
          idPrefix: "dsp",
          fields: [
            {
              id: "title",
              label: "Title",
              type: "text",
              required: true,
              minLength: 5,
              maxLength: 64
            },
            {
              id: "phase",
              label: "Phase",
              type: "enum",
              required: true,
              options: ["queued", "active", "closed"]
            },
            {
              id: "ownerId",
              label: "Owner",
              type: "reference",
              required: false,
              collectionId: "authors"
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
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);

  const moduleDir = path.resolve(targetDir, "dispatches");
  const manifest = JSON.parse(await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8"));
  const handlers = await fs.readFile(
    path.resolve(moduleDir, "server", "collection-handlers.mjs"),
    "utf8"
  );

  expect(manifest.collections[0].fields).toEqual([
    {
      id: "title",
      label: "Title",
      type: "text",
      required: true,
      minLength: 5,
      maxLength: 64
    },
    {
      id: "phase",
      label: "Phase",
      type: "enum",
      required: true,
      options: ["queued", "active", "closed"]
    },
    {
      id: "ownerId",
      label: "Owner",
      type: "reference",
      required: false,
      collectionId: "authors"
    },
    {
      id: "dispatchCode",
      label: "Dispatch Code",
      type: "computed",
      required: false,
      source: "title",
      resolver: "uppercase",
      transform: "uppercase"
    }
  ]);
  expect(handlers).toContain('"collectionId": "dispatches"');
  expect(handlers).not.toContain('"fieldDescriptors": [');
  expect(handlers).not.toContain('"resolver": "uppercase"');
});

test("accepts descriptor-driven profile primaryField and emits deterministic primaryField descriptors", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "dispatches",
      routeSegment: "dispatches",
      navigationTitle: "Dispatches",
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          primaryField: "name",
          fields: [
            {
              id: "name",
              label: "Name",
              type: "text",
              required: true,
              minLength: 2,
              maxLength: 80
            },
            {
              id: "dispatchCode",
              label: "Dispatch Code",
              type: "computed",
              source: "name",
              resolver: "uppercase"
            }
          ]
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);

  const moduleDir = path.resolve(targetDir, "dispatches");
  const manifest = JSON.parse(await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8"));
  const handlers = await fs.readFile(
    path.resolve(moduleDir, "server", "collection-handlers.mjs"),
    "utf8"
  );

  expect(manifest.collections[0].primaryField).toBe("name");
  expect(manifest.collections[0].fields).toEqual([
    {
      id: "name",
      label: "Name",
      type: "text",
      required: true,
      minLength: 2,
      maxLength: 80
    },
    {
      id: "dispatchCode",
      label: "Dispatch Code",
      type: "computed",
      required: false,
      source: "name",
      resolver: "uppercase",
      transform: "uppercase"
    }
  ]);
  expect(handlers).toContain('"primaryField": "name"');
});

}

registerModuleScaffolderContractCoreFieldDescriptorSuite();

export { registerModuleScaffolderContractCoreFieldDescriptorSuite };
