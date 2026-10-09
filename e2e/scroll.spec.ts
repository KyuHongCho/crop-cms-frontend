import type { Page } from "@playwright/test";
import { test, expect, longChatAnswer, tallTopicSet } from "./fixtures";

const TOPIC = "/library/basil/temperature";
const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const scrollY = (page: Page) => page.evaluate(() => Math.round(window.scrollY));
const expectScrollY = (page: Page, y: number) => expect.poll(() => scrollY(page), { timeout: 5000 }).toBe(y);

async function tab(page: Page, name: "Ask" | "Library") {
  await nav(page).getByRole("link", { name }).click();
}

async function scrollTo(page: Page, y: number) {
  await page.evaluate((to) => window.scrollTo(0, to), y);
  await expectScrollY(page, y);
}

test.describe("with a tall topic", () => {
  test.use({ mocks: { "GET /api/retrieval/basil/temperature": { body: tallTopicSet } } });

  test.beforeEach(async ({ page }) => {
    // Data that arrives after the page appears: a restore that runs too early finds a short skeleton.
    await page.route(
      (url) => url.pathname === "/api/retrieval/basil/temperature",
      async (route) => {
        await new Promise((r) => setTimeout(r, 400));
        await route.fallback();
      },
    );
  });

  async function openTopic(page: Page) {
    await page.goto(TOPIC);
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
  }

  test("the app turns the browser's own scroll restoration off", async ({ page }) => {
    await openTopic(page);
    expect(await page.evaluate(() => history.scrollRestoration)).toBe("manual");
  });

  test("Back restores the scroll position once the topic has loaded", async ({ page }) => {
    await openTopic(page);
    await scrollTo(page, 400);
    await tab(page, "Ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
    await expectScrollY(page, 0);

    await page.goBack();
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
    await expectScrollY(page, 400);
  });

  test("Back and Forward each restore the position of their own history entry", async ({ page }) => {
    await openTopic(page);
    await scrollTo(page, 400);
    await tab(page, "Ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
    await tab(page, "Library");
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
    await expectScrollY(page, 400);
    await scrollTo(page, 250);

    await page.goBack();
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
    await expectScrollY(page, 400);

    await page.goForward();
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
    await expectScrollY(page, 250);
  });

  test("focusing a sticky bar link does not scroll the page", async ({ page }) => {
    await openTopic(page);
    await scrollTo(page, 400);
    await nav(page).getByRole("link", { name: "Ask" }).focus();
    await expect(nav(page).getByRole("link", { name: "Ask" })).toBeFocused();
    await expectScrollY(page, 400);
  });

  test("tabbing through the sticky bar does not scroll the page", async ({ page, browserName }) => {
    // Safari's default: Tab skips links, Option-Tab reaches them.
    const next = browserName === "webkit" ? "Alt+Tab" : "Tab";
    await openTopic(page);
    await scrollTo(page, 400);
    for (const name of ["Crop CMS", "Ask", "Library"]) {
      await page.keyboard.press(next);
      await expect(page.getByRole("link", { name })).toBeFocused();
      await expectScrollY(page, 400);
    }
  });

  test("a reload restores the position", async ({ page }) => {
    await openTopic(page);
    await scrollTo(page, 400);
    await page.reload();
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
    await expectScrollY(page, 400);
  });

  test("a tab return restores the position, and the active tab goes home at the top", async ({ page }) => {
    await openTopic(page);
    await scrollTo(page, 400);
    await tab(page, "Ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();

    await tab(page, "Library");
    await expect(page).toHaveURL(new RegExp(`${TOPIC}$`));
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
    await expectScrollY(page, 400);

    await tab(page, "Library");
    await expect(page).toHaveURL(/\/library$/);
    await expectScrollY(page, 0);
  });

  test("a link to a fresh page opens at the top", async ({ page }) => {
    await page.goto("/library/basil");
    await page.getByRole("link", { name: /temperature/ }).click();
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
    await expectScrollY(page, 0);
  });
});

test.describe("with a long retained answer", () => {
  test.use({ mocks: { "POST /api/chat": { body: longChatAnswer } } });

  test("Back to Ask restores the scroll position of the retained answer", async ({ page }) => {
    await page.goto("/chat");
    await page.getByLabel("Question").fill("How warm does basil like it?");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByRole("region", { name: "Answer" })).toContainText("Paragraph 40");
    await scrollTo(page, 400);

    await tab(page, "Library");
    await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
    await expectScrollY(page, 0);

    await page.goBack();
    await expect(page.getByRole("region", { name: "Answer" })).toContainText("Paragraph 40");
    await expectScrollY(page, 400);
  });

  test("the Ask tab returns to the retained answer at its position", async ({ page }) => {
    await page.goto("/chat");
    await page.getByLabel("Question").fill("How warm does basil like it?");
    await page.getByRole("button", { name: "Ask" }).click();
    await expect(page.getByRole("region", { name: "Answer" })).toContainText("Paragraph 40");
    await scrollTo(page, 400);

    await tab(page, "Library");
    await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
    await tab(page, "Ask");
    await expect(page.getByRole("region", { name: "Answer" })).toContainText("Paragraph 40");
    await expectScrollY(page, 400);
  });
});
