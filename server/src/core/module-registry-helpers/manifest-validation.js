import {
  isNonCollectionBuiltinRouteViewKind,
  ROUTE_VIEW_QUICK_ACTION_LIST,
  ROUTE_VIEW_QUICK_ACTION_PATTERN,
  normalizeRouteViewKind,
  normalizeRouteViewAction,
  normalizeRouteViewEntrypoint
} from "./route-view-contract.js";
import { normalizeSettingsDefinition } from "./module-settings-schema-normalization.js";
import {
  DEFAULT_COMPUTED_RESOLVER,
  resolveComputedResolverSettingOptionSchema,
  SUPPORTED_COMPUTED_RESOLVERS_LABEL,
  isSupportedComputedResolverToken,
  normalizeComputedResolverToken
} from "../shared/capability-contracts/computed-resolver-catalog.js";
import {
  COLLECTION_FIELD_ID_PATTERN_LABEL,
  isSupportedCollectionFieldType,
  listSupportedCollectionFieldTypesLabel,
  isCollectionFieldId,
  isReferenceCollectionFieldType
} from "../shared/capability-contracts/collection-field-catalog.js";
import {
  COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS_LABEL,
  normalizeCollectionFieldTypePluginSchemaKind,
  resolveCollectionFieldTypePlugin
} from "../shared/capability-contracts/collection-field-type-plugin-registry.js";
import {
  normalizeCollectionFieldDefaultValue,
  resolveCollectionFieldDefaultRaw
} from "./manifest-validation-field-defaults.js";
import {
  createReferenceUiDefinitionNormalizer
} from "./parts/01-reference-ui-normalization.js";
import {
  createCollectionBehaviorDefinitionNormalizer
} from "./parts/02-collection-behavior-normalization.js";
import {
  createUiRouteViewDefinitionNormalizer
} from "./parts/03-ui-route-view-normalization.js";
import {
  createComputedCollectionFieldNormalizer
} from "./parts/04-computed-field-normalization.js";
import {
  createCollectionFieldDefinitionNormalizer
} from "./parts/05-collection-field-normalization.js";
import {
  createCollectionDefinitionNormalizer
} from "./parts/06-collection-definition-normalization.js";
import {
  createCollectionComputedSettingsBindingsValidator
} from "./parts/07-computed-settings-bindings-validation.js";
import {
  createRuntimeDefinitionNormalizer
} from "./parts/08-runtime-definition-normalization.js";
const SUPPORTED_CONTRACT_VERSION = 1;
const MODULE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ROUTE_SEGMENT_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const ENTITY_SINGULAR_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const COLLECTION_BEHAVIOR_ALLOWED_KEYS = new Set([
  "enforcePrimaryFieldUnique",
  "enforceTitleUnique",
  "requirePublishedOnWhenPublished"
]);
const COLLECTION_FIELD_ALLOWED_KEYS = new Set([
  "id",
  "label",
  "type",
  "required",
  "minLength",
  "maxLength",
  "min",
  "max",
  "options",
  "constraints",
  "objectSchema",
  "objectArrayConstraints",
  "collectionId",
  "default",
  "defaultValue",
  "source",
  "resolver",
  "transform",
  "settings",
  "labelField",
  "onDelete",
  "onDeleteSetting",
  "referenceUi"
]);
const REFERENCE_DELETE_POLICY_ALLOWED_VALUES = new Set(["restrict", "nullify"]);
const {
  normalizeReferenceUiFilterDefinition,
  normalizeReferenceUiVisibleWhenDefinition,
  normalizeReferenceUiInlineCreateDefaults,
  normalizeReferenceUiDefinition
} = createReferenceUiDefinitionNormalizer({
  collectionFieldIdPatternLabel: COLLECTION_FIELD_ID_PATTERN_LABEL,
  isCollectionFieldId,
  routeSegmentPattern: ROUTE_SEGMENT_PATTERN,
  validationError
});
const {
  normalizeCollectionBehaviorDefinition
} = createCollectionBehaviorDefinitionNormalizer({
  collectionBehaviorAllowedKeys: COLLECTION_BEHAVIOR_ALLOWED_KEYS,
  validationError
});
const {
  normalizeUiRouteViewDefinition
} = createUiRouteViewDefinitionNormalizer({
  routeSegmentPattern: ROUTE_SEGMENT_PATTERN,
  routeViewQuickActionList: ROUTE_VIEW_QUICK_ACTION_LIST,
  routeViewQuickActionPattern: ROUTE_VIEW_QUICK_ACTION_PATTERN,
  normalizeRouteViewKind,
  isNonCollectionBuiltinRouteViewKind,
  normalizeRouteViewEntrypoint,
  normalizeRouteViewAction,
  validationError
});
const {
  normalizeComputedCollectionFieldDefinition
} = createComputedCollectionFieldNormalizer({
  collectionFieldIdPatternLabel: COLLECTION_FIELD_ID_PATTERN_LABEL,
  defaultComputedResolver: DEFAULT_COMPUTED_RESOLVER,
  isCollectionFieldId,
  isSupportedComputedResolverToken,
  normalizeComputedResolverToken,
  resolveComputedResolverSettingOptionSchema,
  supportedComputedResolversLabel: SUPPORTED_COMPUTED_RESOLVERS_LABEL,
  validationError
});
const {
  normalizeCollectionFieldDefinition
} = createCollectionFieldDefinitionNormalizer({
  collectionFieldAllowedKeys: COLLECTION_FIELD_ALLOWED_KEYS,
  collectionFieldIdPatternLabel: COLLECTION_FIELD_ID_PATTERN_LABEL,
  collectionFieldTypePluginSchemaKindsLabel: COLLECTION_FIELD_TYPE_PLUGIN_SCHEMA_KINDS_LABEL,
  referenceDeletePolicyAllowedValues: REFERENCE_DELETE_POLICY_ALLOWED_VALUES,
  routeSegmentPattern: ROUTE_SEGMENT_PATTERN,
  isCollectionFieldId,
  isSupportedCollectionFieldType,
  listSupportedCollectionFieldTypesLabel,
  isReferenceCollectionFieldType,
  resolveCollectionFieldTypePlugin,
  normalizeCollectionFieldTypePluginSchemaKind,
  normalizeReferenceUiDefinition,
  normalizeComputedCollectionFieldDefinition,
  resolveCollectionFieldDefaultRaw,
  normalizeCollectionFieldDefaultValue,
  validationError
});
const {
  normalizeCollectionDefinition
} = createCollectionDefinitionNormalizer({
  entitySingularPattern: ENTITY_SINGULAR_PATTERN,
  normalizeCollectionFieldDefinition,
  normalizeCollectionBehaviorDefinition,
  validationError
});
const {
  validateCollectionComputedSettingsBindings
} = createCollectionComputedSettingsBindingsValidator({
  defaultComputedResolver: DEFAULT_COMPUTED_RESOLVER,
  resolveComputedResolverSettingOptionSchema,
  validationError
});
const {
  normalizeRuntimeDefinition
} = createRuntimeDefinitionNormalizer({
  validationError
});

