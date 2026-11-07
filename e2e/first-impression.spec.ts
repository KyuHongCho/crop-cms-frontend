import { test, expect } from "./fixtures";

const TAGLINE = "Ask about growing crops. Answers mostly from journal articles and FAO data.";

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

  test.describe("on a 1280x720 desktop", () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test("/login: the logo's icon and wordmark are 4px apart", async ({ page }) => {
      await page.goto("/login");
      const gap = await page.getByText("Crop CMS").locator("xpath=..").evaluate((el) => getComputedStyle(el).columnGap);
      expect(gap).toBe("4px");
    });

    for (const path of ["/login", "/signup"]) {
      test(`${path}: the tagline stays within the card's width and 12px clear of the logo`, async ({ page }) => {
        await page.goto(path);
        const tagline = page.getByText(TAGLINE);
        await expect(tagline).toBeVisible();
        const card = (await page.locator('[data-slot="card"]').boundingBox())!;
        const t = (await tagline.boundingBox())!;
        expect(t.x).toBeGreaterThanOrEqual(card.x);
        expect(t.x + t.width).toBeLessThanOrEqual(card.x + card.width);
        const logo = (await page.getByText("Crop CMS").boundingBox())!;
        expect(t.y - (logo.y + logo.height)).toBeGreaterThanOrEqual(12);
      });
    }
  });

  test.describe("on a 375x667 phone", () => {
    test.use({ viewport: { width: 375, height: 667 } });

    test("the login page has nothing clipped", async ({ page }) => {
      await page.goto("/login");
      const tagline = page.getByText(TAGLINE);
      const hint = page.getByText("Demo login? Use the provided credentials.");
      await expect(tagline).toBeVisible();
      await expect(hint).toBeVisible();

      const overflow = await page.evaluate(() => {
        const card = document.querySelector('[data-slot="card"]')!;
        return {
          pageX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          pageY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
          cardX: card.scrollWidth - card.clientWidth,
          cardY: card.scrollHeight - card.clientHeight,
        };
      });
      expect(overflow).toEqual({ pageX: 0, pageY: 0, cardX: 0, cardY: 0 });

      const card = (await page.locator('[data-slot="card"]').boundingBox())!;
      const taglineBox = (await tagline.boundingBox())!;
      expect(taglineBox.y + taglineBox.height).toBeLessThanOrEqual(card.y);

      const visible = [tagline, hint, page.getByLabel("Email"), page.getByLabel("Password"), page.getByRole("button", { name: "Log in" }), page.getByRole("link", { name: "Sign up" })];
      for (const el of visible) {
        const box = (await el.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375);
        expect(box.y + box.height).toBeLessThanOrEqual(667);
      }
    });

    test("the sign-up page has the same tagline above its card and nothing clipped", async ({ page }) => {
      await page.goto("/signup");
      const tagline = page.getByText(TAGLINE);
      await expect(tagline).toBeVisible();

      const overflow = await page.evaluate(() => {
        const card = document.querySelector('[data-slot="card"]')!;
        return {
          pageX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          cardX: card.scrollWidth - card.clientWidth,
          cardY: card.scrollHeight - card.clientHeight,
        };
      });
      expect(overflow).toEqual({ pageX: 0, cardX: 0, cardY: 0 });

      const card = (await page.locator('[data-slot="card"]').boundingBox())!;
      const taglineBox = (await tagline.boundingBox())!;
      expect(taglineBox.y + taglineBox.height).toBeLessThanOrEqual(card.y);

      for (const el of [tagline, page.getByLabel("Email"), page.getByLabel("Invite code"), page.getByRole("button", { name: "Sign up" }), page.getByRole("link", { name: "Log in" })]) {
        const box = (await el.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(375);
        expect(box.y + box.height).toBeLessThanOrEqual(667);
      }
    });
  });
});

test.describe("index.html as served", () => {
  test.use({ signedIn: false });

  test("describes the app and asks not to be indexed", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", TAGLINE);
    await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", TAGLINE);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  });

  test("/robots.txt is a real file that blocks nothing", async ({ page }) => {
    const response = await page.request.get("/robots.txt");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/plain");
    expect((await response.text()).trim().split("\n")).toEqual(["User-agent: *", "Disallow:"]);
  });
});
