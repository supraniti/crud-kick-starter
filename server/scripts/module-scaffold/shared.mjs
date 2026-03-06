import {
  ROUTE_VIEW_KIND_LIST,
  ROUTE_VIEW_QUICK_ACTION_LIST
} from "../../src/core/module-registry-helpers/route-view-contract.js";
import { singularFromValue } from "../../src/core/shared/capability-contracts/local-kernel/singularization.mjs";
import {
  COLLECTION_FIELD_ID_PATTERN_LABEL,
  isCollectionFieldId,
  isSupportedCollectionFieldType,
  listSupportedCollectionFieldTypesLabel
} from "../../src/core/shared/capability-contracts/local-kernel/collection-field-catalog.mjs";

const SUPPORTED_INPUT_KEYS = new Set([
  "profile",
  "moduleId",
  "moduleLabel",
  "collectionId",
  "collectionLabel",
  "entitySingular",
  "icon",
  "order",
  "idPrefix",
  "persistenceMode",
  "targetDir",
  "force",
  "dryRun",
  "_unsupportedOptions"
]);

const SUPPORTED_PROFILE_KEYS = new Set([
  "moduleId",
  "routeSegment",
  "navigationTitle",
  "collections",
  "persistenceMode",
  "routeView",
  "includeSettings",
  "includeRuntimeServices"
]);

const SUPPORTED_PROFILE_COLLECTION_KEYS = new Set([
  "id",
  "label",
  "entitySingular",
  "idPrefix",
  "primaryField",
  "fields",
  "behavior",
  "statusOptions",
  "categoryOptions",
  "labelOptions",
  "referenceCollectionId",
  "primaryFieldMinLength",
  "primaryFieldMaxLength",
  "titleMinLength",
  "titleMaxLength",
  "includeComputedSlug",
  "extraFields"
]);
const SUPPORTED_PROFILE_COLLECTION_BEHAVIOR_KEYS = new Set([
  "enforcePrimaryFieldUnique",
  "enforceTitleUnique",
  "requirePublishedOnWhenPublished"
]);

const SUPPORTED_PERSISTENCE_MODES = new Set(["auto", "file", "memory"]);
const SUPPORTED_PROFILE_FIELD_DESCRIPTOR_KEYS = new Set([
  "id",
  "label",
  "type",
  "required",
  "minLength",
  "maxLength",
  "min",
  "max",
  "options",
  "collectionId",
  "default",
  "defaultValue",
  "source",
  "resolver",
  "transform",
  "settings"
]);
const SUPPORTED_COLLECTION_FIELD_TYPES_LABEL = listSupportedCollectionFieldTypesLabel();
const SUPPORTED_PROFILE_ROUTE_VIEW_KEYS = new Set([
  "kind",
  "entrypoint",
  "viewId",
  "bannerMessage",
  "capabilities",
  "quickActions",
  "actions"
]);
const SUPPORTED_PROFILE_ROUTE_VIEW_CAPABILITY_KEYS = new Set(["usesCollectionsDomain"]);
const SUPPORTED_PROFILE_ROUTE_VIEW_QUICK_ACTIONS = new Set(ROUTE_VIEW_QUICK_ACTION_LIST);
const SUPPORTED_PROFILE_ROUTE_VIEW_KINDS = new Set(ROUTE_VIEW_KIND_LIST);
const SUPPORTED_PROFILE_ROUTE_VIEW_ACTION_KEYS = new Set([
  "id",
  "label",
  "type",
  "route",
  "href",
  "target",
  "commandId",
  "payload"
]);
const SUPPORTED_PROFILE_ROUTE_VIEW_ACTION_ROUTE_KEYS = new Set(["moduleId", "state"]);
const RESERVED_COLLECTION_FIELD_IDS = new Set([
  "title",
  "status",
  "category",
  "labels",
  "publishedOn",
  "recordId",
  "slug"
]);
const DEFAULT_PROFILE_STATUS_OPTIONS = Object.freeze(["draft", "review", "published"]);
const DEFAULT_PROFILE_CATEGORY_OPTIONS = Object.freeze(["news", "guide", "ops"]);
const DEFAULT_PROFILE_LABEL_OPTIONS = Object.freeze(["featured", "engineering", "release"]);

class ScaffoldError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = "ScaffoldError";
    this.code = code;
    this.details = Array.isArray(details) ? details : [];
  }
}

function toTitleFromId(moduleId) {
  return `${moduleId}`
    .split("-")
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}

function toSingularLabel(label) {
  return singularFromValue(label);
}

