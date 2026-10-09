// Regenerates docs/images/*.png from the running app with the e2e mocks (no backend, no keys).
// Run: npx playwright test -c scripts/capture/playwright.config.ts
import { test, expect } from "../../e2e/fixtures";

for (const theme of ["light", "dark"] as const) {
  test.describe(theme, () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("crop-cms-theme", t), theme);
    });

    test("ask", async ({ page }) => {
      await page.goto("/chat");
      await page.getByLabel("Question").fill("How warm does basil like it?");
      await page.getByRole("button", { name: "Ask" }).click();
      await expect(page.getByRole("region", { name: "Answer" })).toContainText("between 20 and 30 degrees");
      await page.screenshot({ path: `docs/images/ask-${theme}.png` });
    });

    test("library topic", async ({ page }) => {
      await page.goto("/library/basil/temperature");
      await expect(page.getByRole("heading", { level: 1, name: "temperature" })).toBeVisible();
      await expect(page.getByText("Temperature response of basil")).toBeVisible();
      await page.screenshot({ path: `docs/images/library-${theme}.png` });
    });
  });
}
