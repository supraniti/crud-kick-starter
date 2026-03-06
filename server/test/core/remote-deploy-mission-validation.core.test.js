import { describe, expect, test } from "vitest";
import {
  getRemoteDeployPayloadValidationAdapterMetadata,
  listRemoteDeployPayloadFields,
  validateRemoteDeployPayload
} from "../../src/domains/reference/contracts/remote-config/local-contract/remote-deploy-mission-contract.mjs";
import { VALIDATION_ENGINE_ID } from "../../src/domains/reference/contracts/remote-config/local-contract/validation-engine-adapter.mjs";

describe("remote deploy mission validation contract", () => {
  test("publishes explicit validation adapter metadata", () => {
    expect(getRemoteDeployPayloadValidationAdapterMetadata()).toEqual({
      engineId: VALIDATION_ENGINE_ID,
      schemaId: "remote-deploy-mission-payload-v1",
      fieldIds: ["remoteId", "shouldFail"]
    });
  });

  test("publishes deterministic payload metadata fields", () => {
    const fields = listRemoteDeployPayloadFields();
    expect(fields).toEqual([
      expect.objectContaining({
        id: "remoteId",
        type: "text",
        required: false,
        defaultValue: null
      }),
      expect.objectContaining({
        id: "shouldFail",
        type: "boolean",
        required: false,
        defaultValue: false
      })
    ]);

    fields[0].label = "Changed";
    expect(listRemoteDeployPayloadFields()[0].label).toBe("Remote Id");
  });

  test("normalizes valid payloads with deterministic defaults", () => {
    expect(validateRemoteDeployPayload({})).toEqual({
      ok: true,
      payload: {
        remoteId: null,
        shouldFail: false
      }
    });

    expect(
      validateRemoteDeployPayload({
        remoteId: " remote-001 ",
        shouldFail: true
      })
    ).toEqual({
      ok: true,
      payload: {
        remoteId: "remote-001",
        shouldFail: true
      }
    });
  });

  test("rejects unknown payload fields deterministically", () => {
    expect(
      validateRemoteDeployPayload({
        hold: true
      })
    ).toEqual({
      ok: false,
      error: {
        code: "REMOTE_DEPLOY_PAYLOAD_FIELD_UNKNOWN",
        message: "Remote deploy payload field 'hold' is not supported",
        fieldId: "hold"
      }
    });
  });

  test("rejects invalid remoteId and shouldFail types deterministically", () => {
    expect(
      validateRemoteDeployPayload({
        remoteId: 123
      })
    ).toEqual({
      ok: false,
      error: {
        code: "REMOTE_DEPLOY_PAYLOAD_REMOTE_ID_INVALID",
        message: "remoteId must be a string when provided",
        fieldId: "remoteId"
      }
    });

    expect(
      validateRemoteDeployPayload({
        remoteId: "    "
      })
    ).toEqual({
      ok: false,
      error: {
        code: "REMOTE_DEPLOY_PAYLOAD_REMOTE_ID_INVALID",
        message: "remoteId must be non-empty when provided",
        fieldId: "remoteId"
      }
    });

    expect(
      validateRemoteDeployPayload({
        shouldFail: "yes"
      })
    ).toEqual({
      ok: false,
      error: {
        code: "REMOTE_DEPLOY_PAYLOAD_SHOULD_FAIL_INVALID",
        message: "shouldFail must be a boolean",
        fieldId: "shouldFail"
      }
    });
  });
});
