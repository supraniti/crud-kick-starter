import { Chip, Stack } from "@mui/material";
import {
  DEFAULT_COMPUTED_RESOLVER,
  createComputedResolverRegistry,
  isSupportedComputedResolverToken,
  normalizeComputedResolverToken
} from "../../../runtime/shared-capability-bridges/computed-resolver-catalog.mjs";
import {
  resolveReferenceTitleKeys,
  resolveReferenceTitlesKeys
} from "../../../runtime/shared-capability-bridges/reference-field-key-utils.mjs";

const COLLECTION_FIELD_EDITOR_UNSUPPORTED_TYPE = "COLLECTION_FIELD_EDITOR_UNSUPPORTED_TYPE";
const COLLECTION_FIELD_RENDERER_UNSUPPORTED_TYPE = "COLLECTION_FIELD_RENDERER_UNSUPPORTED_TYPE";
const COLLECTION_FIELD_EDITOR_UNSUPPORTED_VARIANT = "COLLECTION_FIELD_EDITOR_UNSUPPORTED_VARIANT";
const COLLECTION_FIELD_RENDERER_UNSUPPORTED_VARIANT =
  "COLLECTION_FIELD_RENDERER_UNSUPPORTED_VARIANT";
const COLLECTION_FIELD_EDITOR_COMPUTED_RESOLVER_UNSUPPORTED =
  "COLLECTION_FIELD_EDITOR_COMPUTED_RESOLVER_UNSUPPORTED";
const COLLECTION_FIELD_RENDERER_COMPUTED_RESOLVER_UNSUPPORTED =
  "COLLECTION_FIELD_RENDERER_COMPUTED_RESOLVER_UNSUPPORTED";
const COMPUTED_RESOLVER_REGISTRY = createComputedResolverRegistry();

function normalizeFieldType(field) {
  return typeof field?.type === "string" ? field.type.trim() : "";
}

function toReferenceOptions(field, referenceOptionsState) {
  return referenceOptionsState?.[field.collectionId] ?? {
    loading: false,
    errorMessage: null,
    items: []
  };
}

function toReferenceInputLabel(field) {
  if (typeof field?.label !== "string" || field.label.length === 0) {
    return field?.id ?? "";
  }

  return `${field.label.charAt(0)}${field.label.slice(1).toLowerCase()}`;
}

function resolveReferenceTitleKey(fieldId) {
  return resolveReferenceTitleKeys(fieldId)[0] ?? `${fieldId}Title`;
}

function resolveReferenceTitleKeyCandidates(fieldId) {
  return resolveReferenceTitleKeys(fieldId);
}

function resolveReferenceTitlesKey(fieldId) {
  return resolveReferenceTitlesKeys(fieldId)[0] ?? `${fieldId}Titles`;
}

function resolveReferenceTitlesKeyCandidates(fieldId) {
  return resolveReferenceTitlesKeys(fieldId);
}

function renderChipList(values, keyPrefix) {
  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
      {values.map((value, index) => (
        <Chip key={`${keyPrefix}-${value}-${index}`} size="small" label={value} variant="outlined" />
      ))}
    </Stack>
  );
}

function toDisplayValue(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return `${value}`;
}

function buildUnsupportedTypeDiagnostic(code, field) {
  const fieldId = typeof field?.id === "string" && field.id.length > 0 ? field.id : "unknown";
  const fieldType = normalizeFieldType(field) || "unknown";
  return {
    code,
    fieldId,
    fieldType,
    message: `Field '${fieldId}' uses unsupported type '${fieldType}'. Rendering is blocked.`
  };
}

function buildUnsupportedVariantDiagnostic(code, field, variant, target = "renderer") {
  const fieldId = typeof field?.id === "string" && field.id.length > 0 ? field.id : "unknown";
  const fieldType = normalizeFieldType(field) || "unknown";
  const normalizedVariant =
    typeof variant === "string" && variant.length > 0 ? variant : "unknown";
  return {
    code,
    fieldId,
    fieldType,
    variant: normalizedVariant,
    target,
    message: `Field '${fieldId}' type '${fieldType}' uses unsupported ${target} variant '${normalizedVariant}'. Rendering is blocked.`
  };
}

