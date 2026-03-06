import { registerGeneratedCollectionHandlers } from "../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime.mjs";

const MODULE_ID = "test-modules-operations-dispatch";

export function registerCollectionHandlers(context = {}) {
  return registerGeneratedCollectionHandlers({
    ...context,
    moduleId: MODULE_ID
  });
}
