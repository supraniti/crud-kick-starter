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

describe("Module lifecycle collection availability", () => {
  test("records collection workspace becomes unavailable on disable and recovers on enable", async () => {
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
      expect(screen.getByText("records")).toBeInTheDocument();
    });

    let runtimeRow = screen.getByText("records").closest("tr");
    fireEvent.click(within(runtimeRow).getByRole("button", { name: "Disable" }));

    await waitFor(() => {
      expect(api.disableModule).toHaveBeenCalledWith({
        moduleId: "records"
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/transitioned enabled -> disabled/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    fireEvent.keyDown(document.body, { key: "Escape", code: "Escape" });
    await waitFor(() => {
      expect(screen.queryByText("Module Runtime Controls")).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Records", hidden: true })).toHaveAttribute(
        "data-module-state",
        "disabled"
      );
      expect(screen.getByRole("button", { name: "Records", hidden: true })).toHaveAttribute(
        "data-route-available",
        "false"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Records", hidden: true }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Collection 'records' is unavailable/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("button", { name: "Create record" })).toBeDisabled();

    fireEvent.click(screen.getAllByRole("button", { name: "Open remotes" })[0]);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Remotes" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Runtime settings" }));
    await waitFor(() => {
      expect(screen.getByText("Module Runtime Controls")).toBeInTheDocument();
      expect(screen.getByText("records")).toBeInTheDocument();
    });

    runtimeRow = screen.getByText("records").closest("tr");
    fireEvent.click(within(runtimeRow).getByRole("button", { name: "Enable" }));

    await waitFor(() => {
      expect(api.enableModule).toHaveBeenCalledWith({
        moduleId: "records"
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/transitioned disabled -> enabled/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Records", hidden: true })).toHaveAttribute(
        "data-module-state",
        "enabled"
      );
      expect(screen.getByRole("button", { name: "Records", hidden: true })).toHaveAttribute(
        "data-route-available",
        "true"
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => {
      expect(screen.queryByText("Module Runtime Controls")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Records", hidden: true }));

    await waitFor(() => {
      expect(screen.queryByText(/Collection 'records' is unavailable/i)).not.toBeInTheDocument();
      expect(screen.getByText("Launch Checklist")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Create record" })).not.toBeDisabled();
  }, 20000);
});
