import {
  COLLECTION_FIELD_EDITOR_COMPUTED_RESOLVER_UNSUPPORTED,
  COLLECTION_FIELD_EDITOR_UNSUPPORTED_VARIANT,
  COLLECTION_FIELD_EDITOR_UNSUPPORTED_TYPE,
  buildUnsupportedComputedResolverDiagnostic,
  buildUnsupportedTypeDiagnostic,
  buildUnsupportedVariantDiagnostic,
  normalizeFieldType,
  resolveComputedResolverMeta
} from "./shared-utils.jsx";
import {
  resolveCollectionFieldTypePlugin
} from "../../../runtime/shared-capability-bridges/collection-field-type-plugin-registry.mjs";
import {
  renderBooleanEditor,
  renderComputedEditor,
  renderEnumEditor,
  renderEnumMultiEditor,
  renderNumberEditor,
  renderPluginTextInputEditor,
  renderTextEditor,
  renderUnsupportedEditor
} from "./editor-registry/parts/01-basic-editors.jsx";
import {
  renderReferenceEditor,
  renderReferenceMultiEditor
} from "./editor-registry/parts/02-reference-editors.jsx";
import {
  renderStructuredObjectArrayEditor,
  renderStructuredObjectEditor
} from "./editor-registry/parts/04-structured-editors.jsx";

const fieldEditorRegistry = {
  boolean: renderBooleanEditor,
  enum: renderEnumEditor,
  "enum-multi": renderEnumMultiEditor,
  reference: renderReferenceEditor,
  "reference-multi": renderReferenceMultiEditor,
  number: renderNumberEditor,
  text: renderTextEditor,
  computed: renderComputedEditor
};

function resolveCollectionFieldEditorDefinition(field) {
  const fieldType = normalizeFieldType(field);
  const typePlugin = resolveCollectionFieldTypePlugin(fieldType);
  let renderEditor = fieldEditorRegistry[fieldType] ?? renderUnsupportedEditor;
  let diagnostic = null;
  if (typePlugin) {
    const pluginEditorVariant =
      typeof typePlugin.frontend?.editor?.variant === "string"
        ? typePlugin.frontend.editor.variant
        : "";
    if (pluginEditorVariant === "text-input") {
      const pluginInputType =
        typeof typePlugin.frontend.editor.inputType === "string" &&
        typePlugin.frontend.editor.inputType.length > 0
          ? typePlugin.frontend.editor.inputType
          : "text";
      const pluginFullWidth = typePlugin.frontend.editor.fullWidth === true;
      const pluginInputLabelShrink = typePlugin.frontend.editor.inputLabelShrink === true;
      renderEditor = (context) =>
        renderPluginTextInputEditor({
          ...context,
          inputType: pluginInputType,
          fullWidth: pluginFullWidth,
          inputLabelShrink: pluginInputLabelShrink
        });
    } else if (pluginEditorVariant === "structured-object") {
      renderEditor = renderStructuredObjectEditor;
    } else if (pluginEditorVariant === "structured-object-array") {
      renderEditor = renderStructuredObjectArrayEditor;
    } else {
      renderEditor = renderUnsupportedEditor;
      diagnostic = buildUnsupportedVariantDiagnostic(
        COLLECTION_FIELD_EDITOR_UNSUPPORTED_VARIANT,
        field,
        pluginEditorVariant,
        "editor"
      );
    }
  } else if (fieldEditorRegistry[fieldType] === undefined) {
    diagnostic = buildUnsupportedTypeDiagnostic(COLLECTION_FIELD_EDITOR_UNSUPPORTED_TYPE, field);
  } else if (fieldType === "computed") {
    const resolverMeta = resolveComputedResolverMeta(field);
    if (resolverMeta.unsupportedResolver) {
      diagnostic = buildUnsupportedComputedResolverDiagnostic(
        COLLECTION_FIELD_EDITOR_COMPUTED_RESOLVER_UNSUPPORTED,
        field,
        resolverMeta.unsupportedResolver,
        resolverMeta.sourceKey
      );
    }
  }

  return {
    renderEditor,
    diagnostic
  };
}

export { resolveCollectionFieldEditorDefinition };
