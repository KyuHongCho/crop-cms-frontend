import type { Page } from "@playwright/test";
import { test, expect, chatAnswer } from "./fixtures";

const WAITING = "Waiting for the answer...";
const STILL_WORKING = "Still working on your answer. This can take a while.";

const nav = (page: Page) => page.getByRole("navigation", { name: "Main" });
const status = (page: Page) => page.getByRole("status");

// The browser's clock is paused after load, so only runFor moves it and no real time leaks into the 8 s.
async function holdChat(page: Page) {
  await page.clock.install({ time: new Date("2026-11-03T10:00:00Z") });
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/chat", async (route) => {
    await gate;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(chatAnswer) });
  });
  await page.goto("/chat");
  await page.clock.pauseAt(new Date("2026-11-03T10:01:00Z"));
  return release;
}

async function ask(page: Page, question = "Slow question") {
  await page.getByLabel("Question").fill(question);
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(status(page)).toHaveText(WAITING);
}

async function toAsk(page: Page) {
  await nav(page).getByRole("link", { name: "Ask" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
}

async function toLibrary(page: Page) {
  await nav(page).getByRole("link", { name: "Library" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
}

test("the status text changes once at 8 seconds and not before", async ({ page }) => {
  await holdChat(page);
  await ask(page);

  await page.clock.runFor(7999);
  await expect(status(page)).toHaveText(WAITING);
  await page.clock.runFor(1);
  await expect(status(page)).toHaveText(STILL_WORKING);

  await page.clock.runFor(60_000);
  await expect(status(page)).toHaveText(STILL_WORKING);
});

test("the answer replaces the longer text", async ({ page }) => {
  const release = await holdChat(page);
  await ask(page);
  await page.clock.runFor(8000);
  await expect(status(page)).toHaveText(STILL_WORKING);

  release();
  await expect(page.getByRole("region", { name: "Answer" })).toContainText("between 20 and 30 degrees");
  await expect(status(page)).toHaveText("Answer ready.");
  await expect(page.getByText(STILL_WORKING)).toHaveCount(0);
});

test("a new question starts the 8 seconds again", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-11-03T10:00:00Z") });
  const releases: Array<() => void> = [];
  await page.route("**/api/chat", async (route) => {
    await new Promise<void>((r) => releases.push(r));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(chatAnswer) });
  });
  await page.goto("/chat");
  await page.clock.pauseAt(new Date("2026-11-03T10:01:00Z"));

  await ask(page, "First question");
  await page.clock.runFor(8000);
  await expect(status(page)).toHaveText(STILL_WORKING);
  await expect.poll(() => releases.length).toBe(1);
  releases[0]();
  await expect(status(page)).toHaveText("Answer ready.");

  await ask(page, "Second question");
  await page.clock.runFor(7999);
  await expect(status(page)).toHaveText(WAITING);
  await page.clock.runFor(1);
  await expect(status(page)).toHaveText(STILL_WORKING);
});

test("leaving Ask and coming back does not restart the 8 seconds", async ({ page }) => {
  await holdChat(page);
  await ask(page);
  await page.clock.runFor(5000);

  await toLibrary(page);
  await page.clock.runFor(2000);
  await toAsk(page);
  await expect(status(page)).toHaveText(WAITING);

  await page.clock.runFor(999);
  await expect(status(page)).toHaveText(WAITING);
  await page.clock.runFor(1);
  await expect(status(page)).toHaveText(STILL_WORKING);
});

test("coming back after more than 8 seconds away shows the longer text at once", async ({ page }) => {
  await holdChat(page);
  await ask(page);
  await toLibrary(page);
  await page.clock.runFor(9000);
  await toAsk(page);
  await expect(status(page)).toHaveText(STILL_WORKING);
});

const textLines = (page: Page) =>
  status(page)
    .locator("p")
    .evaluate((p) => {
      const range = document.createRange();
      range.selectNodeContents(p);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });

async function expectNothingMoves(page: Page, { scrolls, lines }: { scrolls: boolean; lines: number }) {
  await holdChat(page);
  await ask(page);

  const block = status(page);
  const node = await block.elementHandle();
  let y = 0;
  if (scrolls) {
    // Without a scrollable page a scroll check proves nothing.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    y = await page.evaluate(() => Math.round(window.scrollY));
    expect(y).toBeGreaterThan(0);
  }
  // Focused after the scroll and without scrolling: WebKit moves a page that is focused first.
  await page.getByLabel("Question").evaluate((el) => el.focus({ preventScroll: true }));

  const before = (await block.boundingBox())!;
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.clock.runFor(8000);
  await expect(block).toHaveText(STILL_WORKING);
  // A width where the text stays on one line would not exercise the reserved height.
  expect(await textLines(page)).toBe(lines);
  const after = (await block.boundingBox())!;

  expect(after.height).toBe(before.height);
  expect(after.y).toBe(before.y);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(pageHeight);
  expect(await node!.evaluate((el, now) => el === now, await block.elementHandle())).toBe(true);
  await expect(status(page)).toHaveCount(1);
  await expect(page.getByLabel("Question")).toBeFocused();
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(y);
}

test.describe("at 375x667", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("the change moves nothing: same element, same height, same focus, same scroll", async ({ page }) => {
    await expectNothingMoves(page, { scrolls: false, lines: 1 });
  });
});

// Measured: the longer text wraps to two lines up to a 346px viewport in both browsers. Below 336px the
// top bar's account button already overflows sideways, which would add a scrollbar mid-test.
test.describe("at 340x360, where the longer text wraps and the page scrolls", () => {
  test.use({ viewport: { width: 340, height: 360 } });

  test("the change moves nothing: same element, same height, same focus, same scroll", async ({ page }) => {
    await expectNothingMoves(page, { scrolls: true, lines: 2 });
  });
});
