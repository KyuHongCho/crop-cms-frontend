import { test, expect } from "./fixtures";

const routes = [
  { path: "/chat", heading: "Ask" },
  { path: "/library", heading: "Library" },
  { path: "/library/basil", heading: "Basil" },
  { path: "/library/basil/temperature", heading: "temperature" },
];

for (const { path, heading } of routes) {
  test(`${path} renders one main landmark`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator("#root > *").first()).toBeAttached();
    await expect(page.locator("main")).toHaveCount(1);
  });

  test(`${path} renders when window.scrollTo returns a Promise`, async ({ page }) => {
    // Chromium's scrollTo returns a Promise; this makes every browser do it, so the check is not
    // left to whichever engine happens to.
    await page.addInitScript(() => {
      const scrollTo = window.scrollTo.bind(window) as (...args: unknown[]) => void;
      window.scrollTo = ((...args: unknown[]) => {
        scrollTo(...args);
        return Promise.resolve();
      }) as typeof window.scrollTo;
    });
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.locator("#root > *").first()).toBeAttached();
    await expect(page.locator("main")).toHaveCount(1);
  });
}
