import { test as base, expect } from "@playwright/test";
import type { components } from "../src/api/schema";

type Schemas = components["schemas"];

export const member: Schemas["MemberResponse"] = {
  id: 1,
  email: "demo@example.com",
  display_name: null,
  tokens_used_today: 0,
  tokens_budget_daily: 20000,
  budget_window_start: "2026-10-09",
  role: "member",
};

export const crops: Schemas["CropResponse"][] = [
  { id: 1, slug: "basil", common_name: "Basil", scientific_name: "Ocimum basilicum", ecocrop_id: 1547 },
];

const document: Schemas["RetrievedDocument"] = {
  id: 1,
  topic: "temperature",
  title: "Temperature response of basil",
  body: "Basil grows best between 20 and 30 degrees Celsius.",
  source: "FAO",
  reference: "FAO-1",
  url: "https://example.com/basil-temperature",
  read_directly: true,
};

export const items: Schemas["ItemResponse"][] = [
  { ...document, sub_category_id: 1, crop_id: 1, published: true },
];

export const topicSet: Schemas["TopicSetResponse"] = {
  crop_slug: "basil",
  topic: "temperature",
  document_count: 1,
  documents: [document],
  context_chars: 52,
  context_char_budget: 100000,
  chars_per_token: 4,
  dropped: [],
};

export const chatAnswer: Schemas["ChatResponse"] = {
  answer: "Basil grows best between 20 and 30 degrees Celsius [S1].",
  documents: [{ ...document, key: "S1", crop_slug: "basil" }],
  topics_used: ["temperature"],
  topics_used_crops: ["basil"],
  dropped: [],
  truncated: false,
};

// Tall enough to scroll in a 720px viewport, whatever the browser.
export const tallTopicSet: Schemas["TopicSetResponse"] = {
  ...topicSet,
  document_count: 30,
  documents: Array.from({ length: 30 }, (_, i) => ({
    ...document,
    id: i + 1,
    title: `Temperature note ${i + 1}`,
    body: `Note ${i + 1}. ${"Basil grows best between 20 and 30 degrees Celsius. ".repeat(6)}`,
    reference: `FAO-${i + 1}`,
  })),
};

export const longChatAnswer: Schemas["ChatResponse"] = {
  ...chatAnswer,
  answer: Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1}. Basil grows best between 20 and 30 degrees Celsius [S1].`).join("\n\n"),
};

type Mock = { status?: number; body: unknown };
export type Mocks = Record<string, Mock | (() => Mock)>;

const defaultMocks: Mocks = {
  "GET /api/members/me": { body: member },
  "GET /api/crops": { body: crops },
  "GET /api/items": { body: items },
  "GET /api/retrieval/basil/temperature": { body: topicSet },
  "POST /api/chat": { body: chatAnswer },
};

type Options = { signedIn: boolean; mocks: Mocks };

export const test = base.extend<Options & { harness: void }>({
  signedIn: [true, { option: true }],
  mocks: [{}, { option: true }],
  harness: [
    async ({ page, signedIn, mocks }, run) => {
      const errors: string[] = [];
      const unmocked: string[] = [];
      const table = { ...defaultMocks, ...mocks };
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
      });
      // A predicate, not "**/api/**": that glob also matches Vite's /src/api/*.ts modules.
      await page.route(
        (url) => url.pathname.startsWith("/api/"),
        (route) => {
          const request = route.request();
          const key = `${request.method()} ${new URL(request.url()).pathname}`;
          const mock = table[key];
          if (!mock) {
            unmocked.push(key);
            return route.fulfill({ status: 599, body: "unmocked in e2e" });
          }
          const { status = 200, body } = typeof mock === "function" ? mock() : mock;
          return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        },
      );
      if (signedIn) await page.addInitScript(() => sessionStorage.setItem("crop-cms.token", "e2e-token"));
      await run();
      expect(unmocked, "requests to /api with no mock").toEqual([]);
      expect(errors, "uncaught errors or console.error output in the page").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
