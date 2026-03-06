import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";

const tempDirs = [];

async function createTempModulesDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "module-scaffold-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) =>
      fs.rm(dir, {
        recursive: true,
        force: true
      })
    )
  );
});

function createCollectionHandlerRegistryStub() {
  const handlers = new Map();
  return {
    handlers,
    register({ collectionId, handler }) {
      handlers.set(collectionId, handler);
    }
  };
}

function createBadRequestPayload(_reply, code, message) {
  return {
    ok: false,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRepositoryStub(initialState = {}) {
  let snapshot = cloneJson(initialState);

  return {
    async readState() {
      return cloneJson(snapshot);
    },
    async transact(mutator) {
      const workingState = cloneJson(snapshot);
      const outcome = await mutator(workingState);
      if (outcome?.commit === true) {
        snapshot = cloneJson(workingState);
      }

      return Object.prototype.hasOwnProperty.call(outcome ?? {}, "value")
        ? outcome.value
        : outcome;
    }
  };
}

export {
  createBadRequestPayload,
  createCollectionHandlerRegistryStub,
  createRepositoryStub,
  createTempModulesDir
};
