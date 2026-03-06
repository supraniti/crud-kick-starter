const SUPPORTED_RESOLVER_VALUES = Object.freeze([
  "slugify",
  "identity",
  "trim",
  "lowercase",
  "uppercase",
  "titlecase"
]);

const SUPPORTED_RESOLVER_SET = new Set(SUPPORTED_RESOLVER_VALUES);

const SLUGIFY_MAX_LENGTH_SETTING_SCHEMA = Object.freeze({
  settingTypes: Object.freeze(["number"]),
  normalize(value) {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }
});

const COMPUTED_RESOLVER_SETTING_OPTION_SCHEMAS = Object.freeze({
  slugify: Object.freeze({
    maxLength: SLUGIFY_MAX_LENGTH_SETTING_SCHEMA
  }),
  identity: Object.freeze({}),
  trim: Object.freeze({}),
  lowercase: Object.freeze({}),
  uppercase: Object.freeze({}),
  titlecase: Object.freeze({})
});

export const DEFAULT_COMPUTED_RESOLVER = "slugify";
export const SUPPORTED_COMPUTED_RESOLVERS = SUPPORTED_RESOLVER_VALUES;
export const SUPPORTED_COMPUTED_RESOLVERS_LABEL = SUPPORTED_COMPUTED_RESOLVERS.join(", ");

export function normalizeComputedResolverToken(value) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

export function isSupportedComputedResolverToken(value) {
  return SUPPORTED_RESOLVER_SET.has(value);
}

export function resolveComputedResolverSettingOptionSchema(
  resolver,
  optionKey
) {
  const normalizedResolver = normalizeComputedResolverToken(resolver);
  const normalizedOptionKey =
    typeof optionKey === "string" ? optionKey.trim() : "";

  if (!normalizedResolver || normalizedOptionKey.length === 0) {
    return null;
  }

  const resolverSchema =
    COMPUTED_RESOLVER_SETTING_OPTION_SCHEMAS[normalizedResolver] ?? null;
  if (!resolverSchema) {
    return null;
  }

  return resolverSchema[normalizedOptionKey] ?? null;
}

export function normalizeComputedResolverSettingOptionValue(
  resolver,
  optionKey,
  rawValue
) {
  const schema = resolveComputedResolverSettingOptionSchema(resolver, optionKey);
  if (!schema || typeof schema.normalize !== "function") {
    return null;
  }

  return schema.normalize(rawValue);
}

export function createComputedResolverRegistry({ slugifyMaxLength = null } = {}) {
  const defaultSlugifyMaxLength = normalizeComputedResolverSettingOptionValue(
    "slugify",
    "maxLength",
    slugifyMaxLength
  );

  return Object.freeze({
    slugify: (value, options = {}) => {
      const normalized = `${value}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const optionMaxLength = normalizeComputedResolverSettingOptionValue(
        "slugify",
        "maxLength",
        options?.maxLength
      );
      const resolvedMaxLength =
        optionMaxLength ?? defaultSlugifyMaxLength;
      return Number.isInteger(resolvedMaxLength)
        ? normalized.slice(0, resolvedMaxLength)
        : normalized;
    },
    identity: (value) => value,
    trim: (value) => value.replace(/\s+/g, " ").trim(),
    lowercase: (value) => value.toLowerCase(),
    uppercase: (value) => value.toUpperCase(),
    titlecase: (value) =>
      value
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim()
        .replace(/\b([a-z])/g, (_match, first) => first.toUpperCase())
  });
}
