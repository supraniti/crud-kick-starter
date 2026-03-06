import { expect, test } from "vitest";
import { validateModuleManifest } from "../../src/core/index.js";
import { validManifest } from "./helpers/manifest-shared-fixtures.js";

function registerManifestDiscoverySchemaRouteViewSettingsSuite() {
  test("accepts optional ui routeView custom entrypoint definition", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "custom",
          entrypoint: "./frontend/custom-view.mjs",
          viewId: "products",
          bannerMessage: "Products custom route view",
          quickActions: ["open-remotes", "open-missions", "open-remotes"],
          actions: [
            {
              id: "open-review-queue",
              label: "Open review queue",
              type: "navigate",
              route: {
                moduleId: "products",
                state: {
                  categoryIds: ["cat-001"]
                }
              }
            },
            {
              id: "products-runbook",
              label: "Products runbook",
              type: "external",
              href: "https://products.example.invalid/runbook",
              target: "blank"
            },
            {
              id: "products-runbook",
              label: "Products runbook duplicate",
              type: "external",
              href: "https://products.example.invalid/runbook-duplicate",
              target: "blank"
            }
          ],
          capabilities: {
            usesCollectionsDomain: false
          }
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value.ui.routeView).toEqual({
      kind: "custom",
      entrypoint: "./frontend/custom-view.mjs",
      viewId: "products",
      bannerMessage: "Products custom route view",
      quickActions: ["open-remotes", "open-missions"],
      actions: [
        {
          id: "open-review-queue",
          label: "Open review queue",
          type: "navigate",
          route: {
            moduleId: "products",
            state: {
              categoryIds: ["cat-001"]
            }
          }
        },
        {
          id: "products-runbook",
          label: "Products runbook",
          type: "external",
          href: "https://products.example.invalid/runbook",
          target: "blank"
        }
      ],
      capabilities: {
        usesCollectionsDomain: false
      }
    });
  });

  test("accepts optional settings schema definition", () => {
    const result = validateModuleManifest({
      ...validManifest,
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "editorialMode",
            label: "Editorial Mode",
            type: "enum",
            required: true,
            options: [
              { value: "standard", label: "Standard" },
              { value: "strict", label: "Strict" }
            ],
            defaultValue: "standard",
            description: "Controls editorial strictness."
          },
          {
            id: "publishChannels",
            label: "Publish Channels",
            type: "enum-multi",
            required: true,
            options: [
              { value: "web", label: "Web" },
              { value: "email", label: "Email" },
              { value: "sms", label: "SMS" }
            ],
            defaultValue: ["web", "email", "web"],
            description: "Default channels for publish workflows."
          },
          {
            id: "controlPlaneUrl",
            label: "Control Plane URL",
            type: "url",
            required: false,
            default: "  https://control.example.invalid/deploy  ",
            description: "Control plane endpoint used for publish orchestration."
          },
          {
            id: "lastAuditOn",
            label: "Last Audit On",
            type: "date",
            required: false,
            defaultValue: "2026-02-01",
            description: "Optional last successful publish audit date."
          }
        ]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value.settings).toEqual({
      contractVersion: 1,
      fields: [
        {
          id: "editorialMode",
          label: "Editorial Mode",
          type: "enum",
          required: true,
          options: [
            { value: "standard", label: "Standard" },
            { value: "strict", label: "Strict" }
          ],
          defaultValue: "standard",
          sensitive: false,
          description: "Controls editorial strictness."
        },
        {
          id: "publishChannels",
          label: "Publish Channels",
          type: "enum-multi",
          required: true,
          options: [
            { value: "web", label: "Web" },
            { value: "email", label: "Email" },
            { value: "sms", label: "SMS" }
          ],
          defaultValue: ["web", "email"],
          sensitive: false,
          description: "Default channels for publish workflows."
        },
        {
          id: "controlPlaneUrl",
          label: "Control Plane URL",
          type: "url",
          required: false,
          defaultValue: "https://control.example.invalid/deploy",
          sensitive: false,
          description: "Control plane endpoint used for publish orchestration."
        },
        {
          id: "lastAuditOn",
          label: "Last Audit On",
          type: "date",
          required: false,
          defaultValue: "2026-02-01",
          sensitive: false,
          description: "Optional last successful publish audit date."
        }
      ]
    });
  });

  test("rejects invalid settings schema definition", () => {
    const result = validateModuleManifest({
      ...validManifest,
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "editorialMode",
            label: "Editorial Mode",
            type: "enum",
            options: [{ value: "standard", label: "Standard" }],
            defaultValue: "strict"
          }
        ]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("settings");
    expect(result.error.message).toContain("defaultValue 'strict' is not in enum options");
  });

  test("rejects invalid enum-multi settings default values deterministically", () => {
    const result = validateModuleManifest({
      ...validManifest,
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
            defaultValue: ["web", "sms"]
          }
        ]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("settings");
    expect(result.error.message).toContain("defaultValue 'sms' is not in enum options");
  });

  test("rejects invalid url settings default values deterministically", () => {
    const result = validateModuleManifest({
      ...validManifest,
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "controlPlaneUrl",
            label: "Control Plane URL",
            type: "url",
            defaultValue: "ftp://control.example.invalid/deploy"
          }
        ]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("settings");
    expect(result.error.message).toContain("valid http(s) URL");
  });

  test("rejects invalid date settings default values deterministically", () => {
    const result = validateModuleManifest({
      ...validManifest,
      settings: {
        contractVersion: 1,
        fields: [
          {
            id: "lastAuditOn",
            label: "Last Audit On",
            type: "date",
            defaultValue: "2026-02-30"
          }
        ]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("MODULE_MANIFEST_INVALID");
    expect(result.error.field).toBe("settings");
    expect(result.error.message).toContain("YYYY-MM-DD");
  });

  test("accepts optional ui routeView built-in kind definition without entrypoint", () => {
    const result = validateModuleManifest({
      ...validManifest,
      ui: {
        routeView: {
          kind: "missions",
          viewId: "mission-console",
          bannerMessage: "Mission route view",
          quickActions: ["open-remotes"],
          actions: [
            {
              id: "mission-runbook",
              label: "Mission runbook",
              type: "external",
              href: "https://missions.example.invalid/runbook",
              target: "blank"
            },
            {
              id: "reset-mission-filters",
              label: "Reset mission filters",
              type: "module:filters",
              commandId: "reset-filters",
              payload: {
                mode: "all"
              }
            }
          ],
          capabilities: {
            usesCollectionsDomain: false
          }
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.value.ui.routeView).toEqual({
      kind: "missions",
      viewId: "mission-console",
      bannerMessage: "Mission route view",
      quickActions: ["open-remotes"],
      actions: [
        {
          id: "mission-runbook",
          label: "Mission runbook",
          type: "external",
          href: "https://missions.example.invalid/runbook",
          target: "blank"
        },
        {
          id: "reset-mission-filters",
          label: "Reset mission filters",
          type: "module:filters",
          commandId: "reset-filters",
          payload: {
            mode: "all"
          }
        }
      ],
      capabilities: {
        usesCollectionsDomain: false
      }
    });
  });

}

export { registerManifestDiscoverySchemaRouteViewSettingsSuite };
