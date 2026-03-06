import {
  resolveCollectionFieldTypePlugin
} from "../../src/core/shared/capability-contracts/local-kernel/collection-field-type-plugin-registry.mjs";
import { isBuiltinRouteViewKind } from "../../src/core/module-registry-helpers/route-view-contract.js";

function toPascalCase(value) {
  return `${value}`
    .split(/[^A-Za-z0-9]+/g)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
}

function replaceTemplateText(text, replacements) {
  let next = text;
  for (const [from, to] of replacements) {
    next = next.split(from).join(to);
  }
  return next;
}

function buildReplacements(normalized) {
  const firstCollection = normalized.collections[0];
  const entityLower = firstCollection.entitySingular.toLowerCase();
  const entityTitle =
    firstCollection.entitySingular[0].toUpperCase() + firstCollection.entitySingular.slice(1);
  const entityUpper = firstCollection.entitySingular.toUpperCase();

  return {
    manifest: [
      ["Authors", normalized.moduleLabel],
      ["authors", normalized.moduleId],
      ["AUTHOR", entityUpper],
      ["Author", entityTitle],
      ["author", entityLower],
      ["aut-", `${firstCollection.idPrefix}-`]
    ]
  };
}

function resolveEnforcePrimaryFieldUnique(collection = {}) {
  if (typeof collection?.behavior?.enforcePrimaryFieldUnique === "boolean") {
    return collection.behavior.enforcePrimaryFieldUnique;
  }
  if (typeof collection?.behavior?.enforceTitleUnique === "boolean") {
    return collection.behavior.enforceTitleUnique;
  }
  return true;
}

function toManifestFieldDescriptor(fieldDescriptor) {
  const base = {
    id: fieldDescriptor.id,
    label: fieldDescriptor.label,
    type: fieldDescriptor.type,
    required: fieldDescriptor.required === true
  };

  const typePlugin = resolveCollectionFieldTypePlugin(fieldDescriptor.type);
  const usesLengthConstraintContract =
    fieldDescriptor.type === "text" ||
    typeof typePlugin?.normalizeDescriptorConstraints === "function";
  if (usesLengthConstraintContract) {
    if (Number.isInteger(fieldDescriptor.minLength)) {
      base.minLength = fieldDescriptor.minLength;
    }
    if (Number.isInteger(fieldDescriptor.maxLength)) {
      base.maxLength = fieldDescriptor.maxLength;
    }
  }

  if (fieldDescriptor.type === "number") {
    if (Number.isFinite(fieldDescriptor.min)) {
      base.min = fieldDescriptor.min;
    }
    if (Number.isFinite(fieldDescriptor.max)) {
      base.max = fieldDescriptor.max;
    }
  }

  if (fieldDescriptor.type === "enum" || fieldDescriptor.type === "enum-multi") {
    base.options = fieldDescriptor.options;
  }

  if (fieldDescriptor.type === "reference" || fieldDescriptor.type === "reference-multi") {
    base.collectionId = fieldDescriptor.collectionId;
  }

  if (fieldDescriptor.type === "computed") {
    base.source = fieldDescriptor.source;
    base.resolver = fieldDescriptor.resolver ?? fieldDescriptor.transform ?? "slugify";
    // Keep legacy transform key for compatibility with existing runtime descriptors.
    base.transform = base.resolver;
    if (
      fieldDescriptor.settings &&
      typeof fieldDescriptor.settings === "object" &&
      !Array.isArray(fieldDescriptor.settings) &&
      Object.keys(fieldDescriptor.settings).length > 0
    ) {
      base.settings = {
        ...fieldDescriptor.settings
      };
    }
  }

  if (Object.prototype.hasOwnProperty.call(fieldDescriptor, "defaultValue")) {
    base.defaultValue = fieldDescriptor.defaultValue;
  }

  return base;
}

function buildCollectionDefinition(templateCollection, collection, buildDefaultCollectionFieldDescriptors) {
  const next = JSON.parse(JSON.stringify(templateCollection));
  next.id = collection.id;
  next.label = collection.label;
  next.entitySingular = collection.entitySingular.toLowerCase();
  next.description = `${collection.label} managed through module-pluggable CRUD runtime.`;
  next.primaryField =
    typeof collection.primaryField === "string" && collection.primaryField.length > 0
      ? collection.primaryField
      : "title";
  const collectionFieldDescriptors =
    Array.isArray(collection.fieldDescriptors) && collection.fieldDescriptors.length > 0
      ? collection.fieldDescriptors
      : buildDefaultCollectionFieldDescriptors(collection);
  next.fields = collectionFieldDescriptors.map((field) => toManifestFieldDescriptor(field));
  const enforcePrimaryFieldUnique = resolveEnforcePrimaryFieldUnique(collection);
  next.behavior = {
    enforcePrimaryFieldUnique,
    // Preserve legacy key for deterministic compatibility.
    enforceTitleUnique: enforcePrimaryFieldUnique,
    requirePublishedOnWhenPublished:
      collection.behavior?.requirePublishedOnWhenPublished !== false
  };
  return next;
}

