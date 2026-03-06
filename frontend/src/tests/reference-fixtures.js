export const MODULES = [
  { id: "products", label: "Products", icon: "inventory_2" },
  { id: "records", label: "Records", icon: "dataset" },
  { id: "taxonomies", label: "Taxonomies", icon: "category" },
  { id: "remotes", label: "Remotes", icon: "cloud_upload" },
  { id: "missions", label: "Missions", icon: "rocket_launch" }
];

export const CATEGORIES = [
  { id: "cat-001", label: "Hardware" },
  { id: "cat-002", label: "Software" },
  { id: "cat-003", label: "Accessories" }
];

export const PRODUCTS = [
  {
    id: "prd-001",
    name: "Mechanical Keyboard",
    price: 129,
    active: true,
    categoryId: "cat-001",
    categoryLabel: "Hardware",
    tagIds: ["tag-001", "tag-004"]
  },
  {
    id: "prd-002",
    name: "Wireless Mouse",
    price: 79,
    active: true,
    categoryId: "cat-003",
    categoryLabel: "Accessories",
    tagIds: ["tag-003", "tag-001"]
  },
  {
    id: "prd-003",
    name: "Backup Utility",
    price: 49,
    active: true,
    categoryId: "cat-002",
    categoryLabel: "Software",
    tagIds: ["tag-002"]
  }
];

export const TAGS = [
  { id: "tag-001", label: "Featured" },
  { id: "tag-002", label: "Sale" },
  { id: "tag-003", label: "Wireless" },
  { id: "tag-004", label: "Office" }
];

export const RECORDS = [
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
];

export const NOTES = [
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
];

export const REMOTES = [
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
];

export const COLLECTIONS = [
  {
    id: "records",
    label: "Records",
    entitySingular: "record"
  },
  {
    id: "notes",
    label: "Notes",
    entitySingular: "note"
  }
];

export const COLLECTION_SCHEMAS = {
  records: {
    id: "records",
    label: "Records",
    entitySingular: "record",
    primaryField: "title",
    fields: [
      { id: "title", label: "Title", type: "text" },
      {
        id: "status",
        label: "Status",
        type: "enum",
        options: ["draft", "review", "published"]
      },
      { id: "score", label: "Score", type: "number", min: 0, max: 100 },
      { id: "featured", label: "Featured", type: "boolean" },
      { id: "publishedOn", label: "Published On", type: "date" },
      { id: "noteIds", label: "Linked Notes", type: "reference-multi", collectionId: "notes" },
      { id: "slug", label: "Slug", type: "computed" }
    ]
  },
  notes: {
    id: "notes",
    label: "Notes",
    entitySingular: "note",
    primaryField: "title",
    fields: [
      { id: "title", label: "Title", type: "text" },
      { id: "category", label: "Category", type: "enum", options: ["general", "tech", "ops"] },
      {
        id: "labels",
        label: "Labels",
        type: "enum-multi",
        options: ["action", "ops", "ui", "backend", "release"]
      },
      { id: "priority", label: "Priority", type: "number", min: 1, max: 5 },
      { id: "pinned", label: "Pinned", type: "boolean" },
      { id: "dueDate", label: "Due Date", type: "date" },
      { id: "recordId", label: "Related Record", type: "reference", collectionId: "records" },
      { id: "slug", label: "Slug", type: "computed" }
    ]
  }
};