function resolveComputedResolverMeta(field) {
  const resolver = normalizeComputedResolverToken(field?.resolver);
  if (resolver !== null) {
    if (isSupportedComputedResolverToken(resolver)) {
      return {
        resolver,
        unsupportedResolver: null,
        sourceKey: "resolver"
      };
    }

    return {
      resolver: DEFAULT_COMPUTED_RESOLVER,
      unsupportedResolver: resolver,
      sourceKey: "resolver"
    };
  }

  const transform = normalizeComputedResolverToken(field?.transform);
  if (transform !== null) {
    if (isSupportedComputedResolverToken(transform)) {
      return {
        resolver: transform,
        unsupportedResolver: null,
        sourceKey: "transform"
      };
    }

    return {
      resolver: DEFAULT_COMPUTED_RESOLVER,
      unsupportedResolver: transform,
      sourceKey: "transform"
    };
  }

  return {
    resolver: DEFAULT_COMPUTED_RESOLVER,
    unsupportedResolver: null,
    sourceKey: null
  };
}

function buildUnsupportedComputedResolverDiagnostic(code, field, resolverToken, sourceKey) {
  const fieldId = typeof field?.id === "string" && field.id.length > 0 ? field.id : "unknown";
  const fromKey = sourceKey === "transform" ? "transform" : "resolver";
  return {
    code,
    fieldId,
    resolver: resolverToken,
    sourceKey: fromKey,
    message: `Field '${fieldId}' uses unsupported computed ${fromKey} '${resolverToken}'. Fallback resolver '${DEFAULT_COMPUTED_RESOLVER}' is active.`
  };
}

function applyComputedResolver(value, resolver) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return "";
  }

  const normalizedSource = value.trim();
  const resolverFn =
    COMPUTED_RESOLVER_REGISTRY[resolver] ?? COMPUTED_RESOLVER_REGISTRY[DEFAULT_COMPUTED_RESOLVER];
  return resolverFn(normalizedSource);
}

function resolveComputedEditorValue(field, formState) {
  const { resolver } = resolveComputedResolverMeta(field);
  const sourceField =
    typeof field?.source === "string" && field.source.length > 0 ? field.source : null;
  if (sourceField && typeof formState?.[sourceField] === "string") {
    return applyComputedResolver(formState[sourceField], resolver);
  }

  return typeof formState?.[field.id] === "string" ? formState[field.id] : "";
}

function toFieldControlId(field, suffix) {
  return `${field.id}-${suffix}`;
}


export {
  COLLECTION_FIELD_EDITOR_COMPUTED_RESOLVER_UNSUPPORTED,
  COLLECTION_FIELD_EDITOR_UNSUPPORTED_VARIANT,
  COLLECTION_FIELD_EDITOR_UNSUPPORTED_TYPE,
  COLLECTION_FIELD_RENDERER_COMPUTED_RESOLVER_UNSUPPORTED,
  COLLECTION_FIELD_RENDERER_UNSUPPORTED_VARIANT,
  COLLECTION_FIELD_RENDERER_UNSUPPORTED_TYPE,
  applyComputedResolver,
  buildUnsupportedComputedResolverDiagnostic,
  buildUnsupportedVariantDiagnostic,
  buildUnsupportedTypeDiagnostic,
  normalizeFieldType,
  renderChipList,
  resolveComputedEditorValue,
  resolveComputedResolverMeta,
  resolveReferenceTitleKey,
  resolveReferenceTitleKeyCandidates,
  resolveReferenceTitlesKey,
  resolveReferenceTitlesKeyCandidates,
  toDisplayValue,
  toFieldControlId,
  toReferenceInputLabel,
  toReferenceOptions
};

