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

describe("Collections CRUD reference policies", () => {
  test("records module supports inline-create dialog for linked notes references", async () => {
    const api = createApiMock({
      mutateState(state) {
        const linkedNotesField = state.collectionSchemas.records.fields.find(
          (field) => field?.id === "noteIds"
        );
        if (linkedNotesField) {
          linkedNotesField.labelField = "title";
          linkedNotesField.referenceUi = {
            inlineCreate: true
          };
        }
      }
    });
    const promptSpy = vi.spyOn(window, "prompt").mockImplementation(() => "unexpected");
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/records");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
    });

    fireEvent.click(await screen.findByRole("button", { name: "Add" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getAllByRole("textbox")[0], {
      target: { value: "Inline Created Note" }
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.createCollectionItem).toHaveBeenNthCalledWith(1, {
        collectionId: "notes",
        item: {
          title: "Inline Created Note",
          category: "general",
          labels: [],
          priority: 1,
          pinned: false,
          dueDate: null,
          recordId: null
        }
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Record With Inline Note" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => {
      expect(api.createCollectionItem).toHaveBeenNthCalledWith(2, {
        collectionId: "records",
        item: {
          title: "Record With Inline Note",
          status: "draft",
          score: 0,
          featured: false,
          publishedOn: null,
          noteIds: ["note-003"]
        }
      });
    });
    expect(promptSpy).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  }, 20000);

  test("delete restrict errors expose action buttons that run route navigation payloads", async () => {
    const api = createApiMock();
    api.deleteCollectionItem.mockImplementation(async ({ collectionId, itemId }) => ({
      ok: false,
      error: {
        code: "REFERENCE_DELETE_RESTRICTED",
        message: `Cannot delete '${itemId}' from '${collectionId}'`,
        actions: [
          {
            id: "show-referencing-notes",
            label: "Show referencing notes",
            type: "navigate",
            route: {
              moduleId: "records",
              state: {
                collectionId: "notes",
                recordId: itemId
              }
            }
          }
        ]
      }
    }));
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/records");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
      expect(screen.getByText("Launch Checklist")).toBeInTheDocument();
    });

    const row = screen.getByText("Launch Checklist").closest("tr");
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByText("Cannot delete 'rec-001' from 'records'")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Show referencing notes" }));

    await waitFor(() => {
      expect(api.readCollectionWorkspace).toHaveBeenCalledWith(
        expect.objectContaining({
          collectionId: "notes",
          recordId: "rec-001"
        })
      );
    });
    expect(window.location.pathname).toBe("/app/records");
    expect(window.location.search).toContain("collectionId=notes");
  }, 15000);
});
