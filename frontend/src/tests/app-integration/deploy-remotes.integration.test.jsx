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

describe("Deploy and remotes", () => {
  test("deploy state panel reflects dirty state and successful deploy job", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/products");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("Mechanical Keyboard")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Deploy now" })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Edit tags" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Save tags" }));

    await waitFor(() => {
      expect(api.updateProductTags).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Edit Product Tags" })).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Remotes" }));

    await waitFor(() => {
      expect(screen.getByText("Deploy required")).toBeInTheDocument();
    });
    const deployTargetInput = screen.getByRole("combobox", { name: "Deploy target" });
    expect(deployTargetInput).toHaveAttribute("id", "deploy-remote-select-input");
    const deployTargetNameInput = document.querySelector('input[name="deployTarget"]');
    expect(deployTargetNameInput).toBeTruthy();
    expect(deployTargetNameInput).toHaveAttribute("id", "deploy-remote-select-input");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Deploy now" })).not.toBeDisabled();
    });
    const deployButton = screen.getByRole("button", { name: "Deploy now" });

    fireEvent.click(deployButton);

    await waitFor(() => {
      expect(api.startDeployJob).toHaveBeenCalledWith({
        remoteId: "remote-001"
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Deployed")).toBeInTheDocument();
      expect(screen.getByText(/Job job-000001: succeeded/i)).toBeInTheDocument();
      expect(screen.getByText(/\[info\] Deploy job succeeded/i)).toBeInTheDocument();
    });
  }, 15000);

  test("remotes module supports create and delete flow", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/remotes");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Remotes" })).toBeInTheDocument();
    });

    const labelInput = screen.getByLabelText("Label");
    expect(labelInput).toHaveAttribute("id", "remote-label-input");
    expect(labelInput).toHaveAttribute("name", "label");
    const kindInput = screen.getByRole("combobox", { name: "Kind" });
    expect(kindInput).toHaveAttribute("id", "remote-kind-select");
    const endpointInput = screen.getByLabelText("Endpoint");
    expect(endpointInput).toHaveAttribute("id", "remote-endpoint-input");
    expect(endpointInput).toHaveAttribute("name", "endpoint");
    const enabledInput = screen.getByRole("checkbox", { name: "Remote enabled" });
    expect(enabledInput).toHaveAttribute("id", "remote-enabled-checkbox");
    expect(enabledInput).toHaveAttribute("name", "enabled");

    fireEvent.change(labelInput, {
      target: { value: "QA Mirror" }
    });
    fireEvent.change(endpointInput, {
      target: { value: "https://qa.example.invalid/deploy" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create remote" }));

    await waitFor(() => {
      expect(api.createRemote).toHaveBeenCalledWith({
        label: "QA Mirror",
        kind: "filesystem",
        endpoint: "https://qa.example.invalid/deploy",
        enabled: true
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Remote created")).toBeInTheDocument();
      expect(screen.getByText("QA Mirror")).toBeInTheDocument();
    });

    const row = screen.getByText("QA Mirror").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.deleteRemote).toHaveBeenCalledWith({
        remoteId: "remote-003"
      });
    });
  }, 15000);
});
