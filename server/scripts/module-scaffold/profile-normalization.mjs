import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildDefaultCollectionFieldDescriptors, normalizeProfileCollection } from "./profile-collections.mjs";
import { defaultProfileRouteView, normalizeProfileRouteView } from "./profile-route-view.mjs";
import { normalizeSettingsDefinition } from "../../src/domains/reference/runtime-kernel/module-settings/schema-normalization.js";
import { resolveComputedResolverSettingOptionSchema } from "../../src/core/shared/capability-contracts/local-kernel/computed-resolver-catalog.mjs";
import {
  DEFAULT_PROFILE_CATEGORY_OPTIONS,
  DEFAULT_PROFILE_LABEL_OPTIONS,
  DEFAULT_PROFILE_STATUS_OPTIONS,
  SUPPORTED_INPUT_KEYS,
  SUPPORTED_PERSISTENCE_MODES,
  ScaffoldError,
  collectProfileUnknownFields,
  isKebabCaseIdentifier,
  normalizeIdPrefixSeed,
  parseBooleanFlag,
  parseInteger,
  toSingularLabel,
  toTitleFromId
} from "./shared.mjs";

const MODULE_SCAFFOLD_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(MODULE_SCAFFOLD_DIR, "..", "..", "..");
const PROFILE_RUNTIME_SERVICES_ALLOWED_KEYS = new Set(["services"]);
const PROFILE_RUNTIME_SERVICE_ALLOWED_KEYS = new Set(["id", "label", "description"]);

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function mapSettingsFieldPathToProfile(fieldPath) {
  if (typeof fieldPath !== "string" || fieldPath.length === 0) {
    return null;
  }

  if (fieldPath === "settings") {
    return "profile.includeSettings";
  }

  if (fieldPath.startsWith("settings.")) {
    return `profile.includeSettings.${fieldPath.slice("settings.".length)}`;
  }

  return null;
}

function toProfileSettingsDiagnostic(error, moduleId) {
  if (!error || typeof error !== "object") {
    return "profile.includeSettings is invalid";
  }

  const moduleToken = typeof moduleId === "string" && moduleId.length > 0 ? moduleId : "unknown";
  const mappedFieldPath = mapSettingsFieldPathToProfile(error.field);
  const baseMessage =
    typeof error.message === "string" && error.message.length > 0
      ? error.message
      : "profile.includeSettings is invalid";
  const normalizedMessage = baseMessage
    .replace(`Module '${moduleToken}' settings descriptor`, "profile.includeSettings")
    .replace(`Module '${moduleToken}' settings`, "profile.includeSettings")
    .replace(`Module '${moduleToken}'`, "profile.includeSettings");

  if (mappedFieldPath) {
    return `${mappedFieldPath}: ${normalizedMessage}`;
  }

  return normalizedMessage;
}

function normalizeProfileSettingsConfiguration(rawValue, moduleId, details) {
  if (rawValue === undefined) {
    return {
      includeSettings: true,
      settingsProfile: null
    };
  }

  if (typeof rawValue === "boolean") {
    return {
      includeSettings: rawValue,
      settingsProfile: null
    };
  }

  if (!isObject(rawValue)) {
    details.push("profile.includeSettings must be a boolean or object when provided");
    return {
      includeSettings: true,
      settingsProfile: null
    };
  }

  const normalizedDefinition = normalizeSettingsDefinition({
    id: typeof moduleId === "string" && moduleId.length > 0 ? moduleId : "unknown",
    settings: rawValue
  });
  if (!normalizedDefinition.ok) {
    details.push(toProfileSettingsDiagnostic(normalizedDefinition.error, moduleId));
    return {
      includeSettings: true,
      settingsProfile: null
    };
  }

  if (!normalizedDefinition.value) {
    details.push("profile.includeSettings.fields must include at least one field when object form is provided");
    return {
      includeSettings: true,
      settingsProfile: null
    };
  }

  return {
    includeSettings: true,
    settingsProfile: normalizedDefinition.value
  };
}

