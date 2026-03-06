import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

describe("Module lifecycle runtime controls", () => {
  test("remotes module executes disable/uninstall/install/enable lifecycle flow", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/remotes");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Remotes" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Runtime settings" }));

    await waitFor(() => {
      expect(screen.getByText("Module Runtime Controls")).toBeInTheDocument();
      expect(screen.getByText("products")).toBeInTheDocument();
    });

    const runtimeTable = screen
      .getByRole("columnheader", { name: "Collection Policy" })
      .closest("table");
    expect(runtimeTable).toBeTruthy();
    const runtimeRows = within(runtimeTable).getAllByRole("row");
    const recordsRow = runtimeRows.find((row) => within(row).queryByText(/^records$/i));
    expect(recordsRow).toBeTruthy();
    expect(
      within(recordsRow).getByText(
        /records: memory \(configured: memory, source: reference-state-persistence, active: yes\)/i
      )
    ).toBeInTheDocument();

    const remotesRow = runtimeRows.find((row) => within(row).queryByText(/^remotes$/i));
    expect(remotesRow).toBeTruthy();
    expect(
      within(remotesRow).getByText(
        /memory \(configured: memory, source: reference-state-persistence, active: yes\)/i
      )
    ).toBeInTheDocument();

    let row = screen.getByText("products").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: "Disable" }));

    await waitFor(() => {
      expect(api.disableModule).toHaveBeenCalledWith({
        moduleId: "products"
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/transitioned enabled -> disabled/i)).toBeInTheDocument();
      const updatedRow = screen.getByText("products").closest("tr");
      expect(within(updatedRow).getByText("disabled")).toBeInTheDocument();
    });

    row = screen.getByText("products").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: "Uninstall" }));

    await waitFor(() => {
      expect(api.uninstallModule).toHaveBeenCalledWith({
        moduleId: "products"
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/transitioned disabled -> uninstalled/i)).toBeInTheDocument();
      const updatedRow = screen.getByText("products").closest("tr");
      expect(within(updatedRow).getByText("uninstalled")).toBeInTheDocument();
    });

    row = screen.getByText("products").closest("tr");
    expect(within(row).getByRole("button", { name: "Enable" })).toBeDisabled();
    expect(within(row).getByRole("button", { name: "Install" })).not.toBeDisabled();

    fireEvent.click(within(row).getByRole("button", { name: "Install" }));
    await waitFor(() => {
      expect(api.installModule).toHaveBeenCalledWith({
        moduleId: "products"
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/transitioned uninstalled -> installed/i)).toBeInTheDocument();
      const updatedRow = screen.getByText("products").closest("tr");
      expect(within(updatedRow).getByText("installed")).toBeInTheDocument();
    });

    row = screen.getByText("products").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: "Enable" }));
    await waitFor(() => {
      expect(api.enableModule).toHaveBeenCalledWith({
        moduleId: "products"
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/transitioned installed -> enabled/i)).toBeInTheDocument();
      const updatedRow = screen.getByText("products").closest("tr");
      expect(within(updatedRow).getByText("enabled")).toBeInTheDocument();
    });
  }, 20000);
});
