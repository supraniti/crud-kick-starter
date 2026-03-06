import { describe, expect, test } from "vitest";
import {
  VIEW_REGISTRATION_CODES,
  buildRouteForModuleSelection,
  buildRouteUrl,
  createViewRegistry,
  isCollectionsRouteModule,
  normalizeRoute,
  resolveViewRegistration,
  validateViewDescriptor
} from "../../runtime/view-registry.jsx";
import { createResolvedViewRegistry } from "../../runtime/view-registry/view-descriptor-resolution.js";


describe("frontend view registry entrypoint core contract", () => {
  test("mounts module-owned custom route entrypoint through runtime registry contract", () => {
    const moduleId = "test-modules-crud-core";
    const registration = resolveViewRegistration(moduleId, {
      moduleRuntimeItems: [
        {
          id: moduleId,
          ui: {
            navigation: {
              label: "Test Modules CRUD Core",
              icon: "dataset"
            },
            routeView: {
              kind: "custom",
              entrypoint: "./frontend/view-entrypoint.jsx",
              actions: [
                {
                  id: "articles-focus-review",
                  label: "Focus review",
                  type: "module:section",
                  commandId: "set-section",
                  payload: {
                    section: "review"
                  }
                }
              ]
            }
          },
          collectionIds: ["articles", "records"]
        }
      ],
      moduleViewEntrypoints: {
        "../../../../modules/test-modules-crud-core/frontend/view-entrypoint.jsx": {
          viewDescriptor: {
            moduleId,
            usesCollectionsDomain: false,
            runAction: () => {},
            render: () => null
          }
        }
      }
    });

    expect(registration).toEqual(
      expect.objectContaining({
        moduleId,
        usesCollectionsDomain: false,
        runAction: expect.any(Function),
        render: expect.any(Function)
      })
    );
    expect(isCollectionsRouteModule(moduleId, {
      moduleRuntimeItems: [
        {
          id: moduleId,
          ui: {
            routeView: {
              kind: "custom",
              entrypoint: "./frontend/view-entrypoint.jsx"
            }
          },
          collectionIds: ["articles", "records"]
        }
      ],
      moduleViewEntrypoints: {
        "../../../../modules/test-modules-crud-core/frontend/view-entrypoint.jsx": {
          viewDescriptor: {
            moduleId,
            usesCollectionsDomain: false,
            runAction: () => {},
            render: () => null
          }
        }
      }
    })).toBe(false);

    const normalized = normalizeRoute(
      {
        moduleId,
        section: "REVIEW"
      },
      {
        moduleRuntimeItems: [
          {
            id: moduleId,
            ui: {
              routeView: {
                kind: "custom",
                entrypoint: "./frontend/view-entrypoint.jsx"
              }
            },
            collectionIds: ["articles", "records"]
          }
        ],
        moduleViewEntrypoints: {
          "../../../../modules/test-modules-crud-core/frontend/view-entrypoint.jsx": {
            viewDescriptor: {
              moduleId,
              usesCollectionsDomain: false,
              runAction: () => {},
              render: () => null
            }
          }
        }
      }
    );
    expect(normalized).toEqual({
      moduleId
    });
    expect(
      buildRouteUrl(
        {
          moduleId,
          section: "published"
        },
        {
          moduleRuntimeItems: [
            {
              id: moduleId,
              ui: {
                routeView: {
                  kind: "custom",
                  entrypoint: "./frontend/view-entrypoint.jsx"
                }
              },
              collectionIds: ["articles", "records"]
            }
          ],
          moduleViewEntrypoints: {
            "../../../../modules/test-modules-crud-core/frontend/view-entrypoint.jsx": {
              viewDescriptor: {
                moduleId,
                usesCollectionsDomain: false,
                runAction: () => {},
                render: () => null
              }
            }
          }
        }
      )
    ).toMatch(new RegExp(`^/app/${moduleId}(?:\\?.*)?$`));
  });

  test("mounts generated publishers custom route entrypoint through runtime registry contract", () => {
    const moduleId = "test-modules-relations-taxonomy";
    const registration = resolveViewRegistration(moduleId, {
      moduleRuntimeItems: [
        {
          id: moduleId,
          ui: {
            navigation: {
              label: "Test Modules Relations Taxonomy",
              icon: "hub"
            },
            routeView: {
              kind: "custom",
              entrypoint: "./frontend/view-entrypoint.jsx"
            }
          },
          collectionIds: ["authors", "publishers"]
        }
      ],
      moduleViewEntrypoints: {
        "../../../../modules/test-modules-relations-taxonomy/frontend/view-entrypoint.jsx": {
          viewDescriptor: {
            moduleId,
            usesCollectionsDomain: true,
            render: () => null
          }
        }
      }
    });

    expect(registration).toEqual(
      expect.objectContaining({
        moduleId,
        usesCollectionsDomain: true,
        render: expect.any(Function)
      })
    );
    expect(isCollectionsRouteModule(moduleId, {
      moduleRuntimeItems: [
        {
          id: moduleId,
          ui: {
            routeView: {
              kind: "custom",
              entrypoint: "./frontend/view-entrypoint.jsx"
            }
          },
          collectionIds: ["authors", "publishers"]
        }
      ],
      moduleViewEntrypoints: {
        "../../../../modules/test-modules-relations-taxonomy/frontend/view-entrypoint.jsx": {
          viewDescriptor: {
            moduleId,
            usesCollectionsDomain: true,
            render: () => null
          }
        }
      }
    })).toBe(true);
  });

  test("mounts dispatches custom route entrypoint through runtime registry contract", () => {
    const moduleId = "test-modules-operations-dispatch";
    const moduleRuntimeItems = [
      {
        id: moduleId,
        ui: {
          navigation: {
            label: "Test Modules Operations Dispatch",
            icon: "route",
            routeSegment: "dispatch-center"
          },
          routeView: {
            kind: "custom",
            entrypoint: "./frontend/view-entrypoint.jsx",
            quickActions: ["open-remotes", "open-missions"]
          }
        },
        collectionIds: ["dispatches", "iter5-playbooks"]
      }
    ];
    const registration = resolveViewRegistration(moduleId, {
      moduleRuntimeItems,
      moduleViewEntrypoints: {
        "../../../../modules/test-modules-operations-dispatch/frontend/view-entrypoint.jsx": {
          viewDescriptor: {
            moduleId,
            usesCollectionsDomain: true,
            quickActions: ["open-remotes", "open-missions"],
            render: () => null
          }
        }
      }
    });

    expect(registration).toEqual(
      expect.objectContaining({
        moduleId,
        usesCollectionsDomain: true,
        quickActions: ["open-remotes", "open-missions"],
        render: expect.any(Function)
      })
    );
    expect(
      isCollectionsRouteModule(moduleId, {
        moduleRuntimeItems,
        moduleViewEntrypoints: {
          "../../../../modules/test-modules-operations-dispatch/frontend/view-entrypoint.jsx": {
            viewDescriptor: {
              moduleId,
              usesCollectionsDomain: true,
              quickActions: ["open-remotes", "open-missions"],
              render: () => null
            }
          }
        }
      })
    ).toBe(true);

    const normalized = normalizeRoute(
      {
        moduleId,
        status: "PUBLISHED"
      },
      {
        moduleRuntimeItems,
        moduleViewEntrypoints: {
          "../../../../modules/test-modules-operations-dispatch/frontend/view-entrypoint.jsx": {
            viewDescriptor: {
              moduleId,
              usesCollectionsDomain: true,
              quickActions: ["open-remotes", "open-missions"],
              render: () => null
            }
          }
        }
      }
    );
    expect(normalized).toEqual({
      moduleId
    });
    expect(
      buildRouteUrl(
        {
          moduleId,
          status: "review"
        },
        {
          moduleRuntimeItems,
          moduleViewEntrypoints: {
            "../../../../modules/test-modules-operations-dispatch/frontend/view-entrypoint.jsx": {
              viewDescriptor: {
                moduleId,
                usesCollectionsDomain: true,
                quickActions: ["open-remotes", "open-missions"],
                render: () => null
              }
            }
          }
        }
      )
    ).toMatch(/^\/app\/dispatch-center(?:\?.*)?$/);
    expect(
      buildRouteUrl(
        {
          moduleId,
          status: "review",
          collectionId: "notes"
        },
        {
          moduleRuntimeItems,
          moduleViewEntrypoints: {
            "../../../../modules/test-modules-operations-dispatch/frontend/view-entrypoint.jsx": {
              viewDescriptor: {
                moduleId,
                usesCollectionsDomain: true,
                quickActions: ["open-remotes", "open-missions"],
                render: () => null
              }
            }
          }
        }
      )
    ).toMatch(/^\/app\/dispatch-center(?:\?.*)?$/);
  });

  test("resolves custom route entrypoint by manifest path when module exposes multiple entrypoints", () => {
    const moduleId = "test-modules-operations-dispatch";
    const moduleViewEntrypoints = {
      "../../../../modules/test-modules-operations-dispatch/frontend/view-entrypoint.jsx": {
        viewDescriptor: {
          moduleId,
          usesCollectionsDomain: true,
          quickActions: ["open-remotes"],
          render: () => null,
          routeStateAdapter: {}
        }
      },
      "../../../../modules/test-modules-operations-dispatch/frontend/custom-dispatch-entrypoint.mjs": {
        viewDescriptor: {
          moduleId,
          usesCollectionsDomain: false,
          quickActions: ["open-missions"],
          render: () => null,
          routeStateAdapter: {}
        }
      }
    };

    const resolved = createResolvedViewRegistry({
      moduleRuntimeItems: [
        {
          id: moduleId,
          ui: {
            routeView: {
              kind: "custom",
              entrypoint: "./frontend/custom-dispatch-entrypoint.mjs",
              quickActions: ["open-remotes"]
            }
          },
          collectionIds: ["dispatches"]
        }
      ],
      moduleViewEntrypoints
    });
    const registration = resolved.registrations.get(moduleId) ?? null;

    expect(resolved.diagnostics).toEqual([]);
    expect(registration).toEqual(
      expect.objectContaining({
        moduleId,
        usesCollectionsDomain: false,
        quickActions: ["open-missions"],
        render: expect.any(Function)
      })
    );
  });

  test("inherits manifest route quickActions when custom entrypoint descriptor omits them", () => {
    const moduleId = "test-modules-operations-dispatch";
    const registration = resolveViewRegistration(moduleId, {
      moduleRuntimeItems: [
        {
          id: moduleId,
          ui: {
            routeView: {
              kind: "custom",
              entrypoint: "./frontend/custom-dispatch-entrypoint.mjs",
              quickActions: ["open-remotes", "open-missions"],
              actions: [
                {
                  id: "open-review-queue",
                  label: "Open review queue",
                  type: "navigate",
                  route: {
                    moduleId,
                    state: {
                      status: "review",
                      collectionId: "dispatches"
                    }
                  }
                },
                {
                  id: "reset-dispatch-filters",
                  label: "Reset dispatch filters",
                  type: "module:filters",
                  commandId: "reset-filters",
                  payload: {
                    status: "",
                    collectionId: "dispatches"
                  }
                }
              ]
            }
          },
          collectionIds: ["dispatches"]
        }
      ],
      moduleViewEntrypoints: {
        "../../../../modules/test-modules-operations-dispatch/frontend/custom-dispatch-entrypoint.mjs": {
          viewDescriptor: {
            moduleId,
            usesCollectionsDomain: true,
            render: () => null,
            routeStateAdapter: {},
            runAction: () => {}
          }
        }
      }
    });

    expect(registration).toEqual(
      expect.objectContaining({
        moduleId,
        quickActions: ["open-remotes", "open-missions"],
        actions: [
          {
            id: "open-review-queue",
            label: "Open review queue",
            type: "navigate",
            route: {
              moduleId,
              state: {
                status: "review",
                collectionId: "dispatches"
              }
            }
          },
          {
            id: "reset-dispatch-filters",
            label: "Reset dispatch filters",
            type: "module:filters",
            commandId: "reset-filters",
            payload: {
              status: "",
              collectionId: "dispatches"
            }
          }
        ]
      })
    );
  });

  test("does not mount custom route entrypoint when configured manifest path is missing", () => {
    const moduleId = "test-modules-operations-dispatch";
    const registration = resolveViewRegistration(moduleId, {
      moduleRuntimeItems: [
        {
          id: moduleId,
          ui: {
            routeView: {
              kind: "custom",
              entrypoint: "./frontend/custom-dispatch-entrypoint.mjs"
            }
          },
          collectionIds: ["dispatches"]
        }
      ],
      moduleViewEntrypoints: {
        "../../../../modules/test-modules-operations-dispatch/frontend/view-entrypoint.jsx": {
          viewDescriptor: {
            moduleId,
            usesCollectionsDomain: true,
            render: () => null,
            routeStateAdapter: {}
          }
        }
      }
    });

    expect(registration).toBeNull();
  });

  test("resolves built-in route kind registrations from runtime manifest metadata", () => {
    const registration = resolveViewRegistration("products", {
      moduleRuntimeItems: [
        {
          id: "products",
          ui: {
            navigation: {
              label: "Products",
              icon: "inventory_2"
            },
            routeView: {
              kind: "products"
            }
          },
          collectionIds: []
        }
      ]
    });

    expect(registration).toEqual(
      expect.objectContaining({
        moduleId: "products",
        usesCollectionsDomain: false,
        requiredDomains: ["products-taxonomies"],
        render: expect.any(Function)
      })
    );
  });

  test("resolves built-in non-collection domains through descriptor requiredDomains contract", () => {
    const registration = resolveViewRegistration("remotes", {
      moduleRuntimeItems: [
        {
          id: "remotes",
          ui: {
            routeView: {
              kind: "remotes"
            }
          },
          collectionIds: []
        }
      ]
    });

    expect(registration).toEqual(
      expect.objectContaining({
        moduleId: "remotes",
        usesCollectionsDomain: false,
        requiredDomains: ["remotes-deploy", "module-settings"],
        render: expect.any(Function)
      })
    );
  });

  test("resolves module-contributed non-collection route kind through entrypoint descriptor", () => {
    const registration = resolveViewRegistration("ops-center", {
      moduleRuntimeItems: [
        {
          id: "ops-center",
          ui: {
            routeView: {
              kind: "ops-console",
              entrypoint: "./frontend/view-entrypoint.jsx"
            }
          },
          collectionIds: []
        }
      ],
      moduleViewEntrypoints: {
        "../../../../modules/ops-center/frontend/view-entrypoint.jsx": {
          viewDescriptor: {
            moduleId: "ops-center",
            usesCollectionsDomain: false,
            requiredDomains: ["mission-operator"],
            render: () => null
          }
        }
      }
    });

    expect(registration).toEqual(
      expect.objectContaining({
        moduleId: "ops-center",
        usesCollectionsDomain: false,
        requiredDomains: ["mission-operator"],
        render: expect.any(Function)
      })
    );
  });

  test("does not statically mount non-collection modules without routeView metadata", () => {
    const registration = resolveViewRegistration("products", {
      moduleRuntimeItems: [
        {
          id: "products",
          ui: {
            navigation: {
              label: "Products",
              icon: "inventory_2"
            }
          },
          collectionIds: []
        }
      ]
    });

    expect(registration).toBeNull();
  });
});
