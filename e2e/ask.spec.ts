import { test, expect, chatAnswer } from "./fixtures";

const nav = (page: import("@playwright/test").Page) => page.getByRole("navigation", { name: "Main" });

test("the answer is still there after visiting the Library and coming back", async ({ page }) => {
  await page.goto("/chat");
  await page.getByLabel("Question").fill("How warm does basil like it?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByRole("region", { name: "Answer" })).toContainText("between 20 and 30 degrees");

  await nav(page).getByRole("link", { name: "Library" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
  await nav(page).getByRole("link", { name: "Ask" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Answer" })).toContainText("between 20 and 30 degrees");
  await expect(page.getByLabel("Question")).toHaveValue("How warm does basil like it?");
});

test("an answer that arrives after leaving Ask is there on return", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/chat", async (route) => {
    await gate;
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(chatAnswer) });
  });

  await page.goto("/chat");
  await page.getByLabel("Question").fill("Slow question");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText("Waiting for the answer...")).toBeVisible();

  await nav(page).getByRole("link", { name: "Library" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Library" })).toBeVisible();
  const chatResponse = page.waitForResponse((r) => r.url().endsWith("/api/chat"));
  release();
  await chatResponse;
  await nav(page).getByRole("link", { name: "Ask" }).click();

  await expect(page.getByRole("region", { name: "Answer" })).toContainText("between 20 and 30 degrees");
  await expect(page.getByText("Waiting for the answer...")).toHaveCount(0);
});
