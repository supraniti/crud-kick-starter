import {
  createGeneratedCollectionsRepository,
  registerGeneratedCollectionPersistencePlugins
} from "../../../../../server/src/core/shared/capability-contracts/local-kernel/generated-proof-runtime.mjs";

const ARTICLES_COLLECTIONS = Object.freeze([
  {
    collectionId: "articles",
    entitySingular: "article",
    idPrefix: "art"
  }
]);

export function registerPersistencePlugins(context = {}) {
  return registerGeneratedCollectionPersistencePlugins({
    ...context,
    moduleId: "articles",
    collections: ARTICLES_COLLECTIONS
  });
}

export function createArticlesRepository(options = {}) {
  return createGeneratedCollectionsRepository({
    ...options,
    moduleId: "articles",
    collections: ARTICLES_COLLECTIONS
  });
}
