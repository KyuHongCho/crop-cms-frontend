import type { Page } from "@playwright/test";
import { test, expect, longChatAnswer, tallTopicSet } from "./fixtures";

test.use({ mocks: { "GET /api/retrieval/basil/temperature": { body: tallTopicSet }, "POST /api/chat": { body: longChatAnswer } } });

const barBottom = (page: Page) => page.locator("header").evaluate((h) => Math.round(h.getBoundingClientRect().bottom));
// Safari's default: Tab skips links, Option-Tab reaches them.
const previous = (browserName: string) => (browserName === "webkit" ? "Alt+Shift+Tab" : "Shift+Tab");

for (const at of [20, -8]) {
  test(`a link the user tabs back to is not left under the sticky bar (top=${at})`, async ({ page, browserName }) => {
    await page.goto("/library/basil/temperature");
    await expect(page.getByRole("list", { name: "Documents" })).toBeVisible();
    const link = page.locator('li a[href^="http"]').nth(5);
    await page.getByRole("button", { name: "Show text" }).nth(5).focus();
    await page.evaluate((to) => {
      const l = document.querySelectorAll('li a[href^="http"]')[5] as HTMLElement;
      window.scrollTo(0, window.scrollY + l.getBoundingClientRect().top - to);
    }, at);
    await page.keyboard.press(previous(browserName));
    await expect(link).toBeFocused();
    await expect.poll(async () => (await link.boundingBox())!.y).toBeGreaterThanOrEqual(await barBottom(page));
  });

  test(`the question box the user tabs back to is not left under the sticky bar (top=${at})`, async ({ page, browserName }) => {
    await page.goto("/chat");
    await page.getByRole("textbox").fill("How warm should basil be?");
    await page.getByRole("button", { name: "Ask", exact: true }).click();
    await expect(page.getByText("Paragraph 40.")).toBeVisible();
    await page.getByRole("button", { name: "Ask", exact: true }).focus();
    await page.evaluate((to) => {
      const t = document.querySelector("textarea") as HTMLElement;
      window.scrollTo(0, window.scrollY + t.getBoundingClientRect().top - to);
    }, at);
    await page.keyboard.press(previous(browserName));
    await expect(page.getByRole("textbox")).toBeFocused();
    await expect.poll(async () => (await page.getByRole("textbox").boundingBox())!.y).toBeGreaterThanOrEqual(await barBottom(page));
  });
}
