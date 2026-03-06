function buildQuery(params) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        query.set(key, value.join(","));
      }
      continue;
    }

    query.set(key, `${value}`);
  }

  const serialized = query.toString();
  return serialized.length > 0 ? `?${serialized}` : "";
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const payload = await response.json();
  const acceptedStatuses = options.acceptStatuses ?? [];
  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    throw new Error(`Request failed (${response.status}) for ${path}`);
  }

  return payload;
}

export async function fetchReferenceModules() {
  return requestJson("/api/reference/modules");
}

export async function fetchReferenceModulesRuntime() {
  return requestJson("/api/reference/modules/runtime");
}

export async function fetchReferenceSettingsModules() {
  return requestJson("/api/reference/settings/modules");
}

export async function readReferenceModuleSettings(options = {}) {
  const moduleId = options.moduleId;
  return requestJson(`/api/reference/settings/modules/${moduleId}`, {
    acceptStatuses: [404, 409]
  });
}

export async function updateReferenceModuleSettings(options = {}) {
  const moduleId = options.moduleId;
  return requestJson(`/api/reference/settings/modules/${moduleId}`, {
    method: "PUT",
    body:
      options.settings && typeof options.settings === "object" && !Array.isArray(options.settings)
        ? options.settings
        : {},
    acceptStatuses: [400, 404, 409]
  });
}

export async function installReferenceModule(options = {}) {
  return requestJson(`/api/reference/modules/${options.moduleId}/install`, {
    method: "POST",
    acceptStatuses: [404, 409]
  });
}

export async function uninstallReferenceModule(options = {}) {
  return requestJson(`/api/reference/modules/${options.moduleId}/uninstall`, {
    method: "POST",
    acceptStatuses: [404, 409]
  });
}

export async function enableReferenceModule(options = {}) {
  return requestJson(`/api/reference/modules/${options.moduleId}/enable`, {
    method: "POST",
    acceptStatuses: [404, 409]
  });
}

export async function disableReferenceModule(options = {}) {
  return requestJson(`/api/reference/modules/${options.moduleId}/disable`, {
    method: "POST",
    acceptStatuses: [404, 409]
  });
}

export async function fetchReferenceCollections() {
  return requestJson("/api/reference/collections");
}

export async function fetchReferenceCollectionSchema(options = {}) {
  const collectionId = options.collectionId;
  return requestJson(`/api/reference/collections/${collectionId}/schema`, {
    acceptStatuses: [404]
  });
}

export async function fetchReferenceCollectionWorkspace(options = {}) {
  const collectionId = options.collectionId;
  const queryInput = {
    ...options
  };
  delete queryInput.collectionId;
  const query = buildQuery(queryInput);

  return requestJson(`/api/reference/collections/${collectionId}/workspace${query}`, {
    acceptStatuses: [404]
  });
}

export async function fetchReferenceCollectionItems(options = {}) {
  const collectionId = options.collectionId;
  const queryInput = {
    ...options
  };
  delete queryInput.collectionId;

  const query = buildQuery(queryInput);

  return requestJson(`/api/reference/collections/${collectionId}/items${query}`, {
    acceptStatuses: [404]
  });
}

export async function createReferenceCollectionItem(options = {}) {
  const collectionId = options.collectionId;
  return requestJson(`/api/reference/collections/${collectionId}/items`, {
    method: "POST",
    body: options.item ?? {},
    acceptStatuses: [400, 404, 409]
  });
}

export async function updateReferenceCollectionItem(options = {}) {
  const collectionId = options.collectionId;
  const itemId = options.itemId;
  return requestJson(`/api/reference/collections/${collectionId}/items/${itemId}`, {
    method: "PUT",
    body: options.item ?? {},
    acceptStatuses: [400, 404, 409]
  });
}

export async function deleteReferenceCollectionItem(options = {}) {
  const collectionId = options.collectionId;
  const itemId = options.itemId;
  return requestJson(`/api/reference/collections/${collectionId}/items/${itemId}`, {
    method: "DELETE",
    acceptStatuses: [404, 409]
  });
}

export async function fetchReferenceCategories() {
  return requestJson("/api/reference/categories");
}

