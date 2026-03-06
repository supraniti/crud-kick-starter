import { afterEach, beforeEach, test, expect, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App, { AUTH_STORAGE_KEY } from "../../app/App.jsx";
import { createApiMock } from "../reference-api-mock.js";
import { resetBrowserState, setPath } from "../test-helpers.js";

beforeEach(() => {
  resetBrowserState();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const longTest = (name, run) => test(name, run, 15000);

longTest("app-shell hydration: category filter updates URL and request payload", async () => {
  const api = createApiMock();
  window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
  setPath("/app/products");

  render(<App api={api} />);

  await waitFor(() => {
    expect(screen.getByText("Mechanical Keyboard")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "Software" }));

  await waitFor(() => {
    expect(window.location.search).toContain("categoryIds=cat-002");
  });

  await waitFor(() => {
    expect(api.listProducts).toHaveBeenLastCalledWith({
      categoryIds: ["cat-002"],
      offset: 0,
      limit: 50
    });
  });

  await waitFor(() => {
    expect(screen.getByText("Backup Utility")).toBeInTheDocument();
    expect(screen.queryByText("Mechanical Keyboard")).not.toBeInTheDocument();
  });
});

longTest("app-shell hydration: URL deep-link restores filter state", async () => {
  const api = createApiMock();
  window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
  setPath("/app/products?categoryIds=cat-003");

  render(<App api={api} />);

  await waitFor(() => {
    expect(api.listProducts).toHaveBeenLastCalledWith({
      categoryIds: ["cat-003"],
      offset: 0,
      limit: 50
    });
  });

  expect(window.location.pathname).toBe("/app/products");
  expect(window.location.search).toContain("categoryIds=cat-003");

  await waitFor(() => {
    expect(screen.getByText("Wireless Mouse")).toBeInTheDocument();
    expect(screen.queryByText("Backup Utility")).not.toBeInTheDocument();
  });
});

longTest("app-shell hydration: collections route uses consolidated workspace call budget", async () => {
  const api = createApiMock();
  window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
  setPath("/app/records");

  render(<App api={api} />);

  await waitFor(() => {
    expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
    expect(screen.getByText("Launch Checklist")).toBeInTheDocument();
  });

  expect(api.readModulesRuntime).toHaveBeenCalledTimes(1);
  expect(
    api.listCollections.mock.calls.length + api.readCollectionWorkspace.mock.calls.length
  ).toBeLessThanOrEqual(3);
  expect(api.readCollectionWorkspace.mock.calls.length).toBeLessThanOrEqual(2);
  expect(api.readCollectionSchema).not.toHaveBeenCalled();
  expect(api.listCollectionItems).not.toHaveBeenCalled();
});

longTest("app-shell hydration: collection workspace state is isolated per module route", async () => {
  const api = createApiMock({
    mutateState(state) {
      state.modules.splice(1, 0, {
        id: "articles",
        label: "Articles",
        icon: "article"
      });
      state.modules.splice(2, 0, {
        id: "authors",
        label: "Authors",
        icon: "group"
      });
      state.moduleRuntime.push({
        id: "articles",
        name: "Articles Module",
        version: "0.1.0",
        capabilities: ["ui.route", "schema", "crud.collection"],
        state: "enabled",
        ui: {
          navigation: {
            label: "Articles",
            icon: "article"
          }
        },
        collectionIds: ["records", "notes"]
      });
      state.moduleRuntime.push({
        id: "authors",
        name: "Authors Module",
        version: "0.1.0",
        capabilities: ["ui.route", "schema", "crud.collection"],
        state: "enabled",
        ui: {
          navigation: {
            label: "Authors",
            icon: "group"
          }
        },
        collectionIds: ["records", "notes"]
      });
    }
  });
  window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
  setPath("/app/articles");

  render(<App api={api} />);

  await waitFor(() => {
    expect(screen.getByRole("heading", { level: 5, name: "Articles" })).toBeInTheDocument();
  });
  await waitFor(
    () => {
      expect(screen.getByText("Collection: Records")).toBeInTheDocument();
    },
    { timeout: 5000 }
  );

  fireEvent.mouseDown(screen.getByLabelText("Collection"));
  fireEvent.click(await screen.findByRole("option", { name: "Notes" }));

  await waitFor(() => {
    expect(screen.getByText("Collection: Notes")).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "Authors" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { level: 5, name: "Authors" })).toBeInTheDocument();
  });
  await waitFor(
    () => {
      expect(screen.getByText("Collection: Records")).toBeInTheDocument();
    },
    { timeout: 5000 }
  );

  await waitFor(() => {
    const workspaceCall = api.readCollectionWorkspace.mock.calls.at(-1)?.[0] ?? {};
    expect(workspaceCall).toEqual(
      expect.objectContaining({
        collectionId: "records",
        offset: 0,
        limit: 25,
        search: ""
      })
    );
    expect(workspaceCall.status ?? "").toBe("");
    expect(workspaceCall.noteId ?? "").toBe("");
  });
});

longTest(
  "app-shell hydration: custom route state synchronizes status query with collection filters",
  async () => {
    const api = createApiMock({
      mutateState(state) {
        state.modules.splice(1, 0, {
          id: "dispatches",
          label: "Dispatches",
          icon: "inventory_2"
        });
        state.moduleRuntime.push({
          id: "dispatches",
          name: "Dispatches Module",
          version: "0.1.0",
          capabilities: ["ui.route", "schema", "crud.collection"],
          state: "enabled",
          ui: {
            navigation: {
              label: "Dispatches",
              icon: "inventory_2",
              routeSegment: "dispatch-center"
            },
            routeView: {
              kind: "custom",
              entrypoint: "./frontend/view-entrypoint.jsx",
              quickActions: ["open-remotes", "open-missions"]
            }
          },
          collectionIds: ["records", "notes"]
        });
      }
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/dispatch-center?status=review&collectionId=records");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Dispatches" })).toBeInTheDocument();
      expect(screen.getByText("Dispatches custom route-state workspace")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Open remotes" }).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Open missions" })).toBeInTheDocument();
    });
    expect(window.location.pathname).toBe("/app/dispatch-center");

    await waitFor(() => {
      const workspaceCall = api.readCollectionWorkspace.mock.calls.at(-1)?.[0] ?? {};
      expect(workspaceCall).toEqual(
        expect.objectContaining({
          collectionId: "records",
          offset: 0,
          limit: 25,
          search: "",
          status: "review"
        })
      );
      expect(workspaceCall.noteId ?? "").toBe("");
    });

    fireEvent.mouseDown(screen.getByLabelText("Collection"));
    fireEvent.click(await screen.findByRole("option", { name: "Notes" }));

    await waitFor(() => {
      expect(window.location.search).toContain("collectionId=notes");
    });

    await waitFor(() => {
      const workspaceCall = api.readCollectionWorkspace.mock.calls.at(-1)?.[0] ?? {};
      expect(workspaceCall).toEqual(
        expect.objectContaining({
          collectionId: "notes",
          offset: 0,
          limit: 25,
          search: ""
        })
      );
      expect(workspaceCall.category ?? "").toBe("");
      expect(Array.isArray(workspaceCall.labels) ? workspaceCall.labels : []).toEqual([]);
      expect(workspaceCall.recordId ?? "").toBe("");
    });

    fireEvent.mouseDown(screen.getByLabelText("Collection"));
    fireEvent.click(await screen.findByRole("option", { name: "Records" }));

    await waitFor(() => {
      expect(document.getElementById("status-filter-select")).toBeTruthy();
    });
    fireEvent.mouseDown(document.getElementById("status-filter-select"));
    fireEvent.click(await screen.findByRole("option", { name: "published" }));

    await waitFor(() => {
      expect(window.location.search).toContain("status=published");
    });

    await waitFor(() => {
      const workspaceCall = api.readCollectionWorkspace.mock.calls.at(-1)?.[0] ?? {};
      expect(workspaceCall).toEqual(
        expect.objectContaining({
          collectionId: "records",
          offset: 0,
          limit: 25,
          search: "",
          status: "published"
        })
      );
      expect(workspaceCall.noteId ?? "").toBe("");
    });
  }
);