function validationError(code, message, field) {
  return {
    code,
    message,
    field
  };
}

function normalizeUiDefinition(ui) {
  if (ui === undefined) {
    return {
      ok: true,
      value: {}
    };
  }

  if (!ui || typeof ui !== "object" || Array.isArray(ui)) {
    return {
      ok: false,
      error: validationError("MODULE_MANIFEST_INVALID", "UI definition must be an object", "ui")
    };
  }

  const normalizedUi = { ...ui };
  const navigation = ui.navigation;
  if (navigation !== undefined) {
    if (!navigation || typeof navigation !== "object" || Array.isArray(navigation)) {
      return {
        ok: false,
        error: validationError(
          "MODULE_MANIFEST_INVALID",
          "UI navigation definition must be an object",
          "ui.navigation"
        )
      };
    }

    const normalizedNavigation = { ...navigation };
    if (Object.prototype.hasOwnProperty.call(navigation, "routeSegment")) {
      const routeSegment = navigation.routeSegment;
      if (typeof routeSegment !== "string") {
        return {
          ok: false,
          error: validationError(
            "MODULE_MANIFEST_INVALID",
            "UI navigation routeSegment must be a string",
            "ui.navigation.routeSegment"
          )
        };
      }

      const normalizedRouteSegment = routeSegment.trim();
      if (!ROUTE_SEGMENT_PATTERN.test(normalizedRouteSegment)) {
        return {
          ok: false,
          error: validationError(
            "MODULE_MANIFEST_INVALID",
            "UI navigation routeSegment must be lowercase kebab-case",
            "ui.navigation.routeSegment"
          )
        };
      }

      normalizedNavigation.routeSegment = normalizedRouteSegment;
    }

    normalizedUi.navigation = normalizedNavigation;
  }

  const routeViewValidation = normalizeUiRouteViewDefinition(ui.routeView);
  if (!routeViewValidation.ok) {
    return routeViewValidation;
  }
  if (routeViewValidation.value !== null) {
    normalizedUi.routeView = routeViewValidation.value;
  }

  return {
    ok: true,
    value: normalizedUi
  };
}

