export function resolveProductTaxonomyStateRepository(productsTaxonomiesRepository) {
  return productsTaxonomiesRepository &&
    typeof productsTaxonomiesRepository.readState === "function" &&
    typeof productsTaxonomiesRepository.transact === "function"
    ? productsTaxonomiesRepository
    : null;
}

export function createProductTaxonomyWorkingStateAccessors(repository, state) {
  const readWorkingState = async () => (repository ? repository.readState() : state);
  const mutateWorkingState = async (mutator) => {
    if (repository) {
      return repository.transact(mutator);
    }

    const outcome = await mutator(state);
    return Object.prototype.hasOwnProperty.call(outcome ?? {}, "value")
      ? outcome.value
      : outcome;
  };

  return {
    readWorkingState,
    mutateWorkingState
  };
}

export function buildProductTaxonomyPersistenceFailedPayload(action, error) {
  return {
    ok: false,
    error: {
      code: error?.code ?? "REFERENCE_STATE_PERSISTENCE_FAILED",
      message:
        error?.message ?? `Reference-state persistence failed while handling '${action}'`
    },
    timestamp: new Date().toISOString()
  };
}

export function resolveTagIdsFromRequestBody(body = {}) {
  if (Array.isArray(body.tagIds) && body.tagIds.length > 0) {
    return body.tagIds;
  }
  return Array.isArray(body.ids) ? body.ids : [];
}

export function createProductTagUpdateRunner({
  mutateWorkingState,
  evaluateSafeguard,
  normalizeTagIds,
  findTagByLabel,
  createTag,
  uniqueIds,
  haveSameIds,
  markDeployRequired,
  resolveProductRow
}) {
  return async function runProductTagUpdate({
    productId,
    requestedTagIds,
    newTagLabel,
    approveNewTag
  }) {
    return mutateWorkingState(async (workingState) => {
      const product = workingState.products.find((item) => item.id === productId) ?? null;
      if (!product) {
        return {
          commit: false,
          value: {
            ok: false,
            statusCode: 404,
            payload: {
              ok: false,
              error: {
                code: "PRODUCT_NOT_FOUND",
                message: `Product '${productId}' was not found`
              },
              timestamp: new Date().toISOString()
            }
          }
        };
      }

      let finalTagIds = normalizeTagIds(workingState, requestedTagIds);
      let createdTag = null;

      if (newTagLabel.length > 0) {
        const existing = findTagByLabel(workingState, newTagLabel);

        if (!existing && !approveNewTag) {
          const safeguard = evaluateSafeguard({
            action: "create-tag",
            entityType: "tag",
            entityId: newTagLabel.toLowerCase().replace(/\s+/g, "-"),
            impact: {
              dependentCount: 1,
              dependentIds: [product.id]
            }
          });

          return {
            commit: false,
            value: {
              ok: false,
              statusCode: 409,
              payload: {
                ok: false,
                error: {
                  code: "SAFEGUARD_CONFIRMATION_REQUIRED",
                  message: "Creating a new tag requires explicit confirmation"
                },
                safeguard,
                timestamp: new Date().toISOString()
              }
            }
          };
        }

        const creation = createTag(workingState, newTagLabel);
        finalTagIds = uniqueIds([...finalTagIds, creation.tag.id]);
        if (creation.created) {
          createdTag = creation.tag;
        }
      }

      const previousTagIds = [...product.tagIds];
      product.tagIds = finalTagIds;

      const tagsChanged = !haveSameIds(previousTagIds, finalTagIds);
      if (tagsChanged || createdTag) {
        markDeployRequired(workingState);
      }

      return {
        commit: tagsChanged || createdTag !== null,
        value: {
          ok: true,
          item: resolveProductRow(product, workingState),
          meta: {
            createdTag,
            totalTagsOnProduct: finalTagIds.length
          }
        }
      };
    });
  };
}

export function createTagDeleteRunner({
  mutateWorkingState,
  normalizeTagIds,
  buildTagDeleteImpact,
  buildTagDeleteSafeguard,
  buildTagsPayload,
  markDeployRequired
}) {
  return async function runTagDelete(incomingTagIds, approved) {
    return mutateWorkingState(async (workingState) => {
      const tagIds = normalizeTagIds(workingState, incomingTagIds);
      if (tagIds.length === 0) {
        return {
          commit: false,
          value: {
            ok: false,
            statusCode: 400,
            payload: {
              ok: false,
              error: {
                code: "TAG_IDS_REQUIRED",
                message: "At least one existing tag id is required"
              },
              timestamp: new Date().toISOString()
            }
          }
        };
      }

      const impact = buildTagDeleteImpact(workingState, tagIds);
      const safeguard = buildTagDeleteSafeguard(tagIds, impact);

      if (safeguard.decision === "require-confirmation" && !approved) {
        return {
          commit: false,
          value: {
            ok: false,
            statusCode: 409,
            payload: {
              ok: false,
              error: {
                code: "SAFEGUARD_CONFIRMATION_REQUIRED",
                message: "Delete impact confirmation is required"
              },
              impact,
              safeguard,
              timestamp: new Date().toISOString()
            }
          }
        };
      }

      const removedTagIdSet = new Set(tagIds);
      const cleanedProductIds = [];
      let referenceCount = 0;

      for (const product of workingState.products) {
        const before = product.tagIds.length;
        product.tagIds = product.tagIds.filter((tagId) => !removedTagIdSet.has(tagId));
        const removedRefs = before - product.tagIds.length;
        if (removedRefs > 0) {
          cleanedProductIds.push(product.id);
          referenceCount += removedRefs;
        }
      }

      workingState.tags = workingState.tags.filter((tag) => !removedTagIdSet.has(tag.id));
      markDeployRequired(workingState);

      return {
        commit: true,
        value: {
          ok: true,
          removed: {
            tagIds,
            tagCount: tagIds.length
          },
          cleanup: {
            productIds: cleanedProductIds,
            productCount: cleanedProductIds.length,
            referenceCount
          },
          remainingTags: buildTagsPayload(workingState)
        }
      };
    });
  };
}
