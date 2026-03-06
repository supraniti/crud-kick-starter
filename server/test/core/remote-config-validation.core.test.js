import { describe, expect, test } from "vitest";
import {
  getRemoteConfigValidationAdapterMetadata,
  validateRemoteConfigInput
} from "../../src/domains/reference/contracts/remote-config/local-contract/remote-config-contract.mjs";
import { VALIDATION_ENGINE_ID } from "../../src/domains/reference/contracts/remote-config/local-contract/validation-engine-adapter.mjs";

describe("remote config validation contract", () => {
  test("publishes explicit validation adapter metadata for full and partial modes", () => {
    const fullMetadata = getRemoteConfigValidationAdapterMetadata();
    expect(fullMetadata).toEqual({
      engineId: VALIDATION_ENGINE_ID,
      schemaId: "remote-config-input-v1",
      fieldIds: ["label", "kind", "endpoint", "enabled"]
    });

    const partialMetadata = getRemoteConfigValidationAdapterMetadata({
      partial: true
    });
    expect(partialMetadata).toEqual({
      engineId: VALIDATION_ENGINE_ID,
      schemaId: "remote-config-input-partial-v1",
      fieldIds: ["label", "kind", "endpoint", "enabled"]
    });
  });

  test("normalizes valid full input and rejects unknown fields deterministically", () => {
    expect(
      validateRemoteConfigInput({
        label: "  QA Mirror  ",
        kind: "HTTP",
        endpoint: "  https://qa.example.invalid/deploy  ",
        enabled: true
      })
    ).toEqual({
      ok: true,
      value: {
        label: "QA Mirror",
        kind: "http",
        endpoint: "https://qa.example.invalid/deploy",
        enabled: true
      }
    });

    expect(
      validateRemoteConfigInput({
        label: "  QA Mirror  ",
        kind: "HTTP",
        endpoint: "  https://qa.example.invalid/deploy  ",
        enabled: true,
        ignored: "value"
      })
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "REMOTE_FIELD_UNKNOWN",
          message: "Remote field 'ignored' is not supported",
          fieldId: "ignored"
        }
      ]
    });
  });

  test("keeps deterministic required/invalid error codes for full input", () => {
    expect(
      validateRemoteConfigInput({
        label: "",
        kind: "filesystem",
        endpoint: "file://x",
        enabled: true
      })
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "REMOTE_LABEL_REQUIRED",
          message: "Remote label is required",
          fieldId: "label"
        }
      ]
    });

    expect(
      validateRemoteConfigInput({
        label: "QA Mirror",
        kind: "ftp",
        endpoint: "file://x",
        enabled: true
      })
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "REMOTE_KIND_INVALID",
          message: "Remote kind must be one of: filesystem, http, sftp",
          fieldId: "kind"
        }
      ]
    });

    expect(
      validateRemoteConfigInput({
        label: "QA Mirror",
        kind: "filesystem",
        endpoint: "   ",
        enabled: true
      })
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "REMOTE_ENDPOINT_REQUIRED",
          message: "Remote endpoint is required",
          fieldId: "endpoint"
        }
      ]
    });

    expect(
      validateRemoteConfigInput({
        label: "QA Mirror",
        kind: "filesystem",
        endpoint: "file://x",
        enabled: "yes"
      })
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "REMOTE_ENABLED_INVALID",
          message: "Remote enabled value must be boolean",
          fieldId: "enabled"
        }
      ]
    });
  });

  test("supports partial mode with deterministic defaults and validation", () => {
    expect(
      validateRemoteConfigInput(
        {
          kind: "  SFTP  "
        },
        { partial: true }
      )
    ).toEqual({
      ok: true,
      value: {
        label: "",
        kind: "sftp",
        endpoint: "",
        enabled: false
      }
    });

    expect(
      validateRemoteConfigInput(
        {
          enabled: "yes"
        },
        { partial: true }
      )
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "REMOTE_ENABLED_INVALID",
          message: "Remote enabled value must be boolean",
          fieldId: "enabled"
        }
      ]
    });

    expect(
      validateRemoteConfigInput(
        {
          kind: "sftp",
          unknown: "ignored"
        },
        { partial: true }
      )
    ).toEqual({
      ok: false,
      errors: [
        {
          code: "REMOTE_FIELD_UNKNOWN",
          message: "Remote field 'unknown' is not supported",
          fieldId: "unknown"
        }
      ]
    });
  });
});
