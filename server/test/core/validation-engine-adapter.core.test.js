import { describe, expect, test } from "vitest";
import {
  VALIDATION_ENGINE_ID,
  createObjectValidationAdapter
} from "../../src/domains/reference/contracts/remote-config/local-contract/validation-engine-adapter.mjs";

describe("validation engine adapter contract", () => {
  test("exposes deterministic metadata and normalized values", () => {
    const adapter = createObjectValidationAdapter({
      schemaId: "pilot-schema",
      objectError: {
        code: "PILOT_OBJECT_INVALID",
        message: "Pilot payload must be an object"
      },
      unknownFieldError: (fieldId) => ({
        code: "PILOT_FIELD_UNKNOWN",
        message: `Field '${fieldId}' is not allowed`,
        fieldId
      }),
      fields: {
        alpha: {
          normalize: (value) => ({
            ok: true,
            value: typeof value === "string" ? value.trim() : ""
          })
        },
        beta: {
          normalize: (value) => ({
            ok: true,
            value: value === true
          })
        }
      }
    });

    expect(adapter.metadata).toEqual({
      engineId: VALIDATION_ENGINE_ID,
      schemaId: "pilot-schema",
      fieldIds: ["alpha", "beta"]
    });

    expect(
      adapter.validate({
        alpha: "  value  ",
        beta: true
      })
    ).toEqual({
      ok: true,
      value: {
        alpha: "value",
        beta: true
      }
    });
  });

  test("rejects non-object input and unknown fields deterministically", () => {
    const adapter = createObjectValidationAdapter({
      schemaId: "pilot-schema",
      objectError: {
        code: "PILOT_OBJECT_INVALID",
        message: "Pilot payload must be an object"
      },
      unknownFieldError: (fieldId) => ({
        code: "PILOT_FIELD_UNKNOWN",
        message: `Field '${fieldId}' is not allowed`,
        fieldId
      }),
      fields: {
        alpha: {
          normalize: (value) => ({
            ok: true,
            value: value ?? ""
          })
        }
      }
    });

    expect(adapter.validate(null)).toEqual({
      ok: false,
      error: {
        code: "PILOT_OBJECT_INVALID",
        message: "Pilot payload must be an object"
      }
    });

    expect(
      adapter.validate({
        unknown: true
      })
    ).toEqual({
      ok: false,
      error: {
        code: "PILOT_FIELD_UNKNOWN",
        message: "Field 'unknown' is not allowed",
        fieldId: "unknown"
      }
    });
  });

  test("normalizes field-level failures and thrown errors deterministically", () => {
    const adapter = createObjectValidationAdapter({
      schemaId: "pilot-schema",
      fields: {
        invalid: {
          normalize: (value) =>
            value === true
              ? {
                  ok: true,
                  value: true
                }
              : {
                  ok: false
                }
        },
        throwing: {
          normalize: () => {
            const error = new Error("explode");
            error.code = "PILOT_THROW";
            throw error;
          }
        }
      }
    });

    expect(
      adapter.validate({
        invalid: false,
        throwing: "x"
      })
    ).toEqual({
      ok: false,
      error: {
        code: "VALIDATION_FIELD_INVALID",
        message: "Validation failed for field 'invalid'",
        fieldId: "invalid"
      }
    });

    expect(
      adapter.validate({
        invalid: true,
        throwing: true
      })
    ).toEqual({
      ok: false,
      error: {
        code: "PILOT_THROW",
        message: "explode",
        fieldId: "throwing"
      }
    });
  });
});
