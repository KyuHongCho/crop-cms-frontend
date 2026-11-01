import { test, expect } from "./fixtures";

test.describe("signed out", () => {
  test.use({
    signedIn: false,
    mocks: { "POST /api/members/login": { body: { access_token: "e2e-token", token_type: "bearer" } } },
  });

  async function logIn(page: import("@playwright/test").Page) {
    await page.getByLabel("Email").fill("demo@example.com");
    await page.getByLabel("Password").fill("not-a-real-password");
    await page.getByRole("button", { name: "Log in" }).click();
  }

  test("a deep link to a topic survives login", async ({ page }) => {
    await page.goto("/library/basil/temperature");
    await expect(page).toHaveURL(/\/login$/);
    await logIn(page);
    await expect(page).toHaveURL(/\/library\/basil\/temperature$/);
    await expect(page.getByRole("heading", { level: 1, name: "temperature" })).toBeVisible();
  });

  test("a visit straight to the login page lands on Ask", async ({ page }) => {
    await page.goto("/login");
    await logIn(page);
    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
  });

  test.describe("on a 375x667 phone", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("the login page has nothing clipped", async ({ page }) => {
      await page.goto("/login");
      const description = page.getByText("Ask crop-growing questions and read answers");
      const hint = page.getByText("Trying the demo?");
      await expect(description).toBeVisible();
      await expect(hint).toBeVisible();

      const overflow = await page.evaluate(() => {
        const card = document.querySelector('[data-slot="card"]')!;
        return {
          pageX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          cardX: card.scrollWidth - card.clientWidth,
          cardY: card.scrollHeight - card.clientHeight,
        };
      });
      expect(overflow).toEqual({ pageX: 0, cardX: 0, cardY: 0 });

      const visible = [description, hint, page.getByLabel("Email"), page.getByLabel("Password"), page.getByRole("button", { name: "Log in" }), page.getByRole("link", { name: "Sign up" })];
      for (const el of visible) {
        const box = (await el.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375);
      }
    });
  });
});

test.describe("index.html as served", () => {
  test.use({ signedIn: false });

  test("describes the app and asks not to be indexed", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      "Ask crop-growing questions and read answers with the source documents alongside them.",
    );
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  });

  test("/robots.txt is a real file that blocks nothing", async ({ page }) => {
    const response = await page.request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect((await response.text()).trim().split("\n")).toEqual(["User-agent: *", "Disallow:"]);
  });
});
