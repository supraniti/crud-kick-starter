import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { scaffoldModule } from "../../scripts/module-scaffold.mjs";
import { createTempModulesDir } from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerScaffolderProfileValidationObjectFormSuite() {
test("accepts object-form settings and runtime service profiles with deterministic artifacts", async () => {
  const targetDir = await createTempModulesDir();
  const result = await scaffoldModule({
    profile: {
      moduleId: "briefs",
      routeSegment: "briefs",
      navigationTitle: "Briefs",
      collections: [
        {
          id: "briefs",
          label: "Briefs"
        }
      ],
      includeSettings: {
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
            description: "Controls editorial validation strictness."
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
            description: "Default channels for publishing briefs."
          },
          {
            id: "maxItems",
            label: "Max Items",
            type: "number",
            required: true,
            min: 1,
            max: 500,
            defaultValue: 100,
            description: "Maximum number of brief records per sync."
          },
          {
            id: "controlPlaneUrl",
            label: "Control Plane URL",
            type: "url",
            required: false,
            default: "  https://control.example.invalid/deploy  ",
            description: "Optional orchestration control plane endpoint."
          },
          {
            id: "lastAuditOn",
            label: "Last Audit On",
            type: "date",
            required: false,
            defaultValue: " 2026-02-01 ",
            description: "Optional last successful brief publication audit date."
          }
        ]
      },
      includeRuntimeServices: {
        services: [
          {
            id: "briefs-sync-service",
            label: "Briefs Sync Service",
            description: "Coordinates brief synchronization workflows."
          },
          {
            id: "briefs-index-service",
            label: "Briefs Index Service",
            description: "Refreshes brief search indexes."
          }
        ]
      }
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  expect(result.files).toHaveLength(4);

  const moduleDir = path.resolve(targetDir, "briefs");
  const manifest = JSON.parse(await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8"));
  const runtimeServices = await fs.readFile(
    path.resolve(moduleDir, "server", "runtime-services.mjs"),
    "utf8"
  );

  expect(manifest.settings).toEqual({
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
        description: "Controls editorial validation strictness.",
        sensitive: false
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
        description: "Default channels for publishing briefs.",
        sensitive: false
      },
      {
        id: "maxItems",
        label: "Max Items",
        type: "number",
        required: true,
        min: 1,
        max: 500,
        defaultValue: 100,
        description: "Maximum number of brief records per sync.",
        sensitive: false
      },
      {
        id: "controlPlaneUrl",
        label: "Control Plane URL",
        type: "url",
        required: false,
        defaultValue: "https://control.example.invalid/deploy",
        description: "Optional orchestration control plane endpoint.",
        sensitive: false
      },
      {
        id: "lastAuditOn",
        label: "Last Audit On",
        type: "date",
        required: false,
        defaultValue: "2026-02-01",
        description: "Optional last successful brief publication audit date.",
        sensitive: false
      }
    ]
  });
  expect(runtimeServices).toContain('serviceId: "briefs-sync-service"');
  expect(runtimeServices).toContain('serviceId: "briefs-index-service"');
});

test("rejects invalid object-form includeSettings profile deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "briefs",
        routeSegment: "briefs",
        navigationTitle: "Briefs",
        collections: [
          {
            id: "briefs",
            label: "Briefs"
          }
        ],
        includeSettings: {
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
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      expect.stringContaining("defaultValue 'strict' is not in enum options")
    ])
  });
});

test("rejects invalid enum-multi object-form includeSettings profile deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "briefs",
        routeSegment: "briefs",
        navigationTitle: "Briefs",
        collections: [
          {
            id: "briefs",
            label: "Briefs"
          }
        ],
        includeSettings: {
          fields: [
            {
              id: "publishChannels",
              label: "Publish Channels",
              type: "enum-multi",
              required: true,
              options: [
                { value: "web", label: "Web" }
              ],
              defaultValue: ["email"]
            }
          ]
        }
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      expect.stringContaining("defaultValue 'email' is not in enum options")
    ])
  });
});

test("rejects invalid url object-form includeSettings profile deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "briefs",
        routeSegment: "briefs",
        navigationTitle: "Briefs",
        collections: [
          {
            id: "briefs",
            label: "Briefs"
          }
        ],
        includeSettings: {
          fields: [
            {
              id: "controlPlaneUrl",
              label: "Control Plane URL",
              type: "url",
              defaultValue: "ftp://control.example.invalid/deploy"
            }
          ]
        }
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      expect.stringContaining("defaultValue must be a valid http(s) URL")
    ])
  });
});

test("rejects invalid date object-form includeSettings profile deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "briefs",
        routeSegment: "briefs",
        navigationTitle: "Briefs",
        collections: [
          {
            id: "briefs",
            label: "Briefs"
          }
        ],
        includeSettings: {
          fields: [
            {
              id: "lastAuditOn",
              label: "Last Audit On",
              type: "date",
              defaultValue: "2026-02-30"
            }
          ]
        }
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      expect.stringContaining("defaultValue must match YYYY-MM-DD")
    ])
  });
});

test("rejects invalid object-form includeRuntimeServices profile deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "briefs",
        routeSegment: "briefs",
        navigationTitle: "Briefs",
        collections: [
          {
            id: "briefs",
            label: "Briefs"
          }
        ],
        includeRuntimeServices: {
          services: [
            {
              id: "BriefsService",
              label: ""
            }
          ]
        }
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.includeRuntimeServices.services[0].id must match kebab-case pattern",
      "profile.includeRuntimeServices.services[0].label is required"
    ])
  });
});

}

export { registerScaffolderProfileValidationObjectFormSuite };
