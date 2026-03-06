const BASE_REFERENCE_STATE = {
  categories: [
    { id: "cat-001", label: "Hardware" },
    { id: "cat-002", label: "Software" },
    { id: "cat-003", label: "Accessories" }
  ],
  tags: [
    { id: "tag-001", label: "Featured" },
    { id: "tag-002", label: "Sale" },
    { id: "tag-003", label: "Wireless" },
    { id: "tag-004", label: "Office" }
  ],
  products: [
    {
      id: "prd-001",
      name: "Mechanical Keyboard",
      price: 129,
      active: true,
      categoryId: "cat-001",
      tagIds: ["tag-001", "tag-004"]
    },
    {
      id: "prd-002",
      name: "Wireless Mouse",
      price: 79,
      active: true,
      categoryId: "cat-003",
      tagIds: ["tag-003", "tag-001"]
    },
    {
      id: "prd-003",
      name: "Backup Utility",
      price: 49,
      active: true,
      categoryId: "cat-002",
      tagIds: ["tag-002"]
    },
    {
      id: "prd-004",
      name: "Desk Dock",
      price: 99,
      active: false,
      categoryId: "cat-003",
      tagIds: ["tag-004"]
    },
    {
      id: "prd-005",
      name: "Team Workspace",
      price: 199,
      active: true,
      categoryId: "cat-002",
      tagIds: ["tag-001"]
    }
  ],
  remotes: [
    {
      id: "remote-001",
      label: "Local Runtime",
      kind: "filesystem",
      endpoint: "file://server/runtime/deploy/reference",
      enabled: true
    },
    {
      id: "remote-002",
      label: "Staging API",
      kind: "http",
      endpoint: "https://staging.example.invalid/deploy",
      enabled: true
    }
  ],
  records: [
    {
      id: "rec-001",
      title: "Launch Checklist",
      status: "draft",
      score: 72,
      featured: false,
      publishedOn: null,
      noteIds: ["note-001"],
      slug: "launch-checklist"
    },
    {
      id: "rec-002",
      title: "Release Notes Draft",
      status: "review",
      score: 86,
      featured: true,
      publishedOn: "2026-02-10",
      noteIds: ["note-002"],
      slug: "release-notes-draft"
    }
  ],
  notes: [
    {
      id: "note-001",
      title: "Ops Followup",
      category: "ops",
      labels: ["ops", "release"],
      priority: 2,
      pinned: true,
      dueDate: "2026-02-15",
      recordId: "rec-001",
      slug: "ops-followup"
    },
    {
      id: "note-002",
      title: "Frontend Polish",
      category: "tech",
      labels: ["ui"],
      priority: 3,
      pinned: false,
      dueDate: null,
      recordId: null,
      slug: "frontend-polish"
    }
  ],
  nextTagNumber: 5,
  nextRemoteNumber: 3,
  nextRecordNumber: 3,
  nextNoteNumber: 3
};

export function createReleaseState() {
  return {
    currentRevision: 0,
    deployedRevision: 0,
    deployRequired: false,
    lastMutationAt: null,
    lastDeployAt: null,
    lastDeployJobId: null,
    lastDeployRemoteId: null
  };
}

export function createReferenceState() {
  return {
    categories: BASE_REFERENCE_STATE.categories.map((row) => ({ ...row })),
    tags: BASE_REFERENCE_STATE.tags.map((row) => ({ ...row })),
    products: BASE_REFERENCE_STATE.products.map((row) => ({
      ...row,
      tagIds: [...row.tagIds]
    })),
    remotes: BASE_REFERENCE_STATE.remotes.map((row) => ({ ...row })),
    records: BASE_REFERENCE_STATE.records.map((row) => ({
      ...row,
      noteIds: [...(row.noteIds ?? [])]
    })),
    notes: BASE_REFERENCE_STATE.notes.map((row) => ({
      ...row,
      labels: [...(row.labels ?? [])]
    })),
    nextTagNumber: BASE_REFERENCE_STATE.nextTagNumber,
    nextRemoteNumber: BASE_REFERENCE_STATE.nextRemoteNumber,
    nextRecordNumber: BASE_REFERENCE_STATE.nextRecordNumber,
    nextNoteNumber: BASE_REFERENCE_STATE.nextNoteNumber,
    release: createReleaseState()
  };
}

export function cloneReferenceData(state) {
  return {
    categories: state.categories.map((row) => ({ ...row })),
    tags: state.tags.map((row) => ({ ...row })),
    products: state.products.map((row) => ({
      ...row,
      tagIds: [...row.tagIds]
    })),
    records: state.records.map((row) => ({
      ...row,
      noteIds: [...(row.noteIds ?? [])]
    })),
    notes: state.notes.map((row) => ({
      ...row,
      labels: [...(row.labels ?? [])]
    }))
  };
}

export function parseCsvIds(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return [];
  }

  return [...new Set(rawValue.split(",").map((value) => value.trim()).filter(Boolean))];
}

export function parsePagination(value, fallback) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export function uniqueIds(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))];
}

export function haveSameIds(left, right) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

export function slugifyTitle(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function markDeployRequired(state) {
  state.release.currentRevision += 1;
  state.release.deployRequired = state.release.currentRevision > state.release.deployedRevision;
  state.release.lastMutationAt = new Date().toISOString();
}

export function toDeployStatePayload(state) {
  return {
    currentRevision: state.release.currentRevision,
    deployedRevision: state.release.deployedRevision,
    deployRequired: state.release.deployRequired,
    lastMutationAt: state.release.lastMutationAt,
    lastDeployAt: state.release.lastDeployAt,
    lastDeployJobId: state.release.lastDeployJobId,
    lastDeployRemoteId: state.release.lastDeployRemoteId
  };
}

export function badRequest(reply, code, message) {
  reply.code(400);
  return {
    ok: false,
    error: {
      code,
      message
    },
    timestamp: new Date().toISOString()
  };
}
