import { singularFromValue } from "../../../shared/singularization.mjs";

function cloneValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toTitleCase(value) {
  return `${value}`
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function toCodeToken(value) {
  return `${value}`
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function toFieldCodeToken(value) {
  return `${value}`
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function toKebabCase(value) {
  return `${value}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeIdPrefixSeed(value) {
  const compact = toKebabCase(value).replace(/-/g, "");
  if (compact.length >= 2) {
    return compact.slice(0, 8);
  }

  return "modx";
}

function legacySingularFromValue(value) {
  const trimmed = `${value}`.trim();
  if (trimmed.endsWith("ies") && trimmed.length > 3) {
    return `${trimmed.slice(0, -3)}y`;
  }
  if (trimmed.endsWith("s") && trimmed.length > 1) {
    return trimmed.slice(0, -1);
  }
  return trimmed;
}

function normalizeSetValues(input, fallbackValues) {
  const normalized = Array.isArray(input)
    ? input
        .map((value) => (typeof value === "string" ? value.trim().toLowerCase() : ""))
        .filter(Boolean)
    : [];

  if (normalized.length === 0) {
    return [...fallbackValues];
  }

  return [...new Set(normalized)];
}

function normalizeManifestEnumOptions(input) {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized = input
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim().toLowerCase();
      }
      if (!entry || typeof entry !== "object") {
        return "";
      }
      return typeof entry.value === "string" ? entry.value.trim().toLowerCase() : "";
    })
    .filter(Boolean);

  return [...new Set(normalized)];
}

export {
  cloneValue,
  escapeRegex,
  legacySingularFromValue,
  normalizeIdPrefixSeed,
  normalizeManifestEnumOptions,
  normalizeSetValues,
  singularFromValue,
  toCodeToken,
  toKebabCase,
  toFieldCodeToken,
  toTitleCase
};
