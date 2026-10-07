import { describe, expect, it } from "vitest";
import { formatReset } from "./format";

describe("formatReset", () => {
  it.each([
    [1, "less than a minute"],
    [59, "less than a minute"],
    [60, "about 1 minute"],
    [600, "about 10 minutes"],
    [3570, "about 1 hour"],
    [3600, "about 1 hour"],
    [5400, "about 2 hours"],
    [10800, "about 3 hours"],
  ])("%i s -> %s", (seconds, text) => {
    expect(formatReset(seconds)).toBe(text);
  });
});
