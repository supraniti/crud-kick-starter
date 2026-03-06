import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import {
  createGeneratedCollectionsRepository,
  resolveGeneratedModulePersistencePolicy
} from "../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime.mjs";
import { createTempModulesDir } from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerGeneratedCollectionPersistencePolicySuite() {
test("resolves default and module override modes deterministically", () => {
  const previousGlobal = process.env.CRUD_CONTROL_GENERATED_MODULE_PERSISTENCE_MODE;
  const previousModule = process.env.CRUD_CONTROL_GENERATED_MODULE_PUBLISHERS_PERSISTENCE_MODE;

  try {
    process.env.CRUD_CONTROL_GENERATED_MODULE_PERSISTENCE_MODE = "memory";
    process.env.CRUD_CONTROL_GENERATED_MODULE_PUBLISHERS_PERSISTENCE_MODE = "file";

    const policy = resolveGeneratedModulePersistencePolicy({
      moduleId: "publishers"
    });
    expect(policy.configuredMode).toBe("file");
    expect(policy.runtimeMode).toBe("file");
    expect(policy.mode).toBe("file");
    expect(policy.source).toBe("module-env");

    process.env.CRUD_CONTROL_GENERATED_MODULE_PUBLISHERS_PERSISTENCE_MODE = "invalid";
    expect(() =>
      resolveGeneratedModulePersistencePolicy({
        moduleId: "publishers"
      })
    ).toThrowError(/not supported/);
  } finally {
    if (previousGlobal === undefined) {
      delete process.env.CRUD_CONTROL_GENERATED_MODULE_PERSISTENCE_MODE;
    } else {
      process.env.CRUD_CONTROL_GENERATED_MODULE_PERSISTENCE_MODE = previousGlobal;
    }

    if (previousModule === undefined) {
      delete process.env.CRUD_CONTROL_GENERATED_MODULE_PUBLISHERS_PERSISTENCE_MODE;
    } else {
      process.env.CRUD_CONTROL_GENERATED_MODULE_PUBLISHERS_PERSISTENCE_MODE = previousModule;
    }
  }
});

test("keeps configured auto mode while resolving runtime mode deterministically", () => {
  const previousGlobal = process.env.CRUD_CONTROL_GENERATED_MODULE_PERSISTENCE_MODE;
  const previousModule = process.env.CRUD_CONTROL_GENERATED_MODULE_AUTHORS_PERSISTENCE_MODE;

  try {
    delete process.env.CRUD_CONTROL_GENERATED_MODULE_PERSISTENCE_MODE;
    delete process.env.CRUD_CONTROL_GENERATED_MODULE_AUTHORS_PERSISTENCE_MODE;

    const policy = resolveGeneratedModulePersistencePolicy({
      moduleId: "authors"
    });

    expect(policy.configuredMode).toBe("auto");
    expect(policy.runtimeMode).toBe("memory");
    expect(policy.source).toBe("default");
  } finally {
    if (previousGlobal === undefined) {
      delete process.env.CRUD_CONTROL_GENERATED_MODULE_PERSISTENCE_MODE;
    } else {
      process.env.CRUD_CONTROL_GENERATED_MODULE_PERSISTENCE_MODE = previousGlobal;
    }

    if (previousModule === undefined) {
      delete process.env.CRUD_CONTROL_GENERATED_MODULE_AUTHORS_PERSISTENCE_MODE;
    } else {
      process.env.CRUD_CONTROL_GENERATED_MODULE_AUTHORS_PERSISTENCE_MODE = previousModule;
    }
  }
});

test("repository honors explicit memory/file persistence mode", async () => {
  const tempDir = await createTempModulesDir();
  const filePath = path.resolve(tempDir, "widgets-state.json");

  const memoryRepository = createGeneratedCollectionsRepository({
    moduleId: "widgets",
    collections: [
      {
        collectionId: "widgets",
        entitySingular: "widget",
        idPrefix: "wid"
      }
    ],
    stateFilePath: filePath,
    persistenceMode: "memory"
  });
  expect(memoryRepository.describePolicy()).toEqual(
    expect.objectContaining({
      configuredMode: "memory",
      runtimeMode: "memory",
      source: "input",
      stateFilePath: null
    })
  );

  await memoryRepository.transact(async (workingState) => {
    workingState.widgets.push({
      id: "wid-001",
      title: "Memory Widget",
      status: "draft",
      category: "news",
      labels: [],
      publishedOn: null,
      recordId: null,
      slug: "memory-widget"
    });
    workingState.nextWidgetNumber = 2;
    return {
      commit: true,
      value: null
    };
  });

  const memoryFileExists = await fs
    .stat(filePath)
    .then(() => true)
    .catch(() => false);
  expect(memoryFileExists).toBe(false);

  const fileRepository = createGeneratedCollectionsRepository({
    moduleId: "widgets",
    collections: [
      {
        collectionId: "widgets",
        entitySingular: "widget",
        idPrefix: "wid"
      }
    ],
    stateFilePath: filePath,
    persistenceMode: "file"
  });
  expect(fileRepository.describePolicy()).toEqual(
    expect.objectContaining({
      configuredMode: "file",
      runtimeMode: "file",
      source: "input",
      stateFilePath: filePath
    })
  );

  await fileRepository.transact(async (workingState) => {
    workingState.widgets.push({
      id: "wid-001",
      title: "File Widget",
      status: "draft",
      category: "news",
      labels: [],
      publishedOn: null,
      recordId: null,
      slug: "file-widget"
    });
    workingState.nextWidgetNumber = 2;
    return {
      commit: true,
      value: null
    };
  });

  const persistedRaw = await fs.readFile(filePath, "utf8");
  const persisted = JSON.parse(persistedRaw);
  expect(persisted.widgets).toHaveLength(1);
  expect(persisted.widgets[0].id).toBe("wid-001");
  expect(persisted.nextWidgetNumber).toBe(2);
});
}

registerGeneratedCollectionPersistencePolicySuite();

export { registerGeneratedCollectionPersistencePolicySuite };
