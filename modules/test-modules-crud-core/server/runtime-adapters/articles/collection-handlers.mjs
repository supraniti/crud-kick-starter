import { registerGeneratedCollectionHandlers } from "../../../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime.mjs";

const ARTICLES_COLLECTIONS = Object.freeze([
  {
    collectionId: "articles",
    entitySingular: "article",
    idPrefix: "art"
  }
]);

export function registerCollectionHandlers(context = {}) {
  return registerGeneratedCollectionHandlers({
    ...context,
    moduleId: "articles",
    collections: ARTICLES_COLLECTIONS
  });
}
