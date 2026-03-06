import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { scaffoldModule } from "../../scripts/module-scaffold.mjs";
import { toSingularLabel } from "../../scripts/module-scaffold/shared.mjs";
import { createTempModulesDir } from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerModuleScaffolderContractCoreBaselineSingularizationSuite() {
test("generates deterministic module artifact set and collision diagnostics", async () => {
  const targetDir = await createTempModulesDir();
  const input = {
    moduleId: "publishers",
    moduleLabel: "Publishers",
    collectionId: "publishers",
    collectionLabel: "Publishers",
    entitySingular: "Publisher",
    icon: "store",
    order: 27,
    idPrefix: "pub",
    targetDir
  };

  const first = await scaffoldModule(input);
  expect(first.ok).toBe(true);
  expect(first.files).toHaveLength(4);

  const moduleDir = path.resolve(targetDir, "publishers");
  const manifestPath = path.resolve(moduleDir, "module.json");
  const handlersPath = path.resolve(moduleDir, "server", "collection-handlers.mjs");

  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const handlersBefore = await fs.readFile(handlersPath, "utf8");

  expect(manifest.id).toBe("publishers");
  expect(manifest.ui.navigation).toEqual(
    expect.objectContaining({
      label: "Publishers",
      icon: "store",
      order: 27
    })
  );
  expect(manifest.collections[0].id).toBe("publishers");
  expect(manifest.collections[0].label).toBe("Publishers");
  expect(manifest.collections[0].entitySingular).toBe("publisher");

  expect(handlersBefore).toContain("registerGeneratedCollectionHandlers");
  expect(handlersBefore).toContain('"collectionId": "publishers"');
  expect(handlersBefore).not.toContain("AUTHOR_TITLE_REQUIRED");

  await expect(scaffoldModule(input)).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PATH_COLLISION"
  });

  await scaffoldModule({
    ...input,
    force: true
  });
  const handlersAfter = await fs.readFile(handlersPath, "utf8");
  expect(handlersAfter).toBe(handlersBefore);
});

test("rejects invalid scaffold inputs with deterministic code", async () => {
  await expect(
    scaffoldModule({
      moduleId: "Publishers"
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_INPUT_INVALID"
  });
});

test("derives singular labels deterministically for common plural forms", () => {
  expect(toSingularLabel("Dispatches")).toBe("Dispatch");
  expect(toSingularLabel("Stories")).toBe("Story");
  expect(toSingularLabel("Categories")).toBe("Category");
  expect(toSingularLabel("Glass")).toBe("Glass");
  expect(toSingularLabel("News")).toBe("News");
});

test("uses corrected singularization when profile entitySingular is omitted", async () => {
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
  const services = await fs.readFile(path.resolve(moduleDir, "server", "runtime-services.mjs"), "utf8");

  const settingsDescriptions = manifest.settings.fields
    .map((field) => `${field.description ?? ""}`.toLowerCase())
    .join(" ");

  expect(settingsDescriptions).toContain("dispatch");
  expect(settingsDescriptions).not.toContain("dispatche");
  expect(manifest.collections[0].entitySingular).toBe("dispatch");
  expect(handlers).toContain('"entitySingular": "dispatch"');
  expect(services.toLowerCase()).toContain("dispatch indexing");
});

test("rejects unsupported scaffold options deterministically", async () => {
  await expect(
    scaffoldModule({
      moduleId: "publishers",
      unsupported: true
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_UNSUPPORTED_OPTION"
  });
});

test("rejects invalid persistence mode deterministically", async () => {
  await expect(
    scaffoldModule({
      moduleId: "publishers",
      persistenceMode: "mongo"
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_INPUT_INVALID",
    details: expect.arrayContaining(["persistenceMode must be one of: auto, file, memory"])
  });

  await expect(
    scaffoldModule({
      profile: {
        moduleId: "editors",
        routeSegment: "editors",
        navigationTitle: "Editors",
        persistenceMode: "mongo",
        collections: [
          {
            id: "editors",
            label: "Editors"
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.persistenceMode must be one of: auto, file, memory"
    ])
  });
});

test("accepts profile-driven scaffold input with deterministic output", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "editors",
      routeSegment: "editors",
      navigationTitle: "Editors",
      collections: [
        {
          id: "editors",
          label: "Editors"
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  expect(result.files).toHaveLength(4);

  const moduleDir = path.resolve(targetDir, "editors");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const handlers = await fs.readFile(
    path.resolve(moduleDir, "server", "collection-handlers.mjs"),
    "utf8"
  );

  expect(manifest.id).toBe("editors");
  expect(manifest.ui.navigation.label).toBe("Editors");
  expect(manifest.collections[0].id).toBe("editors");
  expect(manifest.collections[0].label).toBe("Editors");
  expect(manifest.collections[0].entitySingular).toBe("editor");
  expect(handlers).toContain('moduleId: "editors"');
  expect(handlers).toContain('"collectionId": "editors"');
});

test("accepts profile collection behavior options and emits deterministic behavior descriptors", async () => {
  const targetDir = await createTempModulesDir();

  const result = await scaffoldModule({
    profile: {
      moduleId: "reviews",
      routeSegment: "reviews",
      navigationTitle: "Reviews",
      collections: [
        {
          id: "reviews",
          label: "Reviews",
          behavior: {
            enforceTitleUnique: false,
            requirePublishedOnWhenPublished: false
          }
        }
      ],
      includeSettings: true,
      includeRuntimeServices: true
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  const moduleDir = path.resolve(targetDir, "reviews");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const handlers = await fs.readFile(
    path.resolve(moduleDir, "server", "collection-handlers.mjs"),
    "utf8"
  );

  expect(manifest.collections[0].behavior).toEqual({
    enforcePrimaryFieldUnique: false,
    enforceTitleUnique: false,
    requirePublishedOnWhenPublished: false
  });
  expect(handlers).toContain('"behavior": {');
  expect(handlers).toContain('"enforcePrimaryFieldUnique": false');
  expect(handlers).toContain('"enforceTitleUnique": false');
  expect(handlers).toContain('"requirePublishedOnWhenPublished": false');
});

}

registerModuleScaffolderContractCoreBaselineSingularizationSuite();

export { registerModuleScaffolderContractCoreBaselineSingularizationSuite };