function toManifestRouteViewDefinition(routeView) {
  const manifestRouteView = {
    kind: routeView.kind,
    viewId: routeView.viewId,
    capabilities: {
      usesCollectionsDomain: routeView.capabilities.usesCollectionsDomain === true
    }
  };

  const isModuleContributedRouteKind =
    typeof routeView.kind === "string" &&
    routeView.kind !== "custom" &&
    !isBuiltinRouteViewKind(routeView.kind);
  if (
    (routeView.kind === "custom" || isModuleContributedRouteKind) &&
    typeof routeView.entrypoint === "string" &&
    routeView.entrypoint.length > 0
  ) {
    manifestRouteView.entrypoint = routeView.entrypoint;
  }

  if (typeof routeView.bannerMessage === "string" && routeView.bannerMessage.length > 0) {
    manifestRouteView.bannerMessage = routeView.bannerMessage;
  }

  if (Array.isArray(routeView.quickActions) && routeView.quickActions.length > 0) {
    manifestRouteView.quickActions = [...routeView.quickActions];
  }

  if (Array.isArray(routeView.actions) && routeView.actions.length > 0) {
    manifestRouteView.actions = routeView.actions.map((action) => ({ ...action }));
  }

  return manifestRouteView;
}

function toManifestSettingsDefinition(settingsProfile = null) {
  if (!settingsProfile || typeof settingsProfile !== "object") {
    return null;
  }

  return {
    contractVersion: Number.isInteger(settingsProfile.contractVersion)
      ? settingsProfile.contractVersion
      : 1,
    fields: Array.isArray(settingsProfile.fields)
      ? settingsProfile.fields.map((field) => ({
          ...field,
          ...(field.type === "enum" && Array.isArray(field.options)
            ? {
                options: field.options.map((option) => ({
                  value: option.value,
                  label: option.label
                }))
              }
            : {})
        }))
      : []
  };
}

