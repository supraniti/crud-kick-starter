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

longTest(
  "app-shell actions: quick actions and custom actions navigate deterministically from manifest descriptors",
  async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
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
              quickActions: ["open-missions", "open-remotes"],
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
                  id: "dispatch-runbook",
                  label: "Dispatch runbook",
                  type: "external",
                  href: "https://dispatches.example.invalid/runbook",
                  target: "blank"
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
          collectionIds: ["records", "notes"]
        });
      }
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/dispatch-center");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Open missions" })).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Open remotes" }).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: "Open review queue" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reset dispatch filters" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Dispatch runbook" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open review queue" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/app/dispatch-center");
      expect(window.location.search).toContain("status=review");
      expect(window.location.search).toContain("collectionId=dispatches");
    });

    fireEvent.click(screen.getByRole("button", { name: "Reset dispatch filters" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/app/dispatch-center");
      expect(window.location.search).not.toContain("status=review");
      expect(window.location.search).toContain("collectionId=dispatches");
    });

    fireEvent.click(screen.getByRole("button", { name: "Open missions" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/app/missions");
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Mission Operator" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Dispatches" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/app/dispatch-center");
    });
    fireEvent.click(screen.getAllByRole("button", { name: "Open remotes" })[0]);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/app/remotes");
    });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Remotes" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Dispatches" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/app/dispatch-center");
    });
    fireEvent.click(screen.getByRole("button", { name: "Dispatch runbook" }));
    expect(openSpy).toHaveBeenCalledWith(
      "https://dispatches.example.invalid/runbook",
      "_blank",
      "noopener,noreferrer"
    );
    openSpy.mockRestore();
  }
);
