import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { scaffoldModule } from "../../scripts/module-scaffold.mjs";
import { createTempModulesDir } from "../helpers/module-scaffolder-runtime-test-helpers.js";
import {
  createEphemeralReferenceServer,
  injectJson
} from "./helpers/reference-slice-runtime-test-helpers.js";

function registerModuleScaffolderContractOnboardingSlaProofSuite() {
  test("onboards a realistic module profile with plugin-backed fields, route actions, and settings-bound compute", async () => {
    const targetDir = await createTempModulesDir();
    const result = await scaffoldModule({
      profile: {
        moduleId: "ops-briefs",
        routeSegment: "ops-briefs",
        navigationTitle: "Ops Briefs",
        routeView: {
          kind: "custom",
          entrypoint: "./frontend/view-entrypoint.jsx",
          capabilities: {
            usesCollectionsDomain: true
          },
          quickActions: ["open-remotes", "open-missions"],
          actions: [
            {
              id: "open-review-queue",
              label: "Open review queue",
              type: "navigate",
              route: {
                moduleId: "ops-briefs",
                state: {
                  status: "review",
                  collectionId: "briefs"
                }
              }
            },
            {
              id: "reset-brief-filters",
              label: "Reset brief filters",
              type: "module:filters",
              commandId: "reset-filters",
              payload: {
                status: "",
                collectionId: "briefs"
              }
            },
            {
              id: "ops-briefs-runbook",
              label: "Ops briefs runbook",
              type: "external",
              href: "https://ops.example.invalid/briefs-runbook",
              target: "blank"
            }
          ]
        },
        collections: [
          {
            id: "briefs",
            label: "Briefs",
            primaryField: "headline",
            fields: [
              {
                id: "headline",
                label: "Headline",
                type: "text",
                required: true,
                minLength: 3,
                maxLength: 160
              },
              {
                id: "sourceUrl",
                label: "Source URL",
                type: "url",
                required: false,
                minLength: 0,
                maxLength: 2048
              },
              {
                id: "publishedOn",
                label: "Published On",
                type: "date",
                required: false
              },
              {
                id: "headlineSlug",
                label: "Headline Slug",
                type: "computed",
                source: "headline",
                resolver: "slugify",
                settings: {
                  maxLength: "slugMaxLength"
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
      },
      targetDir
    });

    expect(result.ok).toBe(true);
    expect(
      result.files.some((filePath) =>
        filePath.endsWith(path.join("frontend", "view-entrypoint.jsx"))
      )
    ).toBe(true);

    const moduleDir = path.resolve(targetDir, "ops-briefs");
    const manifest = JSON.parse(
      await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
    );
    const entrypoint = await fs.readFile(
      path.resolve(moduleDir, "frontend", "view-entrypoint.jsx"),
      "utf8"
    );

    expect(manifest.settings).toEqual(
      expect.objectContaining({
        contractVersion: 1,
        fields: [
          expect.objectContaining({
            id: "slugMaxLength",
            type: "number",
            defaultValue: 64
          })
        ]
      })
    );
    expect(manifest.ui?.routeView).toEqual(
      expect.objectContaining({
        kind: "custom",
        entrypoint: "./frontend/view-entrypoint.jsx",
        quickActions: ["open-remotes", "open-missions"],
        actions: [
          expect.objectContaining({
            id: "open-review-queue",
            type: "navigate"
          }),
          expect.objectContaining({
            id: "reset-brief-filters",
            type: "module:filters",
            commandId: "reset-filters"
          }),
          expect.objectContaining({
            id: "ops-briefs-runbook",
            type: "external"
          })
        ]
      })
    );

    const fields = manifest.collections?.[0]?.fields ?? [];
    expect(fields.find((field) => field.id === "sourceUrl")).toEqual(
      expect.objectContaining({
        type: "url",
        minLength: 0,
        maxLength: 2048
      })
    );
    expect(fields.find((field) => field.id === "publishedOn")).toEqual(
      expect.objectContaining({
        type: "date"
      })
    );
    expect(fields.find((field) => field.id === "headlineSlug")).toEqual(
      expect.objectContaining({
        type: "computed",
        source: "headline",
        resolver: "slugify",
        settings: {
          maxLength: "slugMaxLength"
        }
      })
    );

    expect(entrypoint).toContain("createCollectionsRouteViewDescriptor");
    expect(entrypoint).toContain('moduleId: "ops-briefs"');
    expect(entrypoint).toContain("function runAction({ action } = {})");
    expect(entrypoint).toContain('"type":"module:filters"');
  });

  test("scaffolded onboarding module boots in runtime and serves API CRUD + settings flows", async () => {
    const targetDir = await createTempModulesDir();
    const sourceRecordsModuleDir = path.resolve(
      process.cwd(),
      "test",
      "fixtures",
      "generated-runtime-support",
      "records"
    );
    const sourceCapabilityKernelModuleDir = path.resolve(
      process.cwd(),
      "test",
      "fixtures",
      "generated-runtime-support",
      "capability-kernel"
    );
    await fs.cp(sourceRecordsModuleDir, path.resolve(targetDir, "records"), {
      recursive: true
    });
    await fs.cp(sourceCapabilityKernelModuleDir, path.resolve(targetDir, "capability-kernel"), {
      recursive: true
    });

    const scaffoldResult = await scaffoldModule({
      profile: {
        moduleId: "ops-briefs",
        routeSegment: "ops-briefs",
        navigationTitle: "Ops Briefs",
        routeView: {
          kind: "custom",
          entrypoint: "./frontend/view-entrypoint.jsx",
          capabilities: {
            usesCollectionsDomain: true
          },
          quickActions: ["open-remotes", "open-missions"],
          actions: [
            {
              id: "open-review-queue",
              label: "Open review queue",
              type: "navigate",
              route: {
                moduleId: "ops-briefs",
                state: {
                  status: "review",
                  collectionId: "briefs"
                }
              }
            },
            {
              id: "reset-brief-filters",
              label: "Reset brief filters",
              type: "module:filters",
              commandId: "reset-filters",
              payload: {
                status: "",
                collectionId: "briefs"
              }
            },
            {
              id: "ops-briefs-runbook",
              label: "Ops briefs runbook",
              type: "external",
              href: "https://ops.example.invalid/briefs-runbook",
              target: "blank"
            }
          ]
        },
        collections: [
          {
            id: "briefs",
            label: "Briefs",
            primaryField: "headline",
            fields: [
              {
                id: "headline",
                label: "Headline",
                type: "text",
                required: true,
                minLength: 3,
                maxLength: 160
              },
              {
                id: "sourceUrl",
                label: "Source URL",
                type: "url",
                required: false,
                minLength: 0,
                maxLength: 2048
              },
              {
                id: "publishedOn",
                label: "Published On",
                type: "date",
                required: false
              },
              {
                id: "headlineSlug",
                label: "Headline Slug",
                type: "computed",
                source: "headline",
                resolver: "slugify",
                settings: {
                  maxLength: "slugMaxLength"
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
      },
      targetDir
    });

    expect(scaffoldResult.ok).toBe(true);

    const ephemeral = await createEphemeralReferenceServer({
      modulesDir: targetDir,
      moduleRuntimeStateFile: path.resolve(targetDir, "module-runtime-state.json")
    });

    try {
      const runtimeResponse = await injectJson(
        ephemeral,
        "GET",
        "/api/reference/modules/runtime"
      );
      expect(runtimeResponse.statusCode).toBe(200);
      expect(runtimeResponse.body.runtime.ok).toBe(true);
      expect(runtimeResponse.body.runtime.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "ops-briefs",
            collectionIds: expect.arrayContaining(["briefs"])
          })
        ])
      );

      const moduleSettingsRead = await injectJson(
        ephemeral,
        "GET",
        "/api/reference/settings/modules/ops-briefs"
      );
      expect(moduleSettingsRead.statusCode).toBe(200);
      expect(moduleSettingsRead.body.ok).toBe(true);
      expect(moduleSettingsRead.body.settings.values.slugMaxLength).toBe(64);

      const moduleSettingsUpdate = await injectJson(
        ephemeral,
        "PUT",
        "/api/reference/settings/modules/ops-briefs",
        {
          slugMaxLength: 24
        }
      );
      expect(moduleSettingsUpdate.statusCode).toBe(200);
      expect(moduleSettingsUpdate.body.ok).toBe(true);
      expect(moduleSettingsUpdate.body.settings.values.slugMaxLength).toBe(24);

      const createResponse = await injectJson(
        ephemeral,
        "POST",
        "/api/reference/collections/briefs/items",
        {
          headline: "Operational Readiness Bulletin",
          sourceUrl: "https://ops.example.invalid/briefs/readiness",
          publishedOn: "2026-02-18"
        }
      );
      expect(createResponse.statusCode).toBe(201);
      expect(createResponse.body.ok).toBe(true);
      expect(createResponse.body.item).toEqual(
        expect.objectContaining({
          headline: "Operational Readiness Bulletin",
          sourceUrl: "https://ops.example.invalid/briefs/readiness",
          publishedOn: "2026-02-18",
          headlineSlug: "operational-readiness-bu"
        })
      );

      const listResponse = await injectJson(
        ephemeral,
        "GET",
        "/api/reference/collections/briefs/items"
      );
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.body.ok).toBe(true);
      expect(listResponse.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            headline: "Operational Readiness Bulletin",
            headlineSlug: "operational-readiness-bu"
          })
        ])
      );
    } finally {
      await ephemeral.close();
      await fs.rm(targetDir, {
        recursive: true,
        force: true
      });
    }
  });
}

registerModuleScaffolderContractOnboardingSlaProofSuite();

export { registerModuleScaffolderContractOnboardingSlaProofSuite };
