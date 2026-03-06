import { expect, test } from "vitest";
import { validateModuleManifest } from "../../src/core/index.js";
import { validManifest } from "./helpers/manifest-shared-fixtures.js";

function registerManifestDiscoverySchemaRouteViewRuntimeSuite() {
  test("rejects ui routeView quickActions shape when not an array", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "collections",
          quickActions: "open-remotes"
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.quickActions");
  });

  test("rejects ui routeView quickActions values when token is not kebab-case", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "collections",
          quickActions: ["open-remotes", "Invalid Action"]
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.quickActions.1");
  });

  test("rejects ui routeView actions shape when not an array", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "collections",
          actions: {
            id: "open-review-queue"
          }
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.actions");
  });

  test("rejects ui routeView actions values when descriptor is invalid", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "collections",
          actions: [
            {
              id: "dispatch-runbook",
              label: "Dispatch runbook",
              type: "external",
              href: "ftp://dispatch.example.invalid/runbook"
            }
          ]
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.actions.0.href");
  });

  test("rejects ui routeView module actions when commandId is missing", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "collections",
          actions: [
            {
              id: "reset-dispatch-filters",
              label: "Reset dispatch filters",
              type: "module"
            }
          ]
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.actions.0.commandId");
  });

  test("accepts ui routeView actions that reuse quickActions tokens", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "collections",
          quickActions: ["open-remotes"],
          actions: [
            {
              id: "open-remotes",
              label: "Open remotes duplicate",
              type: "navigate",
              route: {
                moduleId: "remotes"
              }
            }
          ]
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value.ui.routeView).toEqual(
      expect.objectContaining({
        quickActions: ["open-remotes"],
        actions: [
          {
            id: "open-remotes",
            label: "Open remotes duplicate",
            type: "navigate",
            route: {
              moduleId: "remotes"
            }
          }
        ]
      })
    );
  });

  test("rejects ui routeView custom kind without entrypoint", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "custom"
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.entrypoint");
  });

  test("rejects ui routeView non-custom kind with entrypoint", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "products",
          entrypoint: "./frontend/products-view.jsx"
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.entrypoint");
  });

  test("rejects ui routeView module-contributed kind without entrypoint", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "ops-console"
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.entrypoint");
  });

  test("accepts ui routeView module-contributed kind with entrypoint", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "ops-console",
          entrypoint: "./frontend/view-entrypoint.jsx",
          quickActions: ["open-ops-console"],
          actions: [
            {
              id: "open-ops-console",
              label: "Open ops console",
              type: "navigate",
              route: {
                moduleId: "products"
              }
            }
          ]
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value.ui.routeView).toEqual(
      expect.objectContaining({
        kind: "ops-console",
        entrypoint: "./frontend/view-entrypoint.jsx",
        quickActions: ["open-ops-console"],
        actions: [
          {
            id: "open-ops-console",
            label: "Open ops console",
            type: "navigate",
            route: {
              moduleId: "products"
            }
          }
        ]
      })
    );
  });

  test("rejects ui routeView collections kind with usesCollectionsDomain=false", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "collections",
          capabilities: {
            usesCollectionsDomain: false
          }
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.capabilities.usesCollectionsDomain");
  });

  test("rejects ui routeView non-collections built-in kind with usesCollectionsDomain=true", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "taxonomies",
          capabilities: {
            usesCollectionsDomain: true
          }
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.capabilities.usesCollectionsDomain");
  });

  test("rejects ui routeView entrypoint when path is invalid", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "custom",
          entrypoint: "../frontend/custom-view.mjs"
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.entrypoint");
  });

  test("rejects ui routeView unknown capability fields", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "collections",
          capabilities: {
            unsupported: true
          }
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.routeView.capabilities.unsupported");
  });

  test("rejects invalid ui navigation route segment", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        navigation: {
          routeSegment: "Dispatch Center"
        }
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.navigation.routeSegment");
  });

  test("rejects invalid ui navigation shape", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        navigation: "products"
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("ui.navigation");
  });

  test("rejects invalid collections shape", () => {
    const result = validateModuleManifest({
      ...validManifest,
      collections: {}
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("collections");
  });

  test("rejects invalid runtime entrypoint shape", () => {
    const result = validateModuleManifest({
      ...validManifest,
      runtime: {
        collectionHandlers: ""
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("runtime.collectionHandlers");
  });

  test("rejects runtime when not an object", () => {
    const result = validateModuleManifest({
      ...validManifest,
      runtime: "collection-handlers.mjs"
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("runtime");
  });

  test("accepts runtime fieldTypePlugins entrypoint", () => {
    const result = validateModuleManifest({
      ...validManifest,
      runtime: {
        fieldTypePlugins: "./server/field-type-plugins.mjs"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value.runtime).toEqual(
      expect.objectContaining({
        fieldTypePlugins: "./server/field-type-plugins.mjs"
      })
    );
  });

  test("accepts runtime referenceOptionsProviders entrypoint", () => {
    const result = validateModuleManifest({
      ...validManifest,
      runtime: {
        referenceOptionsProviders: "./server/reference-options-providers.mjs"
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value.runtime).toEqual(
      expect.objectContaining({
        referenceOptionsProviders: "./server/reference-options-providers.mjs"
      })
    );
  });

  test("rejects unknown runtime fields", () => {
    const result = validateModuleManifest({
      ...validManifest,
      runtime: {
        collectionHandlers: "./server/collection-handlers.mjs",
        unsupported: "./server/nope.mjs"
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("runtime.unsupported");
  });
}

export { registerManifestDiscoverySchemaRouteViewRuntimeSuite };
