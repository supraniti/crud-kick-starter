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

describe("Collections CRUD lifecycle", () => {
  test("records module supports full create/update/delete CRUD flow", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/records");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
    });
    const collectionInput = screen.getByRole("combobox", { name: "Collection" });
    expect(collectionInput).toHaveAttribute("id", "collection-select-input");
    const collectionNameInput = document.querySelector('input[name="collection"]');
    expect(collectionNameInput).toBeTruthy();
    expect(collectionNameInput).toHaveAttribute("id", "collection-select-input-value");
    const searchInput = screen.getByLabelText("Search title");
    expect(searchInput).toHaveAttribute("id", "collection-filter-search");
    expect(searchInput).toHaveAttribute("name", "search");

    const createTitleInput = await screen.findByLabelText("Title");
    fireEvent.change(createTitleInput, {
      target: { value: "Quarterly Plan" }
    });
    const scoreInput = await screen.findByLabelText("Score");
    fireEvent.change(scoreInput, {
      target: { value: "91" }
    });
    const linkedNotesInput = await screen.findByLabelText("Linked notes");
    fireEvent.mouseDown(linkedNotesInput);
    const createNotesListbox = await screen.findByRole("listbox", { name: "Linked notes" });
    fireEvent.click(within(createNotesListbox).getByRole("option", { name: "Ops Followup" }));
    fireEvent.keyDown(createNotesListbox, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => {
      expect(api.createCollectionItem).toHaveBeenCalledWith({
        collectionId: "records",
        item: {
          title: "Quarterly Plan",
          status: "draft",
          score: 91,
          featured: false,
          publishedOn: null,
          noteIds: ["note-001"]
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Record created")).toBeInTheDocument();
      expect(screen.getByText("Quarterly Plan")).toBeInTheDocument();
    });

    const createdRow = screen.getByText("Quarterly Plan").closest("tr");
    fireEvent.click(within(createdRow).getByRole("button", { name: "Edit" }));

    await screen.findByRole("button", { name: "Update record" });
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Quarterly Plan v2" }
    });
    const editStatusComboboxes = await screen.findAllByRole("combobox", {
      name: "Status"
    });
    fireEvent.mouseDown(editStatusComboboxes.at(-1));
    fireEvent.click(await screen.findByRole("option", { name: "published" }));
    fireEvent.mouseDown(screen.getByLabelText("Linked notes"));
    const updateNotesListbox = await screen.findByRole("listbox", { name: "Linked notes" });
    fireEvent.click(within(updateNotesListbox).getByRole("option", { name: "Ops Followup" }));
    fireEvent.click(within(updateNotesListbox).getByRole("option", { name: "Frontend Polish" }));
    fireEvent.keyDown(updateNotesListbox, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Update record" }));

    await waitFor(() => {
      expect(
        screen.getByText("Record publishedOn is required when status is published")
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Published On"), {
      target: { value: "2026-04-01" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update record" }));

    await waitFor(() => {
      expect(api.updateCollectionItem).toHaveBeenCalledWith({
        collectionId: "records",
        itemId: "rec-003",
        item: {
          title: "Quarterly Plan v2",
          status: "published",
          score: 91,
          featured: false,
          publishedOn: "2026-04-01",
          noteIds: ["note-002"]
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Record updated")).toBeInTheDocument();
      expect(screen.getByText("Quarterly Plan v2")).toBeInTheDocument();
    });

    const updatedRow = screen.getByText("Quarterly Plan v2").closest("tr");
    fireEvent.click(within(updatedRow).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.deleteCollectionItem).toHaveBeenCalledWith({
        collectionId: "records",
        itemId: "rec-003"
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Record deleted")).toBeInTheDocument();
      expect(screen.queryByText("Quarterly Plan v2")).not.toBeInTheDocument();
    });
  }, 30_000);

  test("records module can filter by linked note reference", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/records");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText("Launch Checklist")).toBeInTheDocument();
    });

    const linkedNoteFilterInput = await screen.findByLabelText("Filter by linked note");
    fireEvent.mouseDown(linkedNoteFilterInput);
    const noteFilterListbox = await screen.findByRole("listbox", { name: "Filter by linked note" });
    fireEvent.click(within(noteFilterListbox).getByRole("option", { name: "Ops Followup" }));
    fireEvent.keyDown(noteFilterListbox, { key: "Escape" });

    await waitFor(() => {
      expect(api.readCollectionWorkspace).toHaveBeenCalledWith({
        collectionId: "records",
        offset: 0,
        limit: 25,
        search: "",
        status: "",
        noteId: "note-001"
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Launch Checklist")).toBeInTheDocument();
      expect(screen.queryByText("Release Notes Draft")).not.toBeInTheDocument();
    });
  }, 30_000);

  test("records form status options are schema-driven", async () => {
    const api = createApiMock({
      mutateState(state) {
        const recordsSchema = state.collectionSchemas?.records;
        const statusField =
          recordsSchema?.fields?.find((field) => field?.id === "status") ?? null;
        if (statusField) {
          statusField.options = ["draft", "archived"];
        }
      }
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/records");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
    });

    const titleInput = await screen.findByLabelText("Title");
    fireEvent.change(titleInput, {
      target: { value: "Archived Contract Item" }
    });

    const statusComboboxes = await screen.findAllByRole("combobox", {
      name: "Status"
    });
    fireEvent.mouseDown(statusComboboxes.at(-1));
    const statusListbox = await screen.findByRole("listbox", { name: "Status" });
    fireEvent.click(within(statusListbox).getByRole("option", { name: "archived" }));
    fireEvent.keyDown(statusListbox, { key: "Escape" });

    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => {
      expect(api.createCollectionItem).toHaveBeenCalledWith({
        collectionId: "records",
        item: {
          title: "Archived Contract Item",
          status: "archived",
          score: 0,
          featured: false,
          publishedOn: null,
          noteIds: []
        }
      });
    });
  }, 30_000);

  test("records module can switch to notes collection and run full note CRUD", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/records");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Collection" }));
    let selectedFromPopup = false;
    try {
      const collectionListbox = await screen.findByRole("listbox", undefined, { timeout: 750 });
      const notesOption =
        within(collectionListbox).queryByRole("option", { name: /notes/i }) ??
        within(collectionListbox).queryByRole("menuitem", { name: /notes/i });
      if (notesOption) {
        fireEvent.click(notesOption);
        selectedFromPopup = true;
      }
    } catch {
      selectedFromPopup = false;
    }
    if (!selectedFromPopup) {
      const collectionHiddenInput = document.querySelector('input[name="collection"]');
      if (!collectionHiddenInput) {
        throw new Error("Collection hidden input not found");
      }
      fireEvent.change(collectionHiddenInput, { target: { value: "notes" } });
    }

    await waitFor(() => {
      expect(screen.getByText("Ops Followup")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Release Checklist Note" }
    });
    fireEvent.change(screen.getByLabelText("Priority"), {
      target: { value: "4" }
    });
    fireEvent.change(screen.getByLabelText("Due Date"), {
      target: { value: "2026-03-01" }
    });
    fireEvent.click(screen.getByLabelText("Pinned"));
    fireEvent.mouseDown(screen.getByLabelText("Labels"));
    const labelsListbox = await screen.findByRole("listbox", { name: "Labels" });
    fireEvent.click(within(labelsListbox).getByRole("option", { name: "ops" }));
    fireEvent.click(within(labelsListbox).getByRole("option", { name: "release" }));
    fireEvent.keyDown(labelsListbox, { key: "Escape" });
    fireEvent.mouseDown(screen.getByLabelText("Related record"));
    const recordListbox = await screen.findByRole("listbox", { name: "Related record" });
    fireEvent.click(within(recordListbox).getByRole("option", { name: "Launch Checklist" }));
    fireEvent.keyDown(recordListbox, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Create note" }));

    await waitFor(() => {
      expect(api.createCollectionItem).toHaveBeenCalledWith({
        collectionId: "notes",
        item: {
          title: "Release Checklist Note",
          category: "general",
          labels: ["ops", "release"],
          priority: 4,
          pinned: true,
          dueDate: "2026-03-01",
          recordId: "rec-001"
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Note created")).toBeInTheDocument();
      expect(screen.getByText("Release Checklist Note")).toBeInTheDocument();
    });

    const createdRow = screen.getByText("Release Checklist Note").closest("tr");
    fireEvent.click(within(createdRow).getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Release Checklist Note v2" }
    });
    fireEvent.change(screen.getByLabelText("Due Date"), {
      target: { value: "" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update note" }));

    await waitFor(() => {
      expect(
        screen.getByText("Note dueDate is required when labels include 'release'")
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Due Date"), {
      target: { value: "2026-03-01" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Update note" }));

    await waitFor(() => {
      expect(api.updateCollectionItem).toHaveBeenCalledWith({
        collectionId: "notes",
        itemId: "note-003",
        item: {
          title: "Release Checklist Note v2",
          category: "general",
          labels: ["ops", "release"],
          priority: 4,
          pinned: true,
          dueDate: "2026-03-01",
          recordId: "rec-001"
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Note updated")).toBeInTheDocument();
      expect(screen.getByText("Release Checklist Note v2")).toBeInTheDocument();
    });

    const updatedRow = screen.getByText("Release Checklist Note v2").closest("tr");
    fireEvent.click(within(updatedRow).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.deleteCollectionItem).toHaveBeenCalledWith({
        collectionId: "notes",
        itemId: "note-003"
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Note deleted")).toBeInTheDocument();
      expect(screen.queryByText("Release Checklist Note v2")).not.toBeInTheDocument();
    });
  }, 30_000);
});
