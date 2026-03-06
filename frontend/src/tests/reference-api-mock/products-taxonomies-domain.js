import { vi } from "vitest";
import {
  markDeployRequired,
  resolveProducts,
  resolveTags,
  toId,
  uniqueIds
} from "./state.js";

function productNotFoundError(productId) {
  return {
    ok: false,
    error: {
      code: "PRODUCT_NOT_FOUND",
      message: `Product '${productId}' was not found`
    }
  };
}

function createListProductsHandler(state) {
  return async ({ categoryIds = [], offset = 0, limit = 50 } = {}) => {
    const items = resolveProducts(state, { categoryIds });
    return {
      ok: true,
      items: items.slice(offset, offset + limit),
      meta: {
        total: items.length,
        offset,
        limit
      }
    };
  };
}

function createListTagsHandler(state) {
  return async () => ({
    ok: true,
    items: resolveTags(state)
  });
}

function createUpdateProductTagsHandler(state) {
  return async ({ productId, tagIds = [], newTagLabel = "", approveNewTag = false }) => {
    const product = state.products.find((item) => item.id === productId);
    if (!product) {
      return productNotFoundError(productId);
    }

    const normalizedTagIds = uniqueIds(
      tagIds.filter((tagId) => state.tags.some((tag) => tag.id === tagId))
    );
    const trimmedLabel = newTagLabel.trim();
    const existingByLabel = state.tags.find(
      (tag) => tag.label.toLowerCase() === trimmedLabel.toLowerCase()
    );

    if (trimmedLabel && !existingByLabel && !approveNewTag) {
      return {
        ok: false,
        error: {
          code: "SAFEGUARD_CONFIRMATION_REQUIRED",
          message: "Creating a new tag requires explicit confirmation"
        },
        safeguard: {
          code: "SAFEGUARD_CONFIRMATION_REQUIRED",
          decision: "require-confirmation",
          message: "Action 'create-tag' affects dependent records"
        }
      };
    }

    let createdTag = null;
    if (trimmedLabel) {
      if (existingByLabel) {
        normalizedTagIds.push(existingByLabel.id);
      } else {
        createdTag = {
          id: toId("tag", state.nextTagNumber++),
          label: trimmedLabel
        };
        state.tags.push(createdTag);
        normalizedTagIds.push(createdTag.id);
      }
    }

    product.tagIds = uniqueIds(normalizedTagIds);
    markDeployRequired(state);

    return {
      ok: true,
      item: resolveProducts(state).find((item) => item.id === product.id),
      meta: {
        createdTag,
        totalTagsOnProduct: product.tagIds.length
      }
    };
  };
}

function createAnalyzeTagDeleteHandler(state) {
  return async ({ tagIds = [] } = {}) => {
    const dependentProducts = state.products.filter((product) =>
      product.tagIds.some((tagId) => tagIds.includes(tagId))
    );
    const referenceCount = dependentProducts.reduce((count, product) => {
      return count + product.tagIds.filter((tagId) => tagIds.includes(tagId)).length;
    }, 0);

    return {
      ok: true,
      impact: {
        dependentCount: dependentProducts.length,
        referenceCount
      },
      safeguard: {
        decision: dependentProducts.length > 0 ? "require-confirmation" : "allow"
      }
    };
  };
}

function createDeleteTagsHandler(state) {
  return async ({ tagIds = [], approved = false } = {}) => {
    const dependentProducts = state.products.filter((product) =>
      product.tagIds.some((tagId) => tagIds.includes(tagId))
    );

    if (dependentProducts.length > 0 && approved !== true) {
      return {
        ok: false,
        error: {
          code: "SAFEGUARD_CONFIRMATION_REQUIRED",
          message: "Delete impact confirmation is required"
        }
      };
    }

    state.tags = state.tags.filter((tag) => !tagIds.includes(tag.id));
    let cleanupCount = 0;
    for (const product of state.products) {
      const before = product.tagIds.length;
      product.tagIds = product.tagIds.filter((tagId) => !tagIds.includes(tagId));
      cleanupCount += before - product.tagIds.length;
    }
    markDeployRequired(state);

    return {
      ok: true,
      removed: {
        tagCount: tagIds.length
      },
      cleanup: {
        referenceCount: cleanupCount,
        productCount: dependentProducts.length
      }
    };
  };
}

function createPreviewSafeguardHandler() {
  return async ({ value = "" } = {}) => {
    const requiresConfirmation = value.trim().length > 0;

    return {
      ok: true,
      safeguard: {
        ok: true,
        decision: requiresConfirmation ? "require-confirmation" : "allow",
        severity: requiresConfirmation ? "warning" : "info",
        code: requiresConfirmation ? "SAFEGUARD_CONFIRMATION_REQUIRED" : "SAFEGUARD_ALLOW",
        message: requiresConfirmation
          ? "Action 'create-tag' affects dependent records"
          : "Action 'create-tag' is safe to execute"
      }
    };
  };
}

export function buildProductsTaxonomiesApi(state) {
  return {
    listCategories: vi.fn().mockResolvedValue({ ok: true, items: state.categories }),
    listProducts: vi.fn().mockImplementation(createListProductsHandler(state)),
    listTags: vi.fn().mockImplementation(createListTagsHandler(state)),
    updateProductTags: vi.fn().mockImplementation(createUpdateProductTagsHandler(state)),
    analyzeTagDelete: vi.fn().mockImplementation(createAnalyzeTagDeleteHandler(state)),
    deleteTags: vi.fn().mockImplementation(createDeleteTagsHandler(state)),
    previewSafeguard: vi.fn().mockImplementation(createPreviewSafeguardHandler())
  };
}