function normalizeProfileRuntimeService(rawService, servicePath, details) {
  if (!isObject(rawService)) {
    details.push(`${servicePath} must be an object`);
    return null;
  }

  for (const key of Object.keys(rawService)) {
    if (!PROFILE_RUNTIME_SERVICE_ALLOWED_KEYS.has(key)) {
      details.push(`${servicePath}.${key} is not supported`);
    }
  }

  const id = typeof rawService.id === "string" ? rawService.id.trim() : "";
  if (!isKebabCaseIdentifier(id)) {
    details.push(`${servicePath}.id must match kebab-case pattern`);
  }

  const label = typeof rawService.label === "string" ? rawService.label.trim() : "";
  if (label.length === 0) {
    details.push(`${servicePath}.label is required`);
  }

  if (rawService.description !== undefined && typeof rawService.description !== "string") {
    details.push(`${servicePath}.description must be a string when provided`);
  }

  return {
    id,
    label,
    description:
      typeof rawService.description === "string" && rawService.description.length > 0
        ? rawService.description
        : `${label} runtime service`
  };
}

function normalizeProfileRuntimeServicesConfiguration(rawValue, details) {
  if (rawValue === undefined) {
    return {
      includeRuntimeServices: true,
      runtimeServicesProfile: null
    };
  }

  if (typeof rawValue === "boolean") {
    return {
      includeRuntimeServices: rawValue,
      runtimeServicesProfile: null
    };
  }

  if (!isObject(rawValue)) {
    details.push("profile.includeRuntimeServices must be a boolean or object when provided");
    return {
      includeRuntimeServices: true,
      runtimeServicesProfile: null
    };
  }

  for (const key of Object.keys(rawValue)) {
    if (!PROFILE_RUNTIME_SERVICES_ALLOWED_KEYS.has(key)) {
      details.push(`profile.includeRuntimeServices.${key} is not supported`);
    }
  }

  if (!Array.isArray(rawValue.services) || rawValue.services.length === 0) {
    details.push("profile.includeRuntimeServices.services must be a non-empty array");
    return {
      includeRuntimeServices: true,
      runtimeServicesProfile: {
        services: []
      }
    };
  }

  const seenServiceIds = new Set();
  const normalizedServices = rawValue.services
    .map((service, serviceIndex) =>
      normalizeProfileRuntimeService(
        service,
        `profile.includeRuntimeServices.services[${serviceIndex}]`,
        details
      )
    )
    .filter(Boolean)
    .filter((service) => {
      if (seenServiceIds.has(service.id)) {
        details.push(`profile.includeRuntimeServices.services contains duplicated id '${service.id}'`);
        return false;
      }
      seenServiceIds.add(service.id);
      return true;
    });

  return {
    includeRuntimeServices: true,
    runtimeServicesProfile: {
      services: normalizedServices
    }
  };
}