function buildModuleManifest(
  templateText,
  normalized,
  replacements,
  buildDefaultCollectionFieldDescriptors
) {
  const transformed = replaceTemplateText(templateText, replacements.manifest);
  const manifest = JSON.parse(transformed);

  manifest.id = normalized.moduleId;
  manifest.name = `${normalized.moduleLabel} Module`;
  manifest.ui.navigation.label = normalized.moduleLabel;
  manifest.ui.navigation.icon = normalized.icon;
  manifest.ui.navigation.order = normalized.order;
  if (normalized.routeSegment !== normalized.moduleId) {
    manifest.ui.navigation.routeSegment = normalized.routeSegment;
  } else {
    delete manifest.ui.navigation.routeSegment;
  }
  manifest.ui.routeView = toManifestRouteViewDefinition(normalized.routeView);

  if (Array.isArray(manifest.capabilities)) {
    manifest.capabilities = manifest.capabilities.filter((capability) => {
      if (capability === "settings" && normalized.includeSettings !== true) {
        return false;
      }
      if (capability === "service" && normalized.includeRuntimeServices !== true) {
        return false;
      }
      return true;
    });
  }

  if (normalized.includeSettings !== true) {
    delete manifest.settings;
  } else {
    const settingsDefinition = toManifestSettingsDefinition(normalized.settingsProfile);
    if (settingsDefinition) {
      manifest.settings = settingsDefinition;
    }
  }

  if (normalized.includeRuntimeServices !== true && manifest.runtime) {
    delete manifest.runtime.services;
  }

  const templateCollection =
    Array.isArray(manifest.collections) && manifest.collections.length > 0
      ? manifest.collections[0]
      : {
          id: normalized.moduleId,
          label: normalized.moduleLabel,
          primaryField: "title",
          description: `${normalized.moduleLabel} managed through module-pluggable CRUD runtime.`,
          capabilities: {
            list: true,
            read: true,
            create: true,
            update: true,
            delete: true
          },
          fields: [
            {
              id: "title",
              label: "Title",
              type: "text",
              required: true,
              minLength: 3,
              maxLength: 120
            }
          ]
        };

  manifest.collections = normalized.collections.map((collection) =>
    buildCollectionDefinition(
      templateCollection,
      collection,
      buildDefaultCollectionFieldDescriptors
    )
  );

  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function toCollectionsLiteral(normalized) {
  function toRuntimeCollectionDescriptor(collection) {
    const descriptor = {
      collectionId: collection.id,
      entitySingular: collection.entitySingular.toLowerCase(),
      idPrefix: collection.idPrefix
    };

    if (
      typeof collection.primaryField === "string" &&
      collection.primaryField.length > 0 &&
      collection.primaryField !== "title"
    ) {
      descriptor.primaryField = collection.primaryField;
    }

    const enforcePrimaryFieldUnique = resolveEnforcePrimaryFieldUnique(collection);
    if (enforcePrimaryFieldUnique !== true) {
      descriptor.behavior = {
        enforcePrimaryFieldUnique,
        // Preserve legacy key for deterministic compatibility.
        enforceTitleUnique: enforcePrimaryFieldUnique,
        requirePublishedOnWhenPublished:
          collection.behavior?.requirePublishedOnWhenPublished !== false
      };
    } else if (collection.behavior?.requirePublishedOnWhenPublished === false) {
      descriptor.behavior = {
        requirePublishedOnWhenPublished: false
      };
    }

    return descriptor;
  }

  return JSON.stringify(
    normalized.collections.map((collection) => toRuntimeCollectionDescriptor(collection)),
    null,
    2
  );
}

function buildCollectionHandlersModule(normalized) {
  const collectionsLiteral = toCollectionsLiteral(normalized);
  const constName = `${normalized.moduleId.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_COLLECTIONS`;

  return `import { registerGeneratedCollectionHandlers } from "../../records/server/shared/generated-proof-runtime.mjs";\n\nconst ${constName} = Object.freeze(${collectionsLiteral});\n\nexport function registerCollectionHandlers(context = {}) {\n  return registerGeneratedCollectionHandlers({\n    ...context,\n    moduleId: "${normalized.moduleId}",\n    collections: ${constName}\n  });\n}\n`;
}

function buildPersistencePluginsModule(normalized) {
  const collectionsLiteral = toCollectionsLiteral(normalized);
  const constName = `${normalized.moduleId.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_COLLECTIONS`;
  const persistenceModeConstName = `${normalized.moduleId
    .replace(/[^A-Za-z0-9]+/g, "_")
    .toUpperCase()}_PERSISTENCE_MODE`;
  const repositoryFactoryName = `create${toPascalCase(normalized.moduleId)}Repository`;

  return `import {\n  createGeneratedCollectionsRepository,\n  registerGeneratedCollectionPersistencePlugins\n} from "../../records/server/shared/generated-proof-runtime.mjs";\n\nconst ${constName} = Object.freeze(${collectionsLiteral});\nconst ${persistenceModeConstName} = "${normalized.persistenceMode}";\n\nexport function registerPersistencePlugins(context = {}) {\n  return registerGeneratedCollectionPersistencePlugins({\n    ...context,\n    moduleId: "${normalized.moduleId}",\n    collections: ${constName},\n    persistenceMode: ${persistenceModeConstName}\n  });\n}\n\nexport function ${repositoryFactoryName}(options = {}) {\n  return createGeneratedCollectionsRepository({\n    ...options,\n    moduleId: "${normalized.moduleId}",\n    collections: ${constName},\n    persistenceMode: options.persistenceMode ?? ${persistenceModeConstName}\n  });\n}\n`;
}

function buildRuntimeServicesModule(normalized) {
  const firstCollection = normalized.collections[0];
  const entityLower = firstCollection.entitySingular.toLowerCase();
  const configuredServices = Array.isArray(normalized.runtimeServicesProfile?.services)
    ? normalized.runtimeServicesProfile.services
    : null;
  const services =
    configuredServices && configuredServices.length > 0
      ? configuredServices
      : [
          {
            id: `${normalized.moduleId}-index-service`,
            label: `${normalized.moduleLabel} Index Service`,
            description: `Provides runtime metadata for ${entityLower} indexing and search refresh.`
          }
        ];

  const registerStatements = services
    .map(
      (service) =>
        `  registry.register({\n    serviceId: ${JSON.stringify(service.id)},\n    moduleId: ${JSON.stringify(
          normalized.moduleId
        )},\n    service: {\n      label: ${JSON.stringify(
          service.label
        )},\n      description: ${JSON.stringify(service.description)}\n    }\n  });`
    )
    .join("\n\n");

  return `export function registerServices({ registry }) {\n${registerStatements}\n}\n`;
}

function toRouteViewEntrypointArtifactPath(routeView = {}) {
  const configuredEntrypoint =
    typeof routeView.entrypoint === "string" ? routeView.entrypoint.trim() : "";
  if (configuredEntrypoint.length === 0) {
    return "frontend/view-entrypoint.jsx";
  }

  return configuredEntrypoint.replace(/^\.\//, "");
}

function shouldEmitRouteViewEntrypointArtifact(routeView = {}) {
  const kind = typeof routeView.kind === "string" ? routeView.kind : "";
  if (kind === "custom") {
    return true;
  }
  return kind.length > 0 && !isBuiltinRouteViewKind(kind);
}

function buildModuleViewEntrypointModule(normalized) {
  const isModuleRouteViewActionType = (value) => {
    if (typeof value !== "string") {
      return false;
    }

    const normalizedType = value.trim().toLowerCase();
    return normalizedType === "module" || normalizedType.startsWith("module:");
  };
  const moduleIdLiteral = JSON.stringify(normalized.moduleId);
  const usesCollectionsDomain =
    normalized.routeView.capabilities.usesCollectionsDomain === true;
  const bannerMessage =
    typeof normalized.routeView.bannerMessage === "string" &&
    normalized.routeView.bannerMessage.length > 0
      ? normalized.routeView.bannerMessage
      : `Module-owned view entrypoint: ${normalized.moduleLabel}`;
  const bannerMessageLiteral = JSON.stringify(bannerMessage);
  const quickActionsLiteral = JSON.stringify(
    Array.isArray(normalized.routeView.quickActions) ? normalized.routeView.quickActions : []
  );
  const actionsLiteral = JSON.stringify(
    Array.isArray(normalized.routeView.actions) ? normalized.routeView.actions : []
  );
  const hasModuleActions = Array.isArray(normalized.routeView.actions)
    ? normalized.routeView.actions.some((action) =>
        isModuleRouteViewActionType(action?.type)
      )
    : false;
  const runActionDeclaration = hasModuleActions
    ? `function runAction({ action } = {}) {\n  const actionType = typeof action?.type === "string" ? action.type.trim().toLowerCase() : "";\n  if (actionType !== "module" && !actionType.startsWith("module:")) {\n    return;\n  }\n\n  // Generated scaffolder entrypoints expose a no-op module action runner.\n}\n\n`
    : "";
  const runActionProperty = hasModuleActions ? ",\n      runAction" : "";
  const viewDescriptorRunActionProperty = hasModuleActions ? ",\n  runAction" : "";

  if (usesCollectionsDomain) {
    return `${runActionDeclaration}function registerModuleViews({ createCollectionsRouteViewDescriptor } = {}) {\n  if (typeof createCollectionsRouteViewDescriptor !== "function") {\n    return [];\n  }\n\n  return [\n    createCollectionsRouteViewDescriptor({\n      moduleId: ${moduleIdLiteral},\n      bannerMessage: ${bannerMessageLiteral},\n      quickActions: ${quickActionsLiteral},\n      actions: ${actionsLiteral}${runActionProperty}\n    })\n  ];\n}\n\nexport { registerModuleViews };\n`;
  }

  return `import { Alert } from "@mui/material";\nimport { createElement } from "react";\n\nfunction GeneratedModuleRouteView() {\n  return createElement(Alert, { severity: "info" }, ${bannerMessageLiteral});\n}\n\n${runActionDeclaration}const viewDescriptor = Object.freeze({\n  moduleId: ${moduleIdLiteral},\n  usesCollectionsDomain: false,\n  quickActions: ${quickActionsLiteral},\n  actions: ${actionsLiteral}${viewDescriptorRunActionProperty},\n  render: GeneratedModuleRouteView\n});\n\nexport { viewDescriptor };\n`;
}

function buildArtifacts(templateManifest, normalized, buildDefaultCollectionFieldDescriptors) {
  const replacements = buildReplacements(normalized);

  const artifacts = {
    "module.json": buildModuleManifest(
      templateManifest,
      normalized,
      replacements,
      buildDefaultCollectionFieldDescriptors
    ),
    "server/collection-handlers.mjs": buildCollectionHandlersModule(normalized),
    "server/persistence-plugins.mjs": buildPersistencePluginsModule(normalized)
  };

  if (normalized.includeRuntimeServices === true) {
    artifacts["server/runtime-services.mjs"] = buildRuntimeServicesModule(normalized);
  }

  if (shouldEmitRouteViewEntrypointArtifact(normalized.routeView)) {
    artifacts[toRouteViewEntrypointArtifactPath(normalized.routeView)] =
      buildModuleViewEntrypointModule(normalized);
  }

  return artifacts;
}

export { buildArtifacts };
