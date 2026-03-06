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

longTest("app-shell navigation: login shell and module navigation", async () => {
  const api = createApiMock();
  render(<App api={api} />);

  fireEvent.click(screen.getByRole("button", { name: /sign in \(local\)/i }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
  });

  expect(window.location.pathname).toBe("/app/products");

  fireEvent.click(screen.getByRole("button", { name: "Taxonomies" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Taxonomies" })).toBeInTheDocument();
  });

  expect(window.location.pathname).toBe("/app/taxonomies");

  fireEvent.click(screen.getByRole("button", { name: "Missions" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Mission Operator" })).toBeInTheDocument();
  });

  expect(window.location.pathname).toBe("/app/missions");
});

longTest("app-shell navigation: module-owned custom route mounts without app-shell branching", async () => {
  const api = createApiMock({
    mutateState(state) {
      state.modules.splice(1, 0, {
        id: "articles",
        label: "Articles",
        icon: "article"
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
          },
          routeView: {
            kind: "custom",
            entrypoint: "./frontend/view-entrypoint.jsx",
            quickActions: ["open-remotes", "open-missions"],
            capabilities: {
              usesCollectionsDomain: false
            }
          }
        },
        collectionIds: ["articles"]
      });
    }
  });
  window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
  setPath("/app/articles");

  render(<App api={api} />);

  await waitFor(() => {
    expect(screen.getByRole("button", { name: "Articles" })).toBeInTheDocument();
  });
  expect(
    screen.getByText(/Articles custom control surface is mounted without collections-domain coupling\./i)
  ).toBeInTheDocument();
  expect(screen.getByText(/Articles Control Center/i)).toBeInTheDocument();
  expect(api.listCollectionItems).not.toHaveBeenCalled();
  expect(api.readCollectionWorkspace).not.toHaveBeenCalled();
});

longTest("app-shell navigation: module settings panel mounts for module routes", async () => {
  const api = createApiMock({
    mutateState(state) {
      state.modules.splice(1, 0, {
        id: "articles",
        label: "Articles",
        icon: "article"
      });
      state.moduleRuntime.push({
        id: "articles",
        name: "Articles Module",
        version: "0.1.0",
        capabilities: ["ui.route", "schema", "crud.collection", "settings"],
        state: "enabled",
        ui: {
          navigation: {
            label: "Articles",
            icon: "article"
          }
        },
        collectionIds: ["records", "notes"]
      });
      state.moduleSettingsDefinitions.articles = {
        moduleId: "articles",
        fields: [
          {
            id: "editorialMode",
            label: "Editorial Mode",
            type: "enum",
            required: true,
            options: [
              { value: "standard", label: "Standard" },
              { value: "strict", label: "Strict" }
            ],
            defaultValue: "standard",
            sensitive: false
          },
          {
            id: "requireReview",
            label: "Require Review",
            type: "boolean",
            required: true,
            defaultValue: true,
            sensitive: false
          }
        ]
      };
      state.moduleSettingsValues.articles = {
        editorialMode: "standard",
        requireReview: true
      };
    }
  });

  window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
  setPath("/app/articles");
  render(<App api={api} />);

  await waitFor(() => {
    expect(screen.getByRole("heading", { level: 5, name: "Articles" })).toBeInTheDocument();
    expect(screen.getByText(/Configure persisted settings for module/i)).toBeInTheDocument();
    expect(screen.getByText("articles")).toBeInTheDocument();
  });
});
