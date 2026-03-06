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

function shouldIncludeRemote(remote, normalizedSearchQuery) {
  if (normalizedSearchQuery.length === 0) {
    return true;
  }

  const searchHaystack = [
    remote?.id,
    remote?.label,
    remote?.kind,
    remote?.endpoint
  ]
    .filter((part) => typeof part === "string" && part.length > 0)
    .join(" ")
    .toLowerCase();

  return searchHaystack.includes(normalizedSearchQuery);
}

function normalizeRemoteRows(remotes = []) {
  return remotes
    .map((remote) => ({
      ...(remote && typeof remote === "object" ? remote : {})
    }))
    .filter((remote) => typeof remote.id === "string" && remote.id.length > 0)
    .map((remote) => ({
      ...remote,
      title:
        typeof remote.label === "string" && remote.label.length > 0
          ? remote.label
          : remote.id
    }));
}

export function registerReferenceOptionsProviders({ registry }) {
  registry.register({
    referenceCollectionId: "remotes",
    moduleId: "remotes",
    provider: {
      listOptions: async ({ state, limit, query }) => {
        const remotes = Array.isArray(state?.remotes) ? state.remotes : [];
        const normalizedSearchQuery = normalizeSearchQuery(query);
        const normalizedLimit = normalizeLimit(limit);
        const rows = normalizeRemoteRows(remotes);

        return {
          items: rows
            .filter((remote) => shouldIncludeRemote(remote, normalizedSearchQuery))
            .slice(0, normalizedLimit)
        };
      },
      listValidationRows: async ({ state }) => {
        const remotes = Array.isArray(state?.remotes) ? state.remotes : [];
        return {
          rows: normalizeRemoteRows(remotes)
        };
      }
    }
  });
}
