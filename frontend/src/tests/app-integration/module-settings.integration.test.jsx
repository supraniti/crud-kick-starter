import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
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

describe("module settings", () => {
  test("remotes settings are redacted on read and persisted on save", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/remotes");

    render(<App api={api} />);

    await screen.findByRole("heading", { name: "Remotes" }, { timeout: 10000 });
    await screen.findByText("Module Settings", {}, { timeout: 10000 });

    await waitFor(() => {
      expect(api.listSettingsModules).toHaveBeenCalled();
      expect(api.readModuleSettings).toHaveBeenCalledWith({
        moduleId: "remotes"
      });
    }, { timeout: 10000 });

    const remotesAlerts = screen.getAllByRole("alert");
    expect(
      remotesAlerts.some((alert) =>
        alert.textContent?.includes("Module state: enabled")
      )
    ).toBe(true);
    expect(
      remotesAlerts.some((alert) =>
        alert.textContent?.includes(
          "Settings persistence mode: memory (configured: memory, source: reference-state-persistence, runtime active: yes)"
        )
      )
    ).toBe(true);
    const deployModeInput = screen.getByRole("combobox", { name: "Deploy Mode" });
    expect(deployModeInput).toHaveAttribute("id", "remotes-deployMode-settings-input");
    const deployTimeoutInput = screen.getByLabelText("Deploy Timeout (ms)");
    expect(deployTimeoutInput).toHaveAttribute("id", "remotes-deployTimeoutMs-settings-input");
    expect(deployTimeoutInput).toHaveAttribute("name", "deployTimeoutMs");
    const verifyTlsInput = screen.getByRole("checkbox", { name: "Verify TLS" });
    expect(verifyTlsInput).toHaveAttribute("id", "remotes-verifyTls-settings-input");
    expect(verifyTlsInput).toHaveAttribute("name", "verifyTls");
    const controlPlaneUrlInput = screen.getByLabelText("Control Plane URL");
    expect(controlPlaneUrlInput).toHaveAttribute(
      "id",
      "remotes-controlPlaneUrl-settings-input"
    );
    expect(controlPlaneUrlInput).toHaveAttribute("name", "controlPlaneUrl");
    expect(controlPlaneUrlInput).toHaveValue("https://control.example.invalid/deploy");
    const lastAuditOnInput = screen.getByLabelText("Last Audit On");
    expect(lastAuditOnInput).toHaveAttribute("id", "remotes-lastAuditOn-settings-input");
    expect(lastAuditOnInput).toHaveAttribute("name", "lastAuditOn");
    expect(lastAuditOnInput).toHaveValue("2026-02-01");
    const apiTokenInput = screen.getByLabelText("API Token (sensitive)");
    expect(apiTokenInput).toHaveAttribute("id", "remotes-apiToken-settings-input");
    expect(apiTokenInput).toHaveAttribute("name", "apiToken");
    expect(apiTokenInput).toHaveValue("");

    fireEvent.mouseDown(screen.getByLabelText("Deploy Mode"));
    fireEvent.click(await screen.findByRole("option", { name: "Fast" }));
    fireEvent.change(screen.getByLabelText("Deploy Timeout (ms)"), {
      target: { value: "90000" }
    });
    fireEvent.click(screen.getByLabelText("Verify TLS"));
    fireEvent.change(controlPlaneUrlInput, {
      target: { value: "  https://control-fast.example.invalid/deploy  " }
    });
    fireEvent.change(apiTokenInput, {
      target: { value: "rotated-token" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(api.updateModuleSettings).toHaveBeenCalledWith({
        moduleId: "remotes",
        settings: {
          deployMode: "fast",
          deployTimeoutMs: "90000",
          verifyTls: false,
          controlPlaneUrl: "https://control-fast.example.invalid/deploy",
          apiToken: "rotated-token"
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Module settings saved")).toBeInTheDocument();
      expect(screen.getByLabelText("Control Plane URL")).toHaveValue(
        "https://control-fast.example.invalid/deploy"
      );
      expect(screen.getByLabelText("API Token (sensitive)")).toHaveValue("");
    });
  }, 20000);

  test("dispatches enum-multi settings are rendered and persisted deterministically", async () => {
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
          capabilities: ["ui.route", "schema", "crud.collection", "settings"],
          state: "enabled",
          ui: {
            navigation: {
              label: "Dispatches",
              icon: "inventory_2",
              routeSegment: "dispatch-center"
            },
            routeView: {
              kind: "custom",
              entrypoint: "./frontend/view-entrypoint.jsx"
            }
          },
          collectionIds: ["dispatches"]
        });
        state.moduleSettingsDefinitions.dispatches = {
          moduleId: "dispatches",
          fields: [
            {
              id: "publishChannels",
              label: "Publish Channels",
              type: "enum-multi",
              required: true,
              options: [
                { value: "web", label: "Web" },
                { value: "email", label: "Email" },
                { value: "sms", label: "SMS" }
              ],
              defaultValue: ["web"],
              sensitive: false
            },
            {
              id: "webhookToken",
              label: "Webhook Token",
              type: "text",
              required: false,
              defaultValue: null,
              sensitive: true
            }
          ]
        };
        state.moduleSettingsValues.dispatches = {
          publishChannels: ["web"],
          webhookToken: null
        };
      }
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/dispatch-center");

    render(<App api={api} />);

    await screen.findByRole("heading", { name: "Dispatches" }, { timeout: 10000 });
    await screen.findByText("Module Settings", {}, { timeout: 10000 });

    await waitFor(() => {
      expect(api.readModuleSettings).toHaveBeenCalledWith({
        moduleId: "dispatches"
      });
    }, { timeout: 10000 });

    const publishChannelsInput = screen.getByLabelText("Publish Channels");
    expect(publishChannelsInput).toHaveAttribute(
      "id",
      "dispatches-publishChannels-settings-input"
    );

    fireEvent.mouseDown(publishChannelsInput);
    fireEvent.click(await screen.findByRole("option", { name: "Email" }));
    fireEvent.keyDown(screen.getByRole("listbox", { name: "Publish Channels" }), {
      key: "Escape"
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save settings" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(api.updateModuleSettings).toHaveBeenCalledWith({
        moduleId: "dispatches",
        settings: {
          publishChannels: ["web", "email"]
        }
      });
    });
  }, 20000);

  test("settings remain readable when module runtime is disabled and policy active flag is false", async () => {
    const api = createApiMock({
      mutateState(state) {
        state.modules.splice(2, 0, {
          id: "authors",
          label: "Authors",
          icon: "group"
        });
        state.moduleRuntime.push({
          id: "authors",
          name: "Authors Module",
          version: "0.1.0",
          capabilities: ["ui.route", "schema", "crud.collection", "settings"],
          state: "disabled",
          ui: {
            navigation: {
              label: "Authors",
              icon: "group"
            }
          },
          collectionIds: ["authors"]
        });
        state.moduleSettingsDefinitions.authors = {
          moduleId: "authors",
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
              id: "webhookToken",
              label: "Webhook Token",
              type: "text",
              required: false,
              defaultValue: null,
              sensitive: true
            }
          ]
        };
        state.moduleSettingsValues.authors = {
          editorialMode: "standard",
          webhookToken: null
        };
      }
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/authors");

    render(<App api={api} />);

    await screen.findByRole("heading", { name: "Authors" }, { timeout: 10000 });
    await screen.findByText("Module Settings", {}, { timeout: 10000 });

    await waitFor(() => {
      expect(api.readModuleSettings).toHaveBeenCalledWith({
        moduleId: "authors"
      });
    }, { timeout: 10000 });

    const disabledAlerts = screen.getAllByRole("alert");
    expect(
      disabledAlerts.some((alert) =>
        alert.textContent?.includes("Module state: disabled")
      )
    ).toBe(true);
    expect(
      disabledAlerts.some((alert) =>
        alert.textContent?.includes(
          "Settings persistence mode: memory (configured: memory, source: reference-state-persistence, runtime active: no)"
        )
      )
    ).toBe(true);
    expect(screen.getByLabelText("Webhook Token (sensitive)")).toHaveValue("");

    fireEvent.mouseDown(screen.getByLabelText("Editorial Mode"));
    fireEvent.click(await screen.findByRole("option", { name: "Strict" }));
    fireEvent.change(screen.getByLabelText("Webhook Token (sensitive)"), {
      target: { value: "disabled-authors-token" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(api.updateModuleSettings).toHaveBeenCalledWith({
        moduleId: "authors",
        settings: {
          editorialMode: "strict",
          webhookToken: "disabled-authors-token"
        }
      });
    });
  }, 20000);

  test("authors settings are redacted on read and persisted on save", async () => {
    const api = createApiMock({
      mutateState(state) {
        state.modules.splice(2, 0, {
          id: "authors",
          label: "Authors",
          icon: "group"
        });
        state.moduleRuntime.push({
          id: "authors",
          name: "Authors Module",
          version: "0.1.0",
          capabilities: ["ui.route", "schema", "crud.collection", "settings"],
          state: "enabled",
          ui: {
            navigation: {
              label: "Authors",
              icon: "group"
            }
          },
          collectionIds: ["authors"]
        });
        state.moduleSettingsDefinitions.authors = {
          moduleId: "authors",
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
              id: "webhookToken",
              label: "Webhook Token",
              type: "text",
              required: false,
              defaultValue: null,
              sensitive: true
            }
          ]
        };
        state.moduleSettingsValues.authors = {
          editorialMode: "standard",
          webhookToken: null
        };
      }
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/authors");

    render(<App api={api} />);

    await screen.findByRole("heading", { name: "Authors" }, { timeout: 10000 });
    await screen.findByText("Module Settings", {}, { timeout: 10000 });

    await waitFor(() => {
      expect(api.listSettingsModules).toHaveBeenCalled();
      expect(api.readModuleSettings).toHaveBeenCalledWith({
        moduleId: "authors"
      });
    }, { timeout: 10000 });

    expect(screen.getByLabelText("Webhook Token (sensitive)")).toHaveValue("");

    fireEvent.mouseDown(screen.getByLabelText("Editorial Mode"));
    fireEvent.click(await screen.findByRole("option", { name: "Strict" }));
    fireEvent.change(screen.getByLabelText("Webhook Token (sensitive)"), {
      target: { value: "authors-token" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(api.updateModuleSettings).toHaveBeenCalledWith({
        moduleId: "authors",
        settings: {
          editorialMode: "strict",
          webhookToken: "authors-token"
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Module settings saved")).toBeInTheDocument();
      expect(screen.getByLabelText("Webhook Token (sensitive)")).toHaveValue("");
    });
  }, 20000);

  test("publishers settings are redacted on read and persisted on save", async () => {
    const api = createApiMock({
      mutateState(state) {
        state.modules.splice(3, 0, {
          id: "publishers",
          label: "Publishers",
          icon: "store"
        });
        state.moduleRuntime.push({
          id: "publishers",
          name: "Publishers Module",
          version: "0.1.0",
          capabilities: ["ui.route", "schema", "crud.collection", "settings"],
          state: "enabled",
          ui: {
            navigation: {
              label: "Publishers",
              icon: "store"
            }
          },
          collectionIds: ["publishers"]
        });
        state.moduleSettingsDefinitions.publishers = {
          moduleId: "publishers",
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
              id: "webhookToken",
              label: "Webhook Token",
              type: "text",
              required: false,
              defaultValue: null,
              sensitive: true
            }
          ]
        };
        state.moduleSettingsValues.publishers = {
          editorialMode: "standard",
          webhookToken: null
        };
      }
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/publishers");

    render(<App api={api} />);

    await screen.findByRole("heading", { name: "Publishers" }, { timeout: 10000 });
    await screen.findByText("Module Settings", {}, { timeout: 10000 });

    await waitFor(() => {
      expect(api.listSettingsModules).toHaveBeenCalled();
      expect(api.readModuleSettings).toHaveBeenCalledWith({
        moduleId: "publishers"
      });
    }, { timeout: 10000 });

    expect(screen.getByLabelText("Webhook Token (sensitive)")).toHaveValue("");

    fireEvent.mouseDown(screen.getByLabelText("Editorial Mode"));
    fireEvent.click(await screen.findByRole("option", { name: "Strict" }));
    fireEvent.change(screen.getByLabelText("Webhook Token (sensitive)"), {
      target: { value: "publishers-token" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(api.updateModuleSettings).toHaveBeenCalledWith({
        moduleId: "publishers",
        settings: {
          editorialMode: "strict",
          webhookToken: "publishers-token"
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Module settings saved")).toBeInTheDocument();
      expect(screen.getByLabelText("Webhook Token (sensitive)")).toHaveValue("");
    });
  }, 20000);

  test("editors settings are redacted on read and persisted on save", async () => {
    const api = createApiMock({
      mutateState(state) {
        state.modules.splice(4, 0, {
          id: "editors",
          label: "Editors",
          icon: "inventory_2"
        });
        state.moduleRuntime.push({
          id: "editors",
          name: "Editors Module",
          version: "0.1.0",
          capabilities: ["ui.route", "schema", "crud.collection", "settings"],
          state: "enabled",
          ui: {
            navigation: {
              label: "Editors",
              icon: "inventory_2"
            }
          },
          collectionIds: ["editors"]
        });
        state.moduleSettingsDefinitions.editors = {
          moduleId: "editors",
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
              id: "webhookToken",
              label: "Webhook Token",
              type: "text",
              required: false,
              defaultValue: null,
              sensitive: true
            }
          ]
        };
        state.moduleSettingsValues.editors = {
          editorialMode: "standard",
          webhookToken: null
        };
      }
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/editors");

    render(<App api={api} />);

    await screen.findByRole("heading", { name: "Editors" }, { timeout: 10000 });
    await screen.findByText("Module Settings", {}, { timeout: 10000 });

    await waitFor(() => {
      expect(api.listSettingsModules).toHaveBeenCalled();
      expect(api.readModuleSettings).toHaveBeenCalledWith({
        moduleId: "editors"
      });
    }, { timeout: 10000 });

    expect(screen.getByLabelText("Webhook Token (sensitive)")).toHaveValue("");

    fireEvent.mouseDown(screen.getByLabelText("Editorial Mode"));
    fireEvent.click(await screen.findByRole("option", { name: "Strict" }));
    fireEvent.change(screen.getByLabelText("Webhook Token (sensitive)"), {
      target: { value: "editors-token" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));

    await waitFor(() => {
      expect(api.updateModuleSettings).toHaveBeenCalledWith({
        moduleId: "editors",
        settings: {
          editorialMode: "strict",
          webhookToken: "editors-token"
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Module settings saved")).toBeInTheDocument();
      expect(screen.getByLabelText("Webhook Token (sensitive)")).toHaveValue("");
    });
  }, 20000);
});
