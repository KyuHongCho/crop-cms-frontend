import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");
const doc = new DOMParser().parseFromString(html, "text/html");
const meta = (key: string, value: string) => doc.querySelector(`meta[${key}="${value}"]`)?.getAttribute("content");

const DESCRIPTION = "Ask crop-growing questions and read answers with the source documents alongside them.";

describe("index.html, the page a pasted link or a crawler sees without running the app", () => {
  it("keeps the static title", () => {
    expect(doc.title).toBe("Crop CMS");
  });

  it("describes the app", () => {
    expect(meta("name", "description")).toBe(DESCRIPTION);
  });

  it("carries the Open Graph basics and a summary card, with no image and no fixed address", () => {
    expect(meta("property", "og:title")).toBe("Crop CMS");
    expect(meta("property", "og:description")).toBe(DESCRIPTION);
    expect(meta("property", "og:type")).toBe("website");
    expect(meta("name", "twitter:card")).toBe("summary");
    expect(doc.querySelector('meta[property="og:image"], meta[name="twitter:image"], meta[property="og:url"]')).toBeNull();
  });

  it("asks not to be indexed", () => {
    expect(meta("name", "robots")).toBe("noindex");
  });

  it("says what to do when JavaScript is off", () => {
    expect(doc.querySelector("noscript")?.textContent).toBe("Crop CMS needs JavaScript. Please turn it on and reload.");
  });
});

describe("public/robots.txt", () => {
  it("blocks nothing, so a crawler can read the noindex tag", () => {
    const lines = readFileSync(resolve(process.cwd(), "public/robots.txt"), "utf8").trim().split("\n");
    expect(lines).toEqual(["User-agent: *", "Disallow:"]);
  });
});
