import { describe, expect, test, vi } from "vitest";
import { registerModuleViews } from "../../ui/module-entrypoints/dispatches/view-entrypoint.jsx";

describe("dispatches route adapter core contract", () => {
  test("normalizes route-state and module action payloads deterministically", () => {
    const createCollectionsRouteViewDescriptor = vi.fn((descriptor) => ({
      moduleId: "dispatches",
      usesCollectionsDomain: true,
      render: () => null,
      ...descriptor
    }));
    const [descriptor] = registerModuleViews({
      createCollectionsRouteViewDescriptor,
      routeView: {
        quickActions: ["open-remotes", "open-missions", "Invalid Action", "open-remotes"],
        actions: [
          {
            id: "open-review-queue",
            label: "Open review queue",
            type: "navigate",
            route: {
              moduleId: "dispatches",
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
    });

    expect(createCollectionsRouteViewDescriptor).toHaveBeenCalled();
    expect(descriptor.routeStateAdapter.parseQuery(new URLSearchParams("status=review"))).toEqual({
      status: "review",
      collectionId: ""
    });
    expect(descriptor.routeStateAdapter.parseQuery(new URLSearchParams("status=invalid"))).toEqual({
      status: "",
      collectionId: ""
    });
    expect(
      descriptor.routeStateAdapter.parseQuery(new URLSearchParams("collectionId=Notes"))
    ).toEqual({
      status: "",
      collectionId: "notes"
    });
    expect(descriptor.routeStateAdapter.normalizeRoute({ status: "PUBLISHED" })).toEqual({
      status: "published",
      collectionId: ""
    });
    expect(
      descriptor.routeStateAdapter.normalizeRoute({
        status: "review",
        collectionId: "notes"
      })
    ).toEqual({
      status: "review",
      collectionId: "notes"
    });
    expect(descriptor.routeStateAdapter.buildQuery({ status: "draft" })).toEqual({
      status: "draft",
      collectionId: null
    });
    expect(
      descriptor.routeStateAdapter.buildQuery({
        status: "review",
        collectionId: "records"
      })
    ).toEqual({
      status: "review",
      collectionId: "records"
    });
    expect(
      descriptor.routeStateAdapter.buildQuery({
        status: "invalid",
        collectionId: "bad value"
      })
    ).toEqual({
      status: null,
      collectionId: null
    });

    const navigate = vi.fn();
    descriptor.runAction({
      action: {
        id: "reset-dispatch-filters",
        label: "Reset dispatch filters",
        type: "module:filters",
        commandId: "reset-filters",
        payload: {
          status: "",
          collectionId: "dispatches"
        }
      },
      route: {
        moduleId: "dispatches"
      },
      navigate
    });
    expect(navigate).toHaveBeenCalledWith(
      {
        moduleId: "dispatches",
        status: "",
        collectionId: "dispatches"
      },
      {
        replace: false
      }
    );
  });
});
