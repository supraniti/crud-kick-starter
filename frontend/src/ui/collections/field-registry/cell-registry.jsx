import {
  COLLECTION_FIELD_RENDERER_COMPUTED_RESOLVER_UNSUPPORTED,
  COLLECTION_FIELD_RENDERER_UNSUPPORTED_VARIANT,
  COLLECTION_FIELD_RENDERER_UNSUPPORTED_TYPE,
  buildUnsupportedVariantDiagnostic,
  buildUnsupportedComputedResolverDiagnostic,
  buildUnsupportedTypeDiagnostic,
  normalizeFieldType,
  renderChipList,
  resolveComputedResolverMeta,
  resolveReferenceTitleKey,
  resolveReferenceTitleKeyCandidates,
  resolveReferenceTitlesKey,
  resolveReferenceTitlesKeyCandidates,
  toDisplayValue
} from "./shared-utils.jsx";
import { isHttpUrlValue } from "../../../runtime/shared-capability-bridges/value-contract-utils.mjs";
import {
  resolveCollectionFieldTypePlugin
} from "../../../runtime/shared-capability-bridges/collection-field-type-plugin-registry.mjs";

function renderBooleanCell({ field, item }) {
  return item[field.id] === true ? "Yes" : "No";
}

function renderEnumMultiCell({ field, item }) {
  const values = Array.isArray(item[field.id]) ? item[field.id] : [];
  return values.length > 0 ? renderChipList(values, `${item.id}-${field.id}`) : "-";
}

function renderReferenceCell({ field, item }) {
  const referenceTitle =
    resolveReferenceTitleKeyCandidates(field.id)
      .map((key) => item[key])
      .find((value) => value !== null && value !== undefined && `${value}`.length > 0) ??
    item[resolveReferenceTitleKey(field.id)];
  return referenceTitle ?? toDisplayValue(item[field.id]);
}

function renderReferenceMultiCell({ field, item }) {
  const rawValue = item[field.id];
  const resolvedTitles =
    resolveReferenceTitlesKeyCandidates(field.id)
      .map((key) => item[key])
      .find((value) => Array.isArray(value)) ??
    item[resolveReferenceTitlesKey(field.id)];
  const values = Array.isArray(resolvedTitles)
    ? resolvedTitles
    : Array.isArray(rawValue)
      ? rawValue
      : [];
  return values.length > 0 ? renderChipList(values, `${item.id}-${field.id}`) : "-";
}

function renderUrlCell({ field, item }) {
  const value = typeof item[field.id] === "string" ? item[field.id] : "";
  if (!isHttpUrlValue(value)) {
    return toDisplayValue(value);
  }

  return (
    <a href={value} target="_blank" rel="noreferrer">
      {value}
    </a>
  );
}

function renderStructuredSummaryCell({ field, item, typePlugin }) {
  const summarizeValue = typePlugin?.frontend?.cell?.summarizeValue;
  if (typeof summarizeValue === "function") {
    const summary = summarizeValue({
      value: item[field.id],
      fieldDescriptor: field
    });
    return toDisplayValue(summary);
  }

  const value = item[field.id];
  if (Array.isArray(value)) {
    return `${value.length}`;
  }
  if (value && typeof value === "object") {
    return "Object";
  }
  return toDisplayValue(value);
}

function renderDefaultCell({ field, item }) {
  return toDisplayValue(item[field.id]);
}

function renderUnsupportedCell({ field, item }) {
  return toDisplayValue(item[field.id]);
}

const fieldCellRendererRegistry = {
  boolean: renderBooleanCell,
  computed: renderDefaultCell,
  enum: renderDefaultCell,
  "enum-multi": renderEnumMultiCell,
  number: renderDefaultCell,
  reference: renderReferenceCell,
  "reference-multi": renderReferenceMultiCell,
  text: renderDefaultCell
};

function resolveCollectionFieldCellDefinition(field) {
  const fieldType = normalizeFieldType(field);
  const typePlugin = resolveCollectionFieldTypePlugin(fieldType);
  let renderCell = fieldCellRendererRegistry[fieldType] ?? renderUnsupportedCell;
  let diagnostic = null;
  if (typePlugin) {
    const pluginCellVariant =
      typeof typePlugin.frontend?.cell?.variant === "string"
        ? typePlugin.frontend.cell.variant
        : "";
    if (pluginCellVariant === "url-link") {
      renderCell = renderUrlCell;
    } else if (pluginCellVariant === "text") {
      renderCell = renderDefaultCell;
    } else if (pluginCellVariant === "date-text") {
      renderCell = renderDefaultCell;
    } else if (
      pluginCellVariant === "structured-summary" ||
      pluginCellVariant === "structured-array-count"
    ) {
      renderCell = (context) =>
        renderStructuredSummaryCell({
          ...context,
          typePlugin
        });
    } else {
      renderCell = renderUnsupportedCell;
      diagnostic = buildUnsupportedVariantDiagnostic(
        COLLECTION_FIELD_RENDERER_UNSUPPORTED_VARIANT,
        field,
        pluginCellVariant,
        "cell"
      );
    }
  } else if (fieldType.length > 0 && fieldCellRendererRegistry[fieldType] === undefined) {
    diagnostic = buildUnsupportedTypeDiagnostic(COLLECTION_FIELD_RENDERER_UNSUPPORTED_TYPE, field);
  } else if (fieldType === "computed") {
    const resolverMeta = resolveComputedResolverMeta(field);
    if (resolverMeta.unsupportedResolver) {
      diagnostic = buildUnsupportedComputedResolverDiagnostic(
        COLLECTION_FIELD_RENDERER_COMPUTED_RESOLVER_UNSUPPORTED,
        field,
        resolverMeta.unsupportedResolver,
        resolverMeta.sourceKey
      );
    }
  }

  return {
    renderCell,
    diagnostic
  };
}

function resolveCollectionFieldAlignment(field) {
  return normalizeFieldType(field) === "number" ? "right" : "left";
}


export {
  resolveCollectionFieldAlignment,
  resolveCollectionFieldCellDefinition
};