function validateManifestHeader(manifest) {
  if (manifest.contractVersion !== SUPPORTED_CONTRACT_VERSION) {
    return validationError(
      "MODULE_MANIFEST_CONTRACT_VERSION_UNSUPPORTED",
      `Unsupported module manifest contract version: ${manifest.contractVersion}`,
      "contractVersion"
    );
  }

  if (typeof manifest.id !== "string" || !MODULE_ID_PATTERN.test(manifest.id)) {
    return validationError(
      "MODULE_MANIFEST_ID_INVALID",
      "Module id must be lowercase kebab-case",
      "id"
    );
  }

  if (typeof manifest.version !== "string" || manifest.version.length === 0) {
    return validationError("MODULE_MANIFEST_INVALID", "Module version is required", "version");
  }

  if (typeof manifest.name !== "string" || manifest.name.length === 0) {
    return validationError("MODULE_MANIFEST_INVALID", "Module name is required", "name");
  }

  if (!Array.isArray(manifest.capabilities)) {
    return validationError(
      "MODULE_MANIFEST_INVALID",
      "Capabilities array is required",
      "capabilities"
    );
  }

  const uniqueCapabilities = new Set(manifest.capabilities);
  if (uniqueCapabilities.size !== manifest.capabilities.length) {
    return validationError(
      "MODULE_MANIFEST_DUPLICATE_CAPABILITY",
      "Capabilities must be unique",
      "capabilities"
    );
  }

  if (
    typeof manifest.lifecycle !== "object" ||
    manifest.lifecycle === null ||
    typeof manifest.lifecycle.install !== "string" ||
    typeof manifest.lifecycle.uninstall !== "string"
  ) {
    return validationError(
      "MODULE_MANIFEST_INVALID",
      "Lifecycle install/uninstall hook ids are required",
      "lifecycle"
    );
  }

  if (manifest.collections !== undefined && !Array.isArray(manifest.collections)) {
    return validationError(
      "MODULE_MANIFEST_INVALID",
      "Collections must be an array when provided",
      "collections"
    );
  }

  return null;
}

function normalizeManifestCollections(collections = []) {
  const normalizedCollections = [];
  for (const [index, collection] of collections.entries()) {
    const normalized = normalizeCollectionDefinition(collection, index);
    if (!normalized.ok) {
      return normalized;
    }

    normalizedCollections.push(normalized.value);
  }

  return {
    ok: true,
    value: normalizedCollections
  };
}

function normalizeManifestSettings(manifestId, settings) {
  const settingsValidation = normalizeSettingsDefinition({
    id: manifestId,
    settings
  });
  if (!settingsValidation.ok) {
    return {
      ok: false,
      error: validationError(
        "MODULE_MANIFEST_INVALID",
        settingsValidation.error.message,
        settingsValidation.error.field ?? "settings"
      )
    };
  }

  return settingsValidation;
}

function toNormalizedManifestValue({
  manifest,
  normalizedCollections,
  settings,
  ui,
  runtime
}) {
  return {
    contractVersion: SUPPORTED_CONTRACT_VERSION,
    id: manifest.id,
    version: manifest.version,
    name: manifest.name,
    capabilities: [...manifest.capabilities],
    lifecycle: {
      install: manifest.lifecycle.install,
      uninstall: manifest.lifecycle.uninstall
    },
    dependencies: Array.isArray(manifest.dependencies) ? [...manifest.dependencies] : [],
    settings: settings
      ? {
          contractVersion: settings.contractVersion,
          fields: settings.fields.map((field) => ({ ...field }))
        }
      : {},
    ui,
    metadata:
      typeof manifest.metadata === "object" && manifest.metadata !== null ? manifest.metadata : {},
    collections: normalizedCollections,
    runtime
  };
}

function validateModuleManifest(input) {
  const manifest = input ?? {};
  const headerError = validateManifestHeader(manifest);
  if (headerError) {
    return {
      ok: false,
      error: headerError
    };
  }

  const collectionsValidation = normalizeManifestCollections(manifest.collections ?? []);
  if (!collectionsValidation.ok) {
    return collectionsValidation;
  }
  const normalizedCollections = collectionsValidation.value;

  const runtimeValidation = normalizeRuntimeDefinition(manifest.runtime);
  if (!runtimeValidation.ok) {
    return runtimeValidation;
  }

  const uiValidation = normalizeUiDefinition(manifest.ui);
  if (!uiValidation.ok) {
    return uiValidation;
  }

  const settingsValidation = normalizeManifestSettings(manifest.id, manifest.settings);
  if (!settingsValidation.ok) {
    return settingsValidation;
  }

  const computedSettingsValidation = validateCollectionComputedSettingsBindings(
    normalizedCollections,
    settingsValidation.value
  );
  if (!computedSettingsValidation.ok) {
    return computedSettingsValidation;
  }

  return {
    ok: true,
    value: toNormalizedManifestValue({
      manifest,
      normalizedCollections,
      settings: settingsValidation.value,
      ui: uiValidation.value,
      runtime: runtimeValidation.value
    })
  };
}

export { validateModuleManifest };