function validateProfileComputedSettingsBindings({
  collections,
  includeSettings,
  settingsProfile,
  details
}) {
  const normalizedCollections = Array.isArray(collections) ? collections : [];
  const settingsFieldMap = new Map(
    Array.isArray(settingsProfile?.fields)
      ? settingsProfile.fields
          .filter((field) => field && typeof field.id === "string" && field.id.length > 0)
          .map((field) => [field.id, field])
      : []
  );

  for (const [collectionIndex, collection] of normalizedCollections.entries()) {
    const fieldDescriptors = Array.isArray(collection?.fieldDescriptors)
      ? collection.fieldDescriptors
      : [];
    for (const fieldDescriptor of fieldDescriptors) {
      if (
        fieldDescriptor?.type !== "computed" ||
        !fieldDescriptor.settings ||
        typeof fieldDescriptor.settings !== "object"
      ) {
        continue;
      }

      if (includeSettings !== true) {
        details.push(
          `profile.collections[${collectionIndex}].fields '${fieldDescriptor.id}' computed settings bindings require profile.includeSettings=true`
        );
        continue;
      }

      if (settingsFieldMap.size === 0) {
        continue;
      }

      const resolver =
        typeof fieldDescriptor.resolver === "string" && fieldDescriptor.resolver.length > 0
          ? fieldDescriptor.resolver
          : "slugify";
      for (const [optionKey, settingFieldId] of Object.entries(fieldDescriptor.settings)) {
        const optionSchema = resolveComputedResolverSettingOptionSchema(
          resolver,
          optionKey
        );
        if (!optionSchema) {
          details.push(
            `profile.collections[${collectionIndex}].fields '${fieldDescriptor.id}' settings option '${optionKey}' is not supported for resolver '${resolver}'`
          );
          continue;
        }

        const settingField = settingsFieldMap.get(settingFieldId);
        if (!settingField) {
          details.push(
            `profile.collections[${collectionIndex}].fields '${fieldDescriptor.id}' settings.${optionKey} references unknown setting '${settingFieldId}'`
          );
          continue;
        }

        const allowedSettingTypes = Array.isArray(optionSchema.settingTypes)
          ? optionSchema.settingTypes
          : [];
        if (
          allowedSettingTypes.length > 0 &&
          !allowedSettingTypes.includes(settingField.type)
        ) {
          details.push(
            `profile.collections[${collectionIndex}].fields '${fieldDescriptor.id}' settings.${optionKey} requires setting type ${allowedSettingTypes.join(", ")} but '${settingFieldId}' is '${settingField.type}'`
          );
        }
      }
    }
  }
}

function normalizeProfileInput(rawProfile) {
  if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
    throw new ScaffoldError(
      "MODULE_SCAFFOLDER_PROFILE_INVALID",
      "Scaffolder profile must be an object",
      ["profile must be an object"]
    );
  }

  const unknownFields = collectProfileUnknownFields(rawProfile);
  if (unknownFields.length > 0) {
    throw new ScaffoldError(
      "MODULE_SCAFFOLDER_PROFILE_UNKNOWN_FIELD",
      "Scaffolder profile contains unknown fields",
      unknownFields
    );
  }

  const moduleId = `${rawProfile.moduleId ?? ""}`.trim();
  const routeSegmentCandidate =
    rawProfile.routeSegment === undefined || rawProfile.routeSegment === null
      ? moduleId
      : `${rawProfile.routeSegment}`.trim();
  const routeSegment = routeSegmentCandidate.length > 0 ? routeSegmentCandidate : moduleId;
  const moduleLabel = `${rawProfile.navigationTitle ?? ""}`.trim();
  const collectionsInput = Array.isArray(rawProfile.collections) ? rawProfile.collections : null;
  const persistenceMode =
    typeof rawProfile.persistenceMode === "string"
      ? rawProfile.persistenceMode.trim().toLowerCase()
      : rawProfile.persistenceMode === undefined
        ? "auto"
        : "";

  const details = [];
  const unsupportedDetails = [];
  if (!isKebabCaseIdentifier(moduleId)) {
    details.push("profile.moduleId must match kebab-case pattern");
  }
  if (!isKebabCaseIdentifier(routeSegment)) {
    details.push("profile.routeSegment must match kebab-case pattern");
  }
  if (moduleLabel.length === 0) {
    details.push("profile.navigationTitle is required");
  }
  if (!Array.isArray(collectionsInput) || collectionsInput.length === 0) {
    details.push("profile.collections must be a non-empty array");
  }
  if (!SUPPORTED_PERSISTENCE_MODES.has(persistenceMode)) {
    details.push("profile.persistenceMode must be one of: auto, file, memory");
  }

  const collections = Array.isArray(collectionsInput)
    ? collectionsInput
        .map((collection, index) =>
          normalizeProfileCollection(collection, index, details, unsupportedDetails)
        )
        .filter(Boolean)
    : [];

  const routeView = normalizeProfileRouteView(rawProfile.routeView, {
    moduleId,
    moduleLabel,
    details,
    unsupportedDetails
  });
  const settingsConfiguration = normalizeProfileSettingsConfiguration(
    rawProfile.includeSettings,
    moduleId,
    details
  );
  const runtimeServicesConfiguration = normalizeProfileRuntimeServicesConfiguration(
    rawProfile.includeRuntimeServices,
    details
  );
  validateProfileComputedSettingsBindings({
    collections,
    includeSettings: settingsConfiguration.includeSettings,
    settingsProfile: settingsConfiguration.settingsProfile,
    details
  });

  if (details.length > 0) {
    throw new ScaffoldError(
      "MODULE_SCAFFOLDER_PROFILE_INVALID",
      "Scaffolder profile is invalid",
      details
    );
  }

  if (unsupportedDetails.length > 0) {
    throw new ScaffoldError(
      "MODULE_SCAFFOLDER_PROFILE_UNSUPPORTED_OPTION",
      "Scaffolder profile requests unsupported options",
      unsupportedDetails
    );
  }

  return {
    moduleId,
    routeSegment,
    moduleLabel,
    collections,
    routeView,
    persistenceMode,
    includeSettings: settingsConfiguration.includeSettings,
    settingsProfile: settingsConfiguration.settingsProfile,
    includeRuntimeServices: runtimeServicesConfiguration.includeRuntimeServices,
    runtimeServicesProfile: runtimeServicesConfiguration.runtimeServicesProfile,
    force: parseBooleanFlag(rawProfile.force),
    dryRun: parseBooleanFlag(rawProfile.dryRun)
  };
}

