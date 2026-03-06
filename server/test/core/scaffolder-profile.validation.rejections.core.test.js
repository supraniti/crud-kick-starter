import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { scaffoldModule } from "../../scripts/module-scaffold.mjs";
import { createTempModulesDir } from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerScaffolderProfileValidationRejectionsSuite() {
test("rejects invalid profile primaryField ownership deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatches",
        routeSegment: "dispatches",
        navigationTitle: "Dispatches",
        collections: [
          {
            id: "dispatches",
            label: "Dispatches",
            primaryField: "status",
            fields: [
              {
                id: "status",
                label: "Status",
                type: "enum",
                required: true,
                options: ["queued", "active"]
              }
            ]
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.collections[0].primaryField 'status' must reference a text field"
    ])
  });
});

test("rejects conflicting explicit field descriptors and primitive options deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatches",
        routeSegment: "dispatches",
        navigationTitle: "Dispatches",
        collections: [
          {
            id: "dispatches",
            label: "Dispatches",
            fields: [
              {
                id: "title",
                label: "Title",
                type: "text",
                required: true
              }
            ],
            includeComputedSlug: true
          }
        ],
        includeSettings: true,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_UNSUPPORTED_OPTION",
    details: expect.arrayContaining([
      "profile.collections[0].fields cannot be combined with legacy primitive options: includeComputedSlug"
    ])
  });
});

test("rejects unsupported computed settings bindings deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "briefs",
        routeSegment: "briefs",
        navigationTitle: "Briefs",
        collections: [
          {
            id: "briefs",
            label: "Briefs",
            extraFields: [
              {
                id: "summarySlug",
                label: "Summary Slug",
                type: "computed",
                source: "title",
                resolver: "slugify",
                settings: {
                  unsupported: "slugMaxLength"
                }
              }
            ]
          }
        ],
        includeSettings: {
          fields: [
            {
              id: "slugMaxLength",
              label: "Slug Max Length",
              type: "number",
              required: true,
              min: 12,
              max: 120,
              defaultValue: 64
            }
          ]
        },
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.collections[0].extraFields[0].settings.unsupported is not supported for resolver 'slugify'"
    ])
  });
});

test("rejects computed settings bindings when includeSettings is disabled", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "briefs",
        routeSegment: "briefs",
        navigationTitle: "Briefs",
        collections: [
          {
            id: "briefs",
            label: "Briefs",
            extraFields: [
              {
                id: "summarySlug",
                label: "Summary Slug",
                type: "computed",
                source: "title",
                resolver: "slugify",
                settings: {
                  maxLength: "slugMaxLength"
                }
              }
            ]
          }
        ],
        includeSettings: false,
        includeRuntimeServices: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.collections[0].fields 'summarySlug' computed settings bindings require profile.includeSettings=true"
    ])
  });
});

test("rejects unknown profile fields deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "editors",
        routeSegment: "editors",
        navigationTitle: "Editors",
        collections: [
          {
            id: "editors",
            label: "Editors",
            unsupportedCollectionField: true
          }
        ],
        unsupportedTopLevelField: true
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_UNKNOWN_FIELD",
    details: expect.arrayContaining([
      "profile.unsupportedTopLevelField",
      "profile.collections[0].unsupportedCollectionField"
    ])
  });
});

test("rejects unknown explicit field descriptor keys deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatches",
        routeSegment: "dispatches",
        navigationTitle: "Dispatches",
        collections: [
          {
            id: "dispatches",
            label: "Dispatches",
            fields: [
              {
                id: "title",
                label: "Title",
                type: "text",
                unsupportedDescriptorKey: true
              }
            ]
          }
        ]
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_UNKNOWN_FIELD",
    details: expect.arrayContaining([
      "profile.collections[0].fields[0].unsupportedDescriptorKey"
    ])
  });
});

test("rejects unknown profile behavior fields deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatches",
        routeSegment: "dispatches",
        navigationTitle: "Dispatches",
        collections: [
          {
            id: "dispatches",
            label: "Dispatches",
            behavior: {
              unsupportedBehaviorField: true
            }
          }
        ]
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_UNKNOWN_FIELD",
    details: expect.arrayContaining([
      "profile.collections[0].behavior.unsupportedBehaviorField"
    ])
  });
});

test("rejects invalid profile behavior values deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatches",
        routeSegment: "dispatches",
        navigationTitle: "Dispatches",
        collections: [
          {
            id: "dispatches",
            label: "Dispatches",
            behavior: {
              enforceTitleUnique: "yes"
            }
          }
        ]
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.collections[0].behavior.enforceTitleUnique must be a boolean when provided"
    ])
  });
});

test("rejects conflicting profile behavior compatibility values deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatches",
        routeSegment: "dispatches",
        navigationTitle: "Dispatches",
        collections: [
          {
            id: "dispatches",
            label: "Dispatches",
            behavior: {
              enforcePrimaryFieldUnique: true,
              enforceTitleUnique: false
            }
          }
        ]
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.collections[0].behavior.enforcePrimaryFieldUnique and profile.collections[0].behavior.enforceTitleUnique must match when both are provided"
    ])
  });
});

test("rejects conflicting profile length compatibility values deterministically", async () => {
  await expect(
    scaffoldModule({
      profile: {
        moduleId: "dispatches",
        routeSegment: "dispatches",
        navigationTitle: "Dispatches",
        collections: [
          {
            id: "dispatches",
            label: "Dispatches",
            primaryFieldMinLength: 5,
            titleMinLength: 3
          }
        ]
      }
    })
  ).rejects.toMatchObject({
    code: "MODULE_SCAFFOLDER_PROFILE_INVALID",
    details: expect.arrayContaining([
      "profile.collections[0].primaryFieldMinLength and profile.collections[0].titleMinLength must match when both are provided"
    ])
  });
});


test("accepts routeSegment overrides and feature flags for settings/services", async () => {
  const targetDir = await createTempModulesDir();
  const result = await scaffoldModule({
    profile: {
      moduleId: "dispatches",
      routeSegment: "dispatch-center",
      navigationTitle: "Dispatches",
      collections: [
        {
          id: "dispatches",
          label: "Dispatches"
        }
      ],
      includeSettings: false,
      includeRuntimeServices: false
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  expect(result.files).toHaveLength(3);

  const moduleDir = path.resolve(targetDir, "dispatches");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );

  expect(manifest.id).toBe("dispatches");
  expect(manifest.capabilities).toEqual(
    expect.arrayContaining(["ui.route", "schema", "crud.collection"])
  );
  expect(manifest.capabilities).not.toContain("settings");
  expect(manifest.capabilities).not.toContain("service");
  expect(manifest.ui?.navigation?.routeSegment).toBe("dispatch-center");
  expect(manifest.settings).toBeUndefined();
  expect(manifest.runtime.services).toBeUndefined();

  const runtimeServicesExists = await fs
    .stat(path.resolve(moduleDir, "server", "runtime-services.mjs"))
    .then(() => true)
    .catch(() => false);
  expect(runtimeServicesExists).toBe(false);
});

}

export { registerScaffolderProfileValidationRejectionsSuite };
