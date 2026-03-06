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


describe("frontend view registry descriptor core contract", () => {
  test("rejects unknown descriptor fields with deterministic diagnostics", () => {
    const result = validateViewDescriptor(
      {
        moduleId: "records",
        render: () => null,
        unsupported: true
      },
      0
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: VIEW_REGISTRATION_CODES.UNKNOWN_FIELD,
      field: "unsupported"
    });
  });

  test("rejects duplicate module registrations deterministically", () => {
    const { registrations, diagnostics } = createViewRegistry([
      {
        moduleId: "records",
        render: () => null
      },
      {
        moduleId: "records",
        render: () => null
      }
    ]);

    expect(registrations.size).toBe(1);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: VIEW_REGISTRATION_CODES.DUPLICATE_MODULE,
        moduleId: "records"
      })
    );
  });

  test("rejects invalid route-state adapters with deterministic diagnostics", () => {
    const result = validateViewDescriptor(
      {
        moduleId: "products",
        render: () => null,
        routeStateAdapter: {
          parseQuery: "invalid"
        }
      },
      0
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: VIEW_REGISTRATION_CODES.ROUTE_STATE_ADAPTER_INVALID,
      field: "routeStateAdapter.parseQuery"
    });
  });

  test("rejects invalid quickActions with deterministic diagnostics", () => {
    const result = validateViewDescriptor(
      {
        moduleId: "dispatches",
        render: () => null,
        quickActions: ["open-remotes", "Invalid Action"]
      },
      0
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: VIEW_REGISTRATION_CODES.QUICK_ACTIONS_INVALID,
      field: "quickActions.1"
    });
  });

  test("allows quickActions to reference module-contributed action ids", () => {
    const result = validateViewDescriptor(
      {
        moduleId: "dispatches",
        render: () => null,
        quickActions: ["open-review-queue"],
        actions: [
          {
            id: "open-review-queue",
            label: "Open review queue",
            type: "navigate",
            route: {
              moduleId: "dispatches"
            }
          }
        ]
      },
      0
    );

    expect(result.ok).toBe(true);
    expect(result.value).toEqual(
      expect.objectContaining({
        quickActions: ["open-review-queue"],
        actions: [
          {
            id: "open-review-queue",
            label: "Open review queue",
            type: "navigate",
            route: {
              moduleId: "dispatches"
            }
          }
        ]
      })
    );
  });

  test("rejects invalid actions with deterministic diagnostics", () => {
    const result = validateViewDescriptor(
      {
        moduleId: "dispatches",
        render: () => null,
        actions: [
          {
            id: "dispatch-runbook",
            label: "Dispatch runbook",
            type: "external",
            href: "ftp://invalid.example.invalid/runbook"
          }
        ]
      },
      0
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: VIEW_REGISTRATION_CODES.ACTIONS_INVALID,
      field: "actions.0.href"
    });
  });

  test("rejects invalid module action runner descriptor with deterministic diagnostics", () => {
    const result = validateViewDescriptor(
      {
        moduleId: "dispatches",
        render: () => null,
        runAction: {}
      },
      0
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: VIEW_REGISTRATION_CODES.ACTION_RUNNER_INVALID,
      field: "runAction"
    });
  });

  test("requires runAction when actions include module action variants", () => {
    const result = validateViewDescriptor(
      {
        moduleId: "dispatches",
        render: () => null,
        actions: [
          {
            id: "reset-dispatch-filters",
            label: "Reset dispatch filters",
            type: "module:filters",
            commandId: "reset-filters",
            payload: {
              status: ""
            }
          }
        ]
      },
      0
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatchObject({
      code: VIEW_REGISTRATION_CODES.ACTION_RUNNER_INVALID,
      field: "runAction"
    });
  });

  test("normalizes and builds product route query through route-state adapter boundary", () => {
    const normalized = normalizeRoute({
      moduleId: "products",
      categoryIds: ["cat-002", "cat-002", "cat-003", ""]
    });
    expect(normalized).toEqual({
      moduleId: "products",
      categoryIds: ["cat-002", "cat-003"]
    });
    expect(buildRouteUrl(normalized)).toBe("/app/products?categoryIds=cat-002%2Ccat-003");
  });

  test("module selection route transition resolves through route-state adapter boundaries", () => {
    const productsRoute = buildRouteForModuleSelection("products", {
      currentRoute: {
        moduleId: "products",
        categoryIds: ["cat-002"]
      }
    });
    expect(productsRoute).toEqual({
      moduleId: "products",
      categoryIds: ["cat-002"]
    });

    const taxonomiesRoute = buildRouteForModuleSelection("taxonomies", {
      currentRoute: {
        moduleId: "products",
        categoryIds: ["cat-002"]
      }
    });
    expect(taxonomiesRoute).toEqual({
      moduleId: "taxonomies"
    });
    expect(buildRouteUrl(taxonomiesRoute)).toBe("/app/taxonomies");
  });

  test("resolves collection workspace route for runtime modules that contribute collections", () => {
    const result = isCollectionsRouteModule("articles", {
      moduleRuntimeItems: [
        {
          id: "articles",
          ui: {
            navigation: {
              label: "Articles",
              icon: "article"
            }
          },
          collectionIds: ["articles"]
        }
      ]
    });

    expect(result).toBe(true);
  });

});
