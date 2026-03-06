import { expect, test } from "@playwright/test";

const MODULE_IDS = Object.freeze({
  crudCore: "test-modules-crud-core",
  relationsTaxonomy: "test-modules-relations-taxonomy",
  remotesPublish: "test-modules-remotes-publish"
});

async function signInLocally(page) {
  await page.goto("/");
  await expect(page.getByRole("button", { name: /sign in \(local\)/i })).toBeVisible();
  await page.getByRole("button", { name: /sign in \(local\)/i }).click();
  await expect(page).toHaveURL(new RegExp(`/app/${MODULE_IDS.crudCore}$`));
  await expect(
    page.getByRole("heading", { level: 5, name: "Test Modules CRUD Core" })
  ).toBeVisible();
}

test.describe("browser smoke lane", () => {
  test("shell/auth and workspace load flow", async ({ page }) => {
    await signInLocally(page);
    await expect(page.getByText("Collection contract")).toBeVisible();

    await page.locator(`button[data-module-id='${MODULE_IDS.relationsTaxonomy}']`).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/${MODULE_IDS.relationsTaxonomy}$`));
    await expect(
      page.getByRole("heading", { level: 5, name: "Test Modules Relations Taxonomy" })
    ).toBeVisible();

    await page.locator(`button[data-module-id='${MODULE_IDS.crudCore}']`).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/${MODULE_IDS.crudCore}$`));
    await expect(
      page.getByRole("heading", { level: 5, name: "Test Modules CRUD Core" })
    ).toBeVisible();
  });

  test("module CRUD workflow through active route (records collection)", async ({ page }) => {
    const recordTitle = `QA Smoke Record ${Date.now()}`;
    await signInLocally(page);

    await page.getByLabel("Collection").click();
    await page.getByRole("option", { name: "Records" }).click();
    await expect(page.getByText("Collection: Records")).toBeVisible();

    await page.getByLabel("Title", { exact: true }).fill(recordTitle);
    await page.getByLabel("Score").fill("77");
    await page.getByRole("button", { name: "Create record" }).click();

    await expect(page.getByText("Record created")).toBeVisible();
    const row = page.locator("tr", { hasText: recordTitle });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Record deleted")).toBeVisible();
    await expect(row).toHaveCount(0);
  });

  test("module settings workflow persists deterministic values", async ({ page }) => {
    await signInLocally(page);
    await page.locator(`button[data-module-id='${MODULE_IDS.remotesPublish}']`).first().click();

    await expect(page).toHaveURL(new RegExp(`/app/${MODULE_IDS.remotesPublish}$`));
    await expect(
      page.getByRole("heading", { level: 5, name: "Test Modules Remotes Publish" })
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Module Settings" })).toBeVisible();

    const controlPlaneUrl = `https://qa-smoke-${Date.now()}.example.invalid/deploy`;
    await page.getByLabel("Control Plane URL", { exact: true }).fill(controlPlaneUrl);
    const saveResponsePromise = page.waitForResponse((response) => {
      return (
        response.request().method() === "PUT" &&
        response
          .url()
          .includes(`/api/reference/settings/modules/${MODULE_IDS.remotesPublish}`)
      );
    });
    await page.getByRole("button", { name: "Save settings" }).click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBeTruthy();

    await page.reload();
    await expect(page).toHaveURL(new RegExp(`/app/${MODULE_IDS.remotesPublish}$`));
    await expect(page.getByRole("heading", { name: "Module Settings" })).toBeVisible();
    await expect(page.getByLabel("Control Plane URL", { exact: true })).toHaveValue(controlPlaneUrl);
  });
});
