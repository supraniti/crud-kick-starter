import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import {
  COLLECTION_FIELD_EDITOR_COMPUTED_RESOLVER_UNSUPPORTED,
  COLLECTION_FIELD_EDITOR_UNSUPPORTED_TYPE,
  COLLECTION_FIELD_RENDERER_COMPUTED_RESOLVER_UNSUPPORTED,
  COLLECTION_FIELD_RENDERER_UNSUPPORTED_TYPE,
  resolveCollectionFieldCellDefinition,
  resolveCollectionFieldEditorDefinition
} from "../../ui/collections/field-registry.jsx";
import { SUPPORTED_COLLECTION_FIELD_TYPES } from "../../runtime/shared-capability-bridges/collection-field-catalog.mjs";

describe("collections field registry contract", () => {
  test("resolves covered field types without unsupported diagnostics", () => {
    const coveredFields = SUPPORTED_COLLECTION_FIELD_TYPES.map((type) => ({
      id:
        type === "reference-multi"
          ? "noteIds"
          : type === "reference"
            ? "recordId"
            : type === "enum-multi"
              ? "labels"
              : type === "enum"
                ? "status"
                : type === "number"
                  ? "score"
                  : type === "boolean"
                    ? "featured"
                    : type === "date"
                      ? "publishedOn"
                      : type === "url"
                        ? "sourceUrl"
                      : type === "computed"
                        ? "slug"
                        : "title",
      type,
      ...(type === "computed" ? { source: "title" } : {}),
      ...(type === "reference" || type === "reference-multi"
        ? { collectionId: "records" }
        : {})
    }));

    for (const field of coveredFields) {
      const editorDefinition = resolveCollectionFieldEditorDefinition(field);
      const rendererDefinition = resolveCollectionFieldCellDefinition(field);

      expect(typeof editorDefinition.renderEditor).toBe("function");
      expect(typeof rendererDefinition.renderCell).toBe("function");
      expect(editorDefinition.diagnostic).toBeNull();
      expect(rendererDefinition.diagnostic).toBeNull();
    }
  });

  test("returns deterministic diagnostics for unsupported field types", () => {
    const unsupportedField = {
      id: "payload",
      label: "Payload",
      type: "json"
    };

    const editorDefinition = resolveCollectionFieldEditorDefinition(unsupportedField);
    const rendererDefinition = resolveCollectionFieldCellDefinition(unsupportedField);

    expect(editorDefinition.diagnostic).toEqual({
      code: COLLECTION_FIELD_EDITOR_UNSUPPORTED_TYPE,
      fieldId: "payload",
      fieldType: "json",
      message: "Field 'payload' uses unsupported type 'json'. Rendering is blocked."
    });
    expect(rendererDefinition.diagnostic).toEqual({
      code: COLLECTION_FIELD_RENDERER_UNSUPPORTED_TYPE,
      fieldId: "payload",
      fieldType: "json",
      message: "Field 'payload' uses unsupported type 'json'. Rendering is blocked."
    });
  });

  test("computed editor renders deterministic readonly value", () => {
    const field = {
      id: "slug",
      label: "Slug",
      type: "computed",
      source: "title"
    };
    const editorDefinition = resolveCollectionFieldEditorDefinition(field);

    render(
      editorDefinition.renderEditor({
        field,
        formState: {
          title: "Release Candidate"
        },
        controlsDisabled: false,
        onChangeForm: () => {}
      })
    );

    const slugInput = screen.getByLabelText("Slug");
    expect(slugInput).toHaveValue("release-candidate");
    expect(slugInput).toBeDisabled();
  });

  test("computed editor applies configured resolver deterministically", () => {
    const field = {
      id: "headlineCode",
      label: "Headline Code",
      type: "computed",
      source: "title",
      resolver: "uppercase"
    };
    const editorDefinition = resolveCollectionFieldEditorDefinition(field);

    render(
      editorDefinition.renderEditor({
        field,
        formState: {
          title: "Release Candidate"
        },
        controlsDisabled: false,
        onChangeForm: () => {}
      })
    );

    const computedInput = screen.getByLabelText("Headline Code");
    expect(computedInput).toHaveValue("RELEASE CANDIDATE");
    expect(computedInput).toBeDisabled();
  });

  test("computed editor applies titlecase resolver deterministically", () => {
    const field = {
      id: "headlineTitle",
      label: "Headline Title",
      type: "computed",
      source: "title",
      resolver: "titlecase"
    };
    const editorDefinition = resolveCollectionFieldEditorDefinition(field);

    render(
      editorDefinition.renderEditor({
        field,
        formState: {
          title: "digest resolver proof"
        },
        controlsDisabled: false,
        onChangeForm: () => {}
      })
    );

    const computedInput = screen.getByLabelText("Headline Title");
    expect(computedInput).toHaveValue("Digest Resolver Proof");
    expect(computedInput).toBeDisabled();
  });

  test("url renderer produces deterministic link output", () => {
    const field = {
      id: "sourceUrl",
      label: "Source URL",
      type: "url"
    };
    const rendererDefinition = resolveCollectionFieldCellDefinition(field);
    const rendered = rendererDefinition.renderCell({
      field,
      item: {
        id: "dig-001",
        sourceUrl: "https://digests.example.test/digest-resolver-proof"
      }
    });

    render(<>{rendered}</>);
    const link = screen.getByRole("link", { name: "https://digests.example.test/digest-resolver-proof" });
    expect(link).toHaveAttribute("href", "https://digests.example.test/digest-resolver-proof");
  });

  test("date editor resolves through type plugin metadata with shrinked date input label", () => {
    const field = {
      id: "publishedOn",
      label: "Published On",
      type: "date"
    };
    const editorDefinition = resolveCollectionFieldEditorDefinition(field);

    render(
      editorDefinition.renderEditor({
        field,
        formState: {
          publishedOn: "2026-02-18"
        },
        controlsDisabled: false,
        onChangeForm: () => {}
      })
    );

    const input = screen.getByLabelText("Published On");
    expect(input).toHaveAttribute("type", "date");
    const label = document.querySelector("label[for='publishedOn-form-input']");
    expect(label).toBeTruthy();
    expect(label).toHaveClass("MuiInputLabel-shrink");
  });

  test("date cell renderer uses plugin date-text variant without unsupported diagnostics", () => {
    const field = {
      id: "publishedOn",
      label: "Published On",
      type: "date"
    };
    const rendererDefinition = resolveCollectionFieldCellDefinition(field);
    const rendered = rendererDefinition.renderCell({
      field,
      item: {
        id: "dig-001",
        publishedOn: "2026-02-18"
      }
    });

    render(<>{rendered}</>);
    expect(rendererDefinition.diagnostic).toBeNull();
    expect(screen.getByText("2026-02-18")).toBeInTheDocument();
  });

  test("reference renderers resolve kebab-case derived title keys deterministically", () => {
    const referenceField = {
      id: "owner-id",
      label: "Owner",
      type: "reference"
    };
    const referenceRenderer = resolveCollectionFieldCellDefinition(referenceField);
    const referenceRendered = referenceRenderer.renderCell({
      field: referenceField,
      item: {
        id: "wid-001",
        "owner-id": "usr-001",
        "owner-title": "Alice Doe"
      }
    });
    render(<>{referenceRendered}</>);
    expect(screen.getByText("Alice Doe")).toBeInTheDocument();

    const multiField = {
      id: "collaborator-ids",
      label: "Collaborators",
      type: "reference-multi"
    };
    const multiRenderer = resolveCollectionFieldCellDefinition(multiField);
    const multiRendered = multiRenderer.renderCell({
      field: multiField,
      item: {
        id: "wid-001",
        "collaborator-ids": ["usr-001", "usr-002"],
        "collaborator-titles": ["Alice Doe", "Bob Roe"]
      }
    });
    render(<>{multiRendered}</>);
    expect(screen.getByText("Bob Roe")).toBeInTheDocument();
  });

  test("reference editors prefer labelField when rendering option labels", async () => {
    const field = {
      id: "recordId",
      label: "Record",
      type: "reference",
      collectionId: "records",
      labelField: "displayName"
    };
    const editorDefinition = resolveCollectionFieldEditorDefinition(field);

    render(
      editorDefinition.renderEditor({
        field,
        formState: {
          recordId: ""
        },
        controlsDisabled: false,
        onChangeForm: () => {},
        referenceOptionsState: {
          records: {
            loading: false,
            items: [
              {
                id: "rec-001",
                title: "Launch Checklist",
                displayName: "Record #1"
              }
            ]
          }
        }
      })
    );

    fireEvent.mouseDown(screen.getByLabelText("Record"));
    expect(await screen.findByRole("option", { name: "Record #1" })).toBeInTheDocument();
  });

  test("returns deterministic diagnostics for unsupported computed resolvers", () => {
    const field = {
      id: "slug",
      label: "Slug",
      type: "computed",
      source: "title",
      resolver: "reverse"
    };

    const editorDefinition = resolveCollectionFieldEditorDefinition(field);
    const rendererDefinition = resolveCollectionFieldCellDefinition(field);

    expect(editorDefinition.diagnostic).toEqual({
      code: COLLECTION_FIELD_EDITOR_COMPUTED_RESOLVER_UNSUPPORTED,
      fieldId: "slug",
      resolver: "reverse",
      sourceKey: "resolver",
      message:
        "Field 'slug' uses unsupported computed resolver 'reverse'. Fallback resolver 'slugify' is active."
    });
    expect(rendererDefinition.diagnostic).toEqual({
      code: COLLECTION_FIELD_RENDERER_COMPUTED_RESOLVER_UNSUPPORTED,
      fieldId: "slug",
      resolver: "reverse",
      sourceKey: "resolver",
      message:
        "Field 'slug' uses unsupported computed resolver 'reverse'. Fallback resolver 'slugify' is active."
    });
  });
});


