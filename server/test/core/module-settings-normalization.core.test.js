import { describe, expect, test } from "vitest";
import {
  createDefaultModuleSettings,
  mergeModuleSettingsPatch,
  validateModuleSettingsPatch
} from "../../src/domains/reference/runtime-kernel/module-settings.js";
import { normalizeSettingsDefinition } from "../../src/domains/reference/runtime-kernel/module-settings/schema-normalization.js";

describe("module settings normalization contract", () => {
  test("normalizes url settings fields and default alias deterministically", () => {
    const result = normalizeSettingsDefinition({
      id: "remotes",
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "controlPlaneUrl",
            label: "Control Plane URL",
            type: "url",
            required: false,
            default: "  https://control.example.invalid/deploy  "
          }
        ]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value?.fields).toEqual([
      expect.objectContaining({
        id: "controlPlaneUrl",
        type: "url",
        defaultValue: "https://control.example.invalid/deploy"
      })
    ]);
  });

  test("rejects conflicting module settings default aliases deterministically", () => {
    const result = normalizeSettingsDefinition({
      id: "remotes",
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "controlPlaneUrl",
            type: "url",
            default: "https://control.example.invalid/deploy",
            defaultValue: "https://control-other.example.invalid/deploy"
          }
        ]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual(
      expect.objectContaining({
        code: "MODULE_SETTINGS_SCHEMA_INVALID",
        field: "settings.fields.0.defaultValue"
      })
    );
  });

  test("rejects invalid url settings defaults deterministically", () => {
    const result = normalizeSettingsDefinition({
      id: "remotes",
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "controlPlaneUrl",
            type: "url",
            defaultValue: "ftp://control.example.invalid/deploy"
          }
        ]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual(
      expect.objectContaining({
        code: "MODULE_SETTINGS_SCHEMA_INVALID",
        fieldId: "controlPlaneUrl"
      })
    );
    expect(result.error.message).toContain("valid http(s) URL");
  });

  test("validates url settings patch values with deterministic normalization", () => {
    const definition = {
      moduleId: "remotes",
      fields: [
        {
          id: "controlPlaneUrl",
          type: "url",
          required: false,
          defaultValue: "https://control.example.invalid/deploy"
        }
      ]
    };

    const valid = validateModuleSettingsPatch(definition, {
      controlPlaneUrl: "  https://ops.example.invalid/control  "
    });
    expect(valid.ok).toBe(true);
    expect(valid.value).toEqual({
      controlPlaneUrl: "https://ops.example.invalid/control"
    });

    const invalid = validateModuleSettingsPatch(definition, {
      controlPlaneUrl: "ftp://ops.example.invalid/control"
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MODULE_SETTINGS_FIELD_INVALID",
          fieldId: "controlPlaneUrl"
        })
      ])
    );
  });

  test("normalizes date settings fields and default alias deterministically", () => {
    const result = normalizeSettingsDefinition({
      id: "remotes",
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "lastAuditOn",
            label: "Last Audit On",
            type: "date",
            required: false,
            default: " 2026-02-01 "
          }
        ]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value?.fields).toEqual([
      expect.objectContaining({
        id: "lastAuditOn",
        type: "date",
        defaultValue: "2026-02-01"
      })
    ]);
  });

  test("rejects invalid date settings defaults deterministically", () => {
    const result = normalizeSettingsDefinition({
      id: "remotes",
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "lastAuditOn",
            type: "date",
            defaultValue: "2026-02-30"
          }
        ]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error).toEqual(
      expect.objectContaining({
        code: "MODULE_SETTINGS_SCHEMA_INVALID",
        fieldId: "lastAuditOn"
      })
    );
    expect(result.error.message).toContain("YYYY-MM-DD");
  });

  test("validates date settings patch values with deterministic normalization", () => {
    const definition = {
      moduleId: "remotes",
      fields: [
        {
          id: "lastAuditOn",
          type: "date",
          required: false,
          defaultValue: "2026-02-01"
        }
      ]
    };

    const valid = validateModuleSettingsPatch(definition, {
      lastAuditOn: " 2026-03-14 "
    });
    expect(valid.ok).toBe(true);
    expect(valid.value).toEqual({
      lastAuditOn: "2026-03-14"
    });

    const clearOptional = validateModuleSettingsPatch(definition, {
      lastAuditOn: "   "
    });
    expect(clearOptional.ok).toBe(true);
    expect(clearOptional.value).toEqual({
      lastAuditOn: null
    });

    const invalid = validateModuleSettingsPatch(definition, {
      lastAuditOn: "2026-02-30"
    });
    expect(invalid.ok).toBe(false);
    expect(invalid.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MODULE_SETTINGS_FIELD_INVALID",
          fieldId: "lastAuditOn"
        })
      ])
    );
  });

  test("normalizes enum-multi settings fields deterministically", () => {
    const result = normalizeSettingsDefinition({
      id: "dispatches",
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "publishChannels",
            label: "Publish Channels",
            type: "enum-multi",
            required: true,
            options: [
              { value: "web", label: "Web" },
              { value: "email", label: "Email" }
            ],
            defaultValue: ["web", "email", "web"]
          }
        ]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value).toEqual(
      expect.objectContaining({
        fields: [
          {
            id: "publishChannels",
            label: "Publish Channels",
            type: "enum-multi",
            required: true,
            options: [
              { value: "web", label: "Web" },
              { value: "email", label: "Email" }
            ],
            defaultValue: ["web", "email"],
            sensitive: false,
            description: ""
          }
        ]
      })
    );
  });

  test("validates enum-multi patch values and deduplicates deterministic writes", () => {
    const definition = {
      moduleId: "dispatches",
      fields: [
        {
          id: "publishChannels",
          type: "enum-multi",
          required: true,
          options: [
            { value: "web", label: "Web" },
            { value: "email", label: "Email" }
          ],
          defaultValue: ["web"]
        }
      ]
    };

    const validation = validateModuleSettingsPatch(definition, {
      publishChannels: ["web", "email", "web"]
    });

    expect(validation.ok).toBe(true);
    expect(validation.value).toEqual({
      publishChannels: ["web", "email"]
    });
  });

  test("rejects enum-multi patch when required field is emptied", () => {
    const definition = {
      moduleId: "dispatches",
      fields: [
        {
          id: "publishChannels",
          type: "enum-multi",
          required: true,
          options: [
            { value: "web", label: "Web" },
            { value: "email", label: "Email" }
          ],
          defaultValue: ["web"]
        }
      ]
    };

    const validation = validateModuleSettingsPatch(definition, {
      publishChannels: []
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "MODULE_SETTINGS_FIELD_REQUIRED",
          fieldId: "publishChannels"
        })
      ])
    );
  });

  test("defaults required enum-multi fields to first option when default is omitted", () => {
    const schema = normalizeSettingsDefinition({
      id: "dispatches",
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "publishChannels",
            type: "enum-multi",
            required: true,
            options: ["web", "email"]
          }
        ]
      }
    });

    expect(schema.ok).toBe(true);
    const definition = schema.value;
    const defaults = createDefaultModuleSettings(definition);
    expect(defaults.publishChannels).toEqual(["web"]);

    const merged = mergeModuleSettingsPatch(definition, {}, {});
    expect(merged.ok).toBe(true);
    expect(merged.value.publishChannels).toEqual(["web"]);
  });
});