function toKebabCaseSeed(value) {
  return `${value}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeIdPrefixSeed(value) {
  const compact = toKebabCaseSeed(value).replace(/-/g, "");
  if (compact.length >= 2) {
    return compact.slice(0, 8);
  }
  return "modx";
}

function isKebabCaseIdentifier(value) {
  return /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value);
}

function parseBooleanFlag(value) {
  return value === true;
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(`${value ?? ""}`, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return parsed;
}

function isSupportedProfileFieldType(value) {
  return isSupportedCollectionFieldType(value);
}

function collectProfileUnknownFields(profileInput) {
  const unknownFields = [];

  for (const key of Object.keys(profileInput)) {
    if (!SUPPORTED_PROFILE_KEYS.has(key)) {
      unknownFields.push(`profile.${key}`);
    }
  }

  if (Array.isArray(profileInput.collections)) {
    profileInput.collections.forEach((collection, index) => {
      if (!collection || typeof collection !== "object" || Array.isArray(collection)) {
        return;
      }

      for (const key of Object.keys(collection)) {
        if (!SUPPORTED_PROFILE_COLLECTION_KEYS.has(key)) {
          unknownFields.push(`profile.collections[${index}].${key}`);
        }
      }

      if (
        collection.behavior &&
        typeof collection.behavior === "object" &&
        !Array.isArray(collection.behavior)
      ) {
        for (const key of Object.keys(collection.behavior)) {
          if (!SUPPORTED_PROFILE_COLLECTION_BEHAVIOR_KEYS.has(key)) {
            unknownFields.push(`profile.collections[${index}].behavior.${key}`);
          }
        }
      }

      if (Array.isArray(collection.extraFields)) {
        collection.extraFields.forEach((field, fieldIndex) => {
          if (!field || typeof field !== "object" || Array.isArray(field)) {
            return;
          }

          for (const key of Object.keys(field)) {
            if (!SUPPORTED_PROFILE_FIELD_DESCRIPTOR_KEYS.has(key)) {
              unknownFields.push(
                `profile.collections[${index}].extraFields[${fieldIndex}].${key}`
              );
            }
          }
        });
      }

      if (Array.isArray(collection.fields)) {
        collection.fields.forEach((field, fieldIndex) => {
          if (!field || typeof field !== "object" || Array.isArray(field)) {
            return;
          }

          for (const key of Object.keys(field)) {
            if (!SUPPORTED_PROFILE_FIELD_DESCRIPTOR_KEYS.has(key)) {
              unknownFields.push(`profile.collections[${index}].fields[${fieldIndex}].${key}`);
            }
          }
        });
      }
    });
  }

  if (
    profileInput.routeView &&
    typeof profileInput.routeView === "object" &&
    !Array.isArray(profileInput.routeView)
  ) {
    for (const key of Object.keys(profileInput.routeView)) {
      if (!SUPPORTED_PROFILE_ROUTE_VIEW_KEYS.has(key)) {
        unknownFields.push(`profile.routeView.${key}`);
      }
    }

    if (
      profileInput.routeView.capabilities &&
      typeof profileInput.routeView.capabilities === "object" &&
      !Array.isArray(profileInput.routeView.capabilities)
    ) {
      for (const key of Object.keys(profileInput.routeView.capabilities)) {
        if (!SUPPORTED_PROFILE_ROUTE_VIEW_CAPABILITY_KEYS.has(key)) {
          unknownFields.push(`profile.routeView.capabilities.${key}`);
        }
      }
    }

    if (Array.isArray(profileInput.routeView.actions)) {
      profileInput.routeView.actions.forEach((action, actionIndex) => {
        if (!action || typeof action !== "object" || Array.isArray(action)) {
          return;
        }

        for (const key of Object.keys(action)) {
          if (!SUPPORTED_PROFILE_ROUTE_VIEW_ACTION_KEYS.has(key)) {
            unknownFields.push(`profile.routeView.actions[${actionIndex}].${key}`);
          }
        }

        if (action.route && typeof action.route === "object" && !Array.isArray(action.route)) {
          for (const routeKey of Object.keys(action.route)) {
            if (!SUPPORTED_PROFILE_ROUTE_VIEW_ACTION_ROUTE_KEYS.has(routeKey)) {
              unknownFields.push(
                `profile.routeView.actions[${actionIndex}].route.${routeKey}`
              );
            }
          }
        }
      });
    }
  }

  return unknownFields;
}


export {
  COLLECTION_FIELD_ID_PATTERN_LABEL,
  DEFAULT_PROFILE_CATEGORY_OPTIONS,
  DEFAULT_PROFILE_LABEL_OPTIONS,
  DEFAULT_PROFILE_STATUS_OPTIONS,
  RESERVED_COLLECTION_FIELD_IDS,
  SUPPORTED_INPUT_KEYS,
  SUPPORTED_PERSISTENCE_MODES,
  SUPPORTED_COLLECTION_FIELD_TYPES_LABEL,
  isSupportedProfileFieldType,
  SUPPORTED_PROFILE_ROUTE_VIEW_CAPABILITY_KEYS,
  SUPPORTED_PROFILE_ROUTE_VIEW_ACTION_KEYS,
  SUPPORTED_PROFILE_ROUTE_VIEW_QUICK_ACTIONS,
  SUPPORTED_PROFILE_ROUTE_VIEW_KINDS,
  ScaffoldError,
  collectProfileUnknownFields,
  isCollectionFieldId,
  isKebabCaseIdentifier,
  normalizeIdPrefixSeed,
  parseBooleanFlag,
  parseInteger,
  toSingularLabel,
  toTitleFromId
};

