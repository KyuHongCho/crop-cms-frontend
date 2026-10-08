import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SourceCard, { safeHttpUrl } from "./SourceCard";

describe("safeHttpUrl", () => {
  it.each([
    ["javascript:alert(1)", null],
    ["data:text/html,<b>x</b>", null],
    ["/relative/path", null],
    ["not a url", null],
    ["", null],
    ["http://example.org/a", "http://example.org/a"],
    ["https://example.org/a?b=1", "https://example.org/a?b=1"],
  ])("%s", (raw, expected) => {
    expect(safeHttpUrl(raw)).toBe(expected);
  });
});

const base = { id: 1, topic: "t", title: "T", body: "b", source: "S", reference: "R", url: "https://example.org", read_directly: true };

describe("SourceCard focus target", () => {
  it("is focusable by script only when it has a citation key", () => {
    render(
      <ul>
        <SourceCard doc={{ ...base, key: "S1" }} />
        <SourceCard doc={{ ...base, title: "Plain" }} />
      </ul>,
    );
    const keyed = screen.getByRole("heading", { name: /S1/ }).closest("li")!;
    const plain = screen.getByRole("heading", { name: "Plain" }).closest("li")!;
    expect(keyed).toHaveAttribute("tabindex", "-1");
    expect(keyed.className).toContain("focus:ring-3");
    expect(plain).not.toHaveAttribute("tabindex");
    expect(plain.className).not.toContain("focus:ring");
  });
});
