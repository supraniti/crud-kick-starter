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

describe("Collections CRUD validation and diagnostics", () => {
  test("computed collection fields do not emit unsupported fallback diagnostics", async () => {
    const api = createApiMock();
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/records");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
      expect(screen.getByText("Launch Checklist")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Field 'slug' uses unsupported type 'computed'. Rendering is blocked.")
    ).not.toBeInTheDocument();
  });

  test("aggregated validation conflicts surface summary error payloads without breaking form flow", async () => {
    const api = createApiMock();
    api.createCollectionItem.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "PUBLISHER_RECORD_NOT_FOUND",
        message: "Record 'rec-999' was not found for publisher reference",
        conflicts: [
          {
            order: 0,
            code: "PUBLISHER_RECORD_NOT_FOUND",
            fieldId: "recordId",
            message: "Record 'rec-999' was not found for publisher reference"
          },
          {
            order: 1,
            code: "PUBLISHER_PARTNER_AUTHOR_ID_NOT_FOUND",
            fieldId: "partnerAuthorId",
            message: "Author 'aut-999' was not found for publisher reference"
          }
        ]
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
      target: { value: "Record with aggregated conflicts" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create record" }));

    await waitFor(() => {
      expect(
        screen.getByText("Record 'rec-999' was not found for publisher reference")
      ).toBeInTheDocument();
    });
  }, 15000);

  test("unsupported field types surface deterministic fallback diagnostics", async () => {
    const api = createApiMock({
      mutateState(state) {
        state.collectionSchemas.records.fields.push({
          id: "payload",
          label: "Payload",
          type: "json"
        });
      }
    });
    window.localStorage.setItem(AUTH_STORAGE_KEY, "1");
    setPath("/app/records");

    render(<App api={api} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 5, name: "Records" })).toBeInTheDocument();
    });

    const diagnosticMessages = await screen.findAllByText(
      "Field 'payload' uses unsupported type 'json'. Rendering is blocked."
    );
    expect(diagnosticMessages.length).toBeGreaterThanOrEqual(2);
  });
});
