const DEFAULT_REFERENCE_OPTIONS_LIMIT = 200;

function normalizeLimit(value) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return DEFAULT_REFERENCE_OPTIONS_LIMIT;
  }

  return Math.min(parsed, DEFAULT_REFERENCE_OPTIONS_LIMIT);
}

function normalizeSearchQuery(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function missionLabel(entry) {
  const label = entry?.mission?.label;
  if (typeof label === "string" && label.trim().length > 0) {
    return label.trim();
  }

  return entry?.missionId ?? "mission";
}

function missionDescription(entry) {
  const description = entry?.mission?.description;
  if (typeof description === "string" && description.trim().length > 0) {
    return description.trim();
  }

  return "";
}

function missionState(entry, moduleRegistry) {
  if (!moduleRegistry || typeof moduleRegistry.getState !== "function") {
    return "unknown";
  }

  const moduleId = entry?.moduleId;
  if (typeof moduleId !== "string" || moduleId.length === 0) {
    return "unknown";
  }

  return moduleRegistry.getState(moduleId) ?? "unknown";
}

function shouldIncludeMission(item, normalizedSearchQuery) {
  if (normalizedSearchQuery.length === 0) {
    return true;
  }

  const searchable = [item.id, item.label, item.description, item.moduleId]
    .filter((value) => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();
  return searchable.includes(normalizedSearchQuery);
}

function buildMissionRows(missionEntries = [], moduleRegistry) {
  return missionEntries
    .map((entry) => {
      const state = missionState(entry, moduleRegistry);
      const id = entry?.missionId;
      if (typeof id !== "string" || id.length === 0) {
        return null;
      }
      const label = missionLabel(entry);
      const description = missionDescription(entry);
      return {
        id,
        label,
        title: label,
        description,
        moduleId: entry?.moduleId ?? null,
        state,
        active: state === "enabled"
      };
    })
    .filter((item) => item !== null)
    .filter((item) => item.active);
}

export function registerReferenceOptionsProviders({
  registry,
  missionRegistry,
  moduleRegistry
}) {
  registry.register({
    referenceCollectionId: "missions",
    moduleId: "missions",
    provider: {
      listOptions: async ({ limit, query }) => {
        const normalizedSearchQuery = normalizeSearchQuery(query);
        const normalizedLimit = normalizeLimit(limit);
        const missionEntries =
          missionRegistry && typeof missionRegistry.list === "function"
            ? missionRegistry.list()
            : [];
        const items = buildMissionRows(missionEntries, moduleRegistry)
          .filter((item) => shouldIncludeMission(item, normalizedSearchQuery))
          .slice(0, normalizedLimit);

        return {
          items
        };
      },
      listValidationRows: async () => {
        const missionEntries =
          missionRegistry && typeof missionRegistry.list === "function"
            ? missionRegistry.list()
            : [];
        return {
          rows: buildMissionRows(missionEntries, moduleRegistry)
        };
      }
    }
  });
}
