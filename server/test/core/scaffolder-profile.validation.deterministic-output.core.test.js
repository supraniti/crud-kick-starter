import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "vitest";
import { scaffoldModule } from "../../scripts/module-scaffold.mjs";
import { createTempModulesDir } from "../helpers/module-scaffolder-runtime-test-helpers.js";

function registerScaffolderProfileValidationDeterministicOutputSuite() {
test("defaults missing routeSegment to moduleId and omits routeSegment manifest override", async () => {
  const targetDir = await createTempModulesDir();
  const result = await scaffoldModule({
    profile: {
      moduleId: "briefs",
      navigationTitle: "Briefs",
      collections: [
        {
          id: "briefs",
          label: "Briefs"
        }
      ]
    },
    targetDir
  });

  expect(result.ok).toBe(true);

  const moduleDir = path.resolve(targetDir, "briefs");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );

  expect(manifest.id).toBe("briefs");
  expect(manifest.ui?.navigation?.routeSegment).toBeUndefined();
});

test("accepts url field descriptors and titlecase/trim computed transforms in profile collections", async () => {
  const targetDir = await createTempModulesDir();
  const result = await scaffoldModule({
    profile: {
      moduleId: "digests",
      navigationTitle: "Digests",
      collections: [
        {
          id: "digests",
          label: "Digests",
          extraFields: [
            {
              id: "sourceUrl",
              label: "Source URL",
              type: "url",
              required: false,
              minLength: 0,
              maxLength: 2048
            },
            {
              id: "headlineTitle",
              label: "Headline Title",
              type: "computed",
              source: "title",
              transform: "titlecase"
            },
            {
              id: "headlineTrim",
              label: "Headline Trim",
              type: "computed",
              source: "title",
              transform: "trim"
            }
          ]
        }
      ]
    },
    targetDir
  });

  expect(result.ok).toBe(true);

  const moduleDir = path.resolve(targetDir, "digests");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const fields = manifest.collections?.[0]?.fields ?? [];
  const sourceUrlField = fields.find((field) => field.id === "sourceUrl");
  const headlineTitleField = fields.find((field) => field.id === "headlineTitle");
  const headlineTrimField = fields.find((field) => field.id === "headlineTrim");

  expect(sourceUrlField).toEqual({
    id: "sourceUrl",
    label: "Source URL",
    type: "url",
    required: false,
    minLength: 0,
    maxLength: 2048
  });
  expect(headlineTitleField).toEqual({
    id: "headlineTitle",
    label: "Headline Title",
    type: "computed",
    required: false,
    source: "title",
    resolver: "titlecase",
    transform: "titlecase"
  });
  expect(headlineTrimField).toEqual({
    id: "headlineTrim",
    label: "Headline Trim",
    type: "computed",
    required: false,
    source: "title",
    resolver: "trim",
    transform: "trim"
  });
});

test("accepts computed settings bindings and emits deterministic manifest settings payload", async () => {
  const targetDir = await createTempModulesDir();
  const result = await scaffoldModule({
    profile: {
      moduleId: "dispatches",
      navigationTitle: "Dispatches",
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          extraFields: [
            {
              id: "headlineSlug",
              label: "Headline Slug",
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
      }
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  const moduleDir = path.resolve(targetDir, "dispatches");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const headlineSlugField =
    manifest.collections?.[0]?.fields?.find((field) => field.id === "headlineSlug") ?? null;

  expect(headlineSlugField).toEqual(
    expect.objectContaining({
      id: "headlineSlug",
      type: "computed",
      source: "title",
      resolver: "slugify",
      transform: "slugify",
      settings: {
        maxLength: "slugMaxLength"
      }
    })
  );
});

test("accepts kebab-case explicit field descriptors and computed source references", async () => {
  const targetDir = await createTempModulesDir();
  const result = await scaffoldModule({
    profile: {
      moduleId: "dispatches",
      navigationTitle: "Dispatches",
      collections: [
        {
          id: "dispatches",
          label: "Dispatches",
          primaryField: "headline-title",
          fields: [
            {
              id: "headline-title",
              label: "Headline Title",
              type: "text",
              required: true,
              minLength: 3,
              maxLength: 120
            },
            {
              id: "published-on",
              label: "Published On",
              type: "date",
              required: false
            },
            {
              id: "headline-slug",
              label: "Headline Slug",
              type: "computed",
              required: false,
              source: "headline-title",
              resolver: "slugify"
            }
          ]
        }
      ]
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  const moduleDir = path.resolve(targetDir, "dispatches");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const fields = manifest.collections?.[0]?.fields ?? [];

  expect(manifest.collections?.[0]?.primaryField).toBe("headline-title");
  expect(fields.find((field) => field.id === "headline-title")).toEqual(
    expect.objectContaining({
      type: "text",
      required: true
    })
  );
  expect(fields.find((field) => field.id === "headline-slug")).toEqual(
    expect.objectContaining({
      type: "computed",
      source: "headline-title",
      resolver: "slugify",
      transform: "slugify"
    })
  );
});

test("accepts descriptor defaults and normalizes default/defaultValue aliases in profile collections", async () => {
  const targetDir = await createTempModulesDir();
  const result = await scaffoldModule({
    profile: {
      moduleId: "digests",
      navigationTitle: "Digests",
      collections: [
        {
          id: "digests",
          label: "Digests",
          fields: [
            {
              id: "title",
              label: "Title",
              type: "text",
              required: true,
              minLength: 3,
              defaultValue: "  Digest Default Title  "
            },
            {
              id: "status",
              label: "Status",
              type: "enum",
              required: true,
              options: ["draft", "review", "published"],
              default: "Review"
            },
            {
              id: "sourceUrl",
              label: "Source URL",
              type: "url",
              required: false,
              defaultValue: "https://digests.example.test/default"
            }
          ]
        }
      ]
    },
    targetDir
  });

  expect(result.ok).toBe(true);
  const moduleDir = path.resolve(targetDir, "digests");
  const manifest = JSON.parse(
    await fs.readFile(path.resolve(moduleDir, "module.json"), "utf8")
  );
  const fields = manifest.collections?.[0]?.fields ?? [];

  expect(fields.find((field) => field.id === "title")).toEqual(
    expect.objectContaining({
      defaultValue: "Digest Default Title"
    })
  );
  expect(fields.find((field) => field.id === "status")).toEqual(
    expect.objectContaining({
      defaultValue: "review"
    })
  );
  expect(fields.find((field) => field.id === "sourceUrl")).toEqual(
    expect.objectContaining({
      defaultValue: "https://digests.example.test/default"
    })
  );
});
}

export { registerScaffolderProfileValidationDeterministicOutputSuite };
