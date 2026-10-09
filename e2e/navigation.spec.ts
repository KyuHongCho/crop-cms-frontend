import { test, expect } from "./fixtures";

test.describe("signed out", () => {
  test.use({ signedIn: false });

  test("/chat redirects to /login", async ({ page }) => {
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("#root > *").first()).toBeAttached();
  });
});

test("clicking the tabs changes the heading and aria-current", async ({ page }) => {
  await page.goto("/chat");
  const nav = page.getByRole("navigation", { name: "Main" });
  const ask = nav.getByRole("link", { name: "Ask" });
  const library = nav.getByRole("link", { name: "Library" });
  await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
  await expect(ask).toHaveAttribute("aria-current", "page");
  await expect(library).not.toHaveAttribute("aria-current");

  await library.click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
  await expect(library).toHaveAttribute("aria-current", "page");
  await expect(ask).not.toHaveAttribute("aria-current");

  await ask.click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
  await expect(ask).toHaveAttribute("aria-current", "page");
  await expect(library).not.toHaveAttribute("aria-current");
});

test("the Library tab returns to the topic left behind, and the active tab goes home", async ({ page }) => {
  await page.goto("/library/basil/temperature");
  const nav = page.getByRole("navigation", { name: "Main" });
  const ask = nav.getByRole("link", { name: "Ask" });
  const library = nav.getByRole("link", { name: "Library" });
  await expect(page.getByRole("heading", { level: 1, name: "temperature" })).toBeVisible();
  await expect(library).toHaveAttribute("aria-current", "page");

  await ask.click();
  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();

  await library.click();
  await expect(page).toHaveURL(/\/library\/basil\/temperature$/);
  await expect(page.getByRole("heading", { level: 1, name: "temperature" })).toBeVisible();
  await expect(library).toHaveAttribute("aria-current", "page");

  await library.click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
});
