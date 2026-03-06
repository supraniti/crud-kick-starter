import { createQueryPipeline } from "../../../core/query-pipeline.js";
import { evaluateSafeguard } from "../../../core/safeguard-evaluator.js";
import { parseCsvIds, parsePagination, uniqueIds } from "./state-utils.js";

export function getCategoryMap(state) {
  return new Map(state.categories.map((category) => [category.id, category.label]));
}

export function getTagMap(state) {
  return new Map(state.tags.map((tag) => [tag.id, tag.label]));
}

export function resolveProductRow(row, state) {
  const categoryMap = getCategoryMap(state);
  const tagMap = getTagMap(state);

  return {
    ...row,
    tagIds: [...row.tagIds],
    categoryLabel: categoryMap.get(row.categoryId) ?? "Unknown",
    tagLabels: row.tagIds.map((tagId) => tagMap.get(tagId) ?? tagId)
  };
}

export function buildProductsPipeline(state, query) {
  const categoryIds = parseCsvIds(query.categoryIds);
  const offset = parsePagination(query.offset, 0);
  const limit = Math.max(1, Math.min(parsePagination(query.limit, 50), 200));

  return {
    categoryIds,
    limit,
    offset,
    pipeline: createQueryPipeline({
      stages: {
        project: (rows) => {
          return rows.map((row) => ({
            id: row.id,
            name: row.name,
            price: row.price,
            active: row.active,
            categoryId: row.categoryId,
            tagIds: [...row.tagIds]
          }));
        },
        sort: (rows) => {
          return [...rows].sort((a, b) => a.name.localeCompare(b.name));
        },
        filter: (rows) => {
          const filtered =
            categoryIds.length === 0
              ? rows
              : rows.filter((row) => categoryIds.includes(row.categoryId));
          return {
            ok: true,
            data: filtered,
            meta: {
              totalAfterFilter: filtered.length
            }
          };
        },
        slice: (rows) => {
          const sliced = rows.slice(offset, offset + limit);
          return {
            ok: true,
            data: sliced,
            meta: {
              offset,
              limit
            }
          };
        },
        resolve: (rows) => rows.map((row) => resolveProductRow(row, state))
      }
    })
  };
}

export function normalizeTagIds(state, incomingTagIds) {
  const unique = uniqueIds(incomingTagIds);
  const existingIds = new Set(state.tags.map((tag) => tag.id));
  return unique.filter((id) => existingIds.has(id));
}

export function findTagByLabel(state, label) {
  const normalized = label.trim().toLowerCase();
  return state.tags.find((tag) => tag.label.trim().toLowerCase() === normalized) ?? null;
}

export function createTag(state, label) {
  const existing = findTagByLabel(state, label);
  if (existing) {
    return {
      created: false,
      tag: existing
    };
  }

  const id = `tag-${String(state.nextTagNumber).padStart(3, "0")}`;
  state.nextTagNumber += 1;
  const tag = {
    id,
    label: label.trim()
  };
  state.tags.push(tag);

  return {
    created: true,
    tag
  };
}

export function countTagUsage(state, tagId) {
  return state.products.reduce((count, product) => {
    return count + (product.tagIds.includes(tagId) ? 1 : 0);
  }, 0);
}

export function buildTagsPayload(state) {
  return [...state.tags]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((tag) => ({
      ...tag,
      usageCount: countTagUsage(state, tag.id)
    }));
}

export function buildTagDeleteImpact(state, tagIds) {
  const affectedProducts = [];
  let referenceCount = 0;

  for (const product of state.products) {
    const matchedTagIds = product.tagIds.filter((tagId) => tagIds.includes(tagId));
    if (matchedTagIds.length === 0) {
      continue;
    }

    referenceCount += matchedTagIds.length;
    affectedProducts.push({
      id: product.id,
      name: product.name,
      matchedTagIds
    });
  }

  return {
    dependentCount: affectedProducts.length,
    dependentIds: affectedProducts.map((product) => product.id),
    referenceCount,
    affectedProducts
  };
}

export function buildTagDeleteSafeguard(tagIds, impact) {
  return evaluateSafeguard({
    action: "delete-tags",
    entityType: "tag",
    entityId: tagIds.join(",") || "none",
    impact: {
      dependentCount: impact.dependentCount,
      dependentIds: impact.dependentIds
    }
  });
}
