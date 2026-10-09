import { expect, it, vi } from "vitest";

vi.mock("./App", () => ({ default: () => null }));

it("turns the browser's scroll restoration off before rendering", async () => {
  document.body.innerHTML = '<div id="root"></div>';
  history.scrollRestoration = "auto";
  await import("./main");
  expect(history.scrollRestoration).toBe("manual");
});