function normalizeLegacyCollection(rawInput, moduleId, moduleLabel, details) {
  const collectionId = `${rawInput.collectionId ?? moduleId}`.trim();
  const collectionLabel = `${rawInput.collectionLabel ?? moduleLabel}`.trim();
  const entitySingular = `${rawInput.entitySingular ?? toSingularLabel(collectionLabel)}`.trim();
  const idPrefix = `${rawInput.idPrefix ?? normalizeIdPrefixSeed(moduleId)}`
    .trim()
    .toLowerCase();

  if (!isKebabCaseIdentifier(collectionId)) {
    details.push("collectionId must match kebab-case pattern");
  }
  if (collectionLabel.length === 0) {
    details.push("collectionLabel is required");
  }
  if (!/^[A-Za-z][A-Za-z0-9 ]*$/.test(entitySingular)) {
    details.push("entitySingular must start with a letter and contain alphanumeric/spaces");
  }
  if (!/^[a-z][a-z0-9]{1,7}$/.test(idPrefix)) {
    details.push("idPrefix must match /^[a-z][a-z0-9]{1,7}$/");
  }

  return {
    id: collectionId,
    label: collectionLabel,
    entitySingular,
    idPrefix,
    behavior: {
      enforcePrimaryFieldUnique: true,
      enforceTitleUnique: true,
      requirePublishedOnWhenPublished: true
    },
    statusOptions: [...DEFAULT_PROFILE_STATUS_OPTIONS],
    categoryOptions: [...DEFAULT_PROFILE_CATEGORY_OPTIONS],
    labelOptions: [...DEFAULT_PROFILE_LABEL_OPTIONS],
    referenceCollectionId: "records",
    primaryFieldMinLength: 3,
    primaryFieldMaxLength: 120,
    titleMinLength: 3,
    titleMaxLength: 120,
    primaryField: "title",
    includeComputedSlug: true,
    extraFields: [],
    fieldDescriptors: buildDefaultCollectionFieldDescriptors({
      statusOptions: [...DEFAULT_PROFILE_STATUS_OPTIONS],
      categoryOptions: [...DEFAULT_PROFILE_CATEGORY_OPTIONS],
      labelOptions: [...DEFAULT_PROFILE_LABEL_OPTIONS],
      referenceCollectionId: "records",
      primaryFieldMinLength: 3,
      primaryFieldMaxLength: 120,
      titleMinLength: 3,
      titleMaxLength: 120,
      primaryField: "title",
      includeComputedSlug: true,
      extraFields: []
    })
  };
}