export async function fetchReferenceProducts(options = {}) {
  const query = buildQuery({
    categoryIds: options.categoryIds ?? [],
    offset: options.offset ?? 0,
    limit: options.limit ?? 50
  });

  return requestJson(`/api/reference/products${query}`);
}

export async function fetchReferenceTags() {
  return requestJson("/api/reference/taxonomies/tags");
}

export async function fetchReferenceRemotes() {
  return requestJson("/api/reference/remotes");
}

export async function createReferenceRemote(options = {}) {
  return requestJson("/api/reference/remotes", {
    method: "POST",
    body: {
      label: options.label ?? "",
      kind: options.kind ?? "",
      endpoint: options.endpoint ?? "",
      enabled: options.enabled === true
    },
    acceptStatuses: [400, 409]
  });
}

export async function updateReferenceRemote(options = {}) {
  const remoteId = options.remoteId;
  return requestJson(`/api/reference/remotes/${remoteId}`, {
    method: "PUT",
    body: {
      ...(options.label !== undefined ? { label: options.label } : {}),
      ...(options.kind !== undefined ? { kind: options.kind } : {}),
      ...(options.endpoint !== undefined ? { endpoint: options.endpoint } : {}),
      ...(options.enabled !== undefined ? { enabled: options.enabled === true } : {})
    },
    acceptStatuses: [400, 404, 409]
  });
}

export async function deleteReferenceRemote(options = {}) {
  const remoteId = options.remoteId;
  return requestJson(`/api/reference/remotes/${remoteId}`, {
    method: "DELETE",
    acceptStatuses: [404]
  });
}

export async function fetchReferenceDeployState() {
  return requestJson("/api/reference/deploy/state");
}

export async function listReferenceDeployJobs() {
  return requestJson("/api/reference/deploy/jobs");
}

export async function startReferenceDeployJob(options = {}) {
  return requestJson("/api/reference/deploy/jobs", {
    method: "POST",
    body: {
      remoteId: options.remoteId ?? ""
    },
    acceptStatuses: [400, 404, 409]
  });
}

export async function fetchReferenceMissions() {
  return requestJson("/api/reference/missions");
}

export async function startReferenceMissionJob(options = {}) {
  const missionId = options.missionId;
  return requestJson(`/api/reference/missions/${missionId}/jobs`, {
    method: "POST",
    body:
      options.payload && typeof options.payload === "object" && !Array.isArray(options.payload)
        ? options.payload
        : {},
    acceptStatuses: [400, 404, 409, 500]
  });
}

export async function listReferenceMissionJobs() {
  return requestJson("/api/reference/missions/jobs");
}

export async function readReferenceMissionJob(options = {}) {
  const jobId = options.jobId;
  return requestJson(`/api/reference/missions/jobs/${jobId}`, {
    acceptStatuses: [404]
  });
}

export async function cancelReferenceMissionJob(options = {}) {
  const jobId = options.jobId;
  return requestJson(`/api/reference/missions/jobs/${jobId}/cancel`, {
    method: "POST",
    acceptStatuses: [404, 409]
  });
}

export async function updateReferenceProductTags(options = {}) {
  const productId = options.productId;
  return requestJson(`/api/reference/products/${productId}/tags`, {
    method: "POST",
    body: {
      tagIds: options.tagIds ?? [],
      newTagLabel: options.newTagLabel ?? "",
      approveNewTag: options.approveNewTag === true
    },
    acceptStatuses: [409]
  });
}

export async function analyzeReferenceTagDelete(options = {}) {
  return requestJson("/api/reference/taxonomies/tags/impact", {
    method: "POST",
    body: {
      tagIds: options.tagIds ?? []
    }
  });
}

export async function deleteReferenceTags(options = {}) {
  return requestJson("/api/reference/taxonomies/tags/delete", {
    method: "POST",
    body: {
      tagIds: options.tagIds ?? [],
      approved: options.approved === true
    },
    acceptStatuses: [409]
  });
}

export async function previewReferenceSafeguard(options = {}) {
  const query = buildQuery({
    value: options.value ?? "",
    action: options.action ?? "create-tag"
  });

  return requestJson(`/api/reference/safeguards/preview${query}`);
}
