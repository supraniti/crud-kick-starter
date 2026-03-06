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

describe("Products and taxonomies safeguards", () => {
  test("safeguard hook renders structured safeguard payload", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/products");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Tag value"), {
      target: { value: "New Tag" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview safeguard" }));

    await waitFor(() => {
      expect(api.previewSafeguard).toHaveBeenCalledWith({
        action: "create-tag",
        value: "New Tag"
      });
    });

    expect(
      screen.getByText(/SAFEGUARD_CONFIRMATION_REQUIRED: Action 'create-tag' affects dependent records/i)
    ).toBeInTheDocument();
  });

  test("relation editor requires safeguard confirmation for new tag creation", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/products");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByText("Mechanical Keyboard")).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Edit tags" })[0]);
    fireEvent.change(screen.getByLabelText("Create new tag"), {
      target: { value: "Seasonal" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save tags" }));

    await waitFor(() => {
      expect(api.updateProductTags).toHaveBeenCalledWith({
        productId: "prd-001",
        tagIds: ["tag-001", "tag-004"],
        newTagLabel: "Seasonal",
        approveNewTag: false
      });
    });

    expect(
      screen.getByText(/SAFEGUARD_CONFIRMATION_REQUIRED: Action 'create-tag' affects dependent records/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm new tag and save" }));

    await waitFor(() => {
      expect(api.updateProductTags).toHaveBeenCalledWith({
        productId: "prd-001",
        tagIds: ["tag-001", "tag-004"],
        newTagLabel: "Seasonal",
        approveNewTag: true
      });
    });
  });

  test("taxonomy impact and approved delete cleanup flow is executable", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/taxonomies");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Taxonomies" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Select tag Featured")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Select tag Featured"));
    fireEvent.click(screen.getByRole("button", { name: "Analyze impact" }));

    await waitFor(() => {
      expect(api.analyzeTagDelete).toHaveBeenCalledWith({
        tagIds: ["tag-001"]
      });
    });

    expect(screen.getByText(/Impact: 2 dependent products, 2 references/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve delete and cleanup" }));

    await waitFor(() => {
      expect(api.deleteTags).toHaveBeenCalledWith({
        tagIds: ["tag-001"],
        approved: true
      });
    });

    expect(screen.getByText(/Cleanup complete: removed 1 tags and 2 references/i)).toBeInTheDocument();
  });
});