function normalizeInput(rawInput = {}) {
  const unknownKeys = Object.keys(rawInput).filter((key) => !SUPPORTED_INPUT_KEYS.has(key));
  const unsupportedFlags = Array.isArray(rawInput._unsupportedOptions)
    ? rawInput._unsupportedOptions
    : [];

  if (unknownKeys.length > 0 || unsupportedFlags.length > 0) {
    throw new ScaffoldError(
      "MODULE_SCAFFOLDER_UNSUPPORTED_OPTION",
      "Scaffolder input contains unsupported options",
      [...unsupportedFlags, ...unknownKeys]
    );
  }

  const hasProfile = Object.prototype.hasOwnProperty.call(rawInput, "profile");
  const legacyKeys = [
    "moduleId",
    "moduleLabel",
    "collectionId",
    "collectionLabel",
    "entitySingular",
    "idPrefix"
  ];

  if (hasProfile) {
    const overlappingLegacyKeys = legacyKeys.filter((key) =>
      Object.prototype.hasOwnProperty.call(rawInput, key)
    );
    if (overlappingLegacyKeys.length > 0) {
      throw new ScaffoldError(
        "MODULE_SCAFFOLDER_PROFILE_UNSUPPORTED_OPTION",
        "Scaffolder profile cannot be combined with legacy flat options",
        overlappingLegacyKeys.map((key) => `profile + ${key}`)
      );
    }
  }

  const normalizedProfile = hasProfile ? normalizeProfileInput(rawInput.profile) : null;
  const moduleId = `${normalizedProfile?.moduleId ?? rawInput.moduleId ?? ""}`.trim();
  const moduleLabel = `${normalizedProfile?.moduleLabel ?? rawInput.moduleLabel ?? toTitleFromId(moduleId)}`.trim();
  const icon = `${rawInput.icon ?? "inventory_2"}`.trim();
  const order = parseInteger(rawInput.order, 30);
  const targetDir = path.resolve(`${rawInput.targetDir ?? path.resolve(REPO_ROOT, "modules")}`);
  const persistenceMode = `${normalizedProfile?.persistenceMode ?? rawInput.persistenceMode ?? "auto"}`
    .trim()
    .toLowerCase();

  const details = [];
  if (!isKebabCaseIdentifier(moduleId)) {
    details.push("moduleId must match kebab-case pattern");
  }
  if (moduleLabel.length === 0) {
    details.push("moduleLabel is required");
  }
  if (icon.length === 0) {
    details.push("icon is required");
  }
  if (!Number.isInteger(order) || order < 1 || order > 999) {
    details.push("order must be an integer between 1 and 999");
  }
  if (!SUPPORTED_PERSISTENCE_MODES.has(persistenceMode)) {
    details.push("persistenceMode must be one of: auto, file, memory");
  }

  const collections = normalizedProfile
    ? normalizedProfile.collections
    : [normalizeLegacyCollection(rawInput, moduleId, moduleLabel, details)];
  const routeView =
    normalizedProfile?.routeView ??
    defaultProfileRouteView({
      moduleId,
      moduleLabel
    });

  if (collections.length === 0) {
    details.push("at least one collection is required");
  }

  if (details.length > 0) {
    throw new ScaffoldError(
      "MODULE_SCAFFOLDER_INPUT_INVALID",
      "Scaffolder input is invalid",
      details
    );
  }

  return {
    moduleId,
    routeSegment: normalizedProfile?.routeSegment ?? moduleId,
    moduleLabel,
    collections,
    routeView,
    includeSettings: normalizedProfile?.includeSettings ?? true,
    settingsProfile: normalizedProfile?.settingsProfile ?? null,
    includeRuntimeServices: normalizedProfile?.includeRuntimeServices ?? true,
    runtimeServicesProfile: normalizedProfile?.runtimeServicesProfile ?? null,
    icon,
    order,
    persistenceMode,
    targetDir,
    force:
      normalizedProfile !== null
        ? normalizedProfile.force || parseBooleanFlag(rawInput.force)
        : parseBooleanFlag(rawInput.force),
    dryRun:
      normalizedProfile !== null
        ? normalizedProfile.dryRun || parseBooleanFlag(rawInput.dryRun)
        : parseBooleanFlag(rawInput.dryRun)
  };
}

export { ScaffoldError, buildDefaultCollectionFieldDescriptors, normalizeInput };


