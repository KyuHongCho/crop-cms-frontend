import { isValidElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { citeText } from "./citeText";

const keys = new Set(["S1", "S2"]);

function flat(nodes: ReactNode[]): string {
  return nodes.map((n) => (isValidElement<{ children: string }>(n) ? n.props.children : String(n))).join("");
}
const links = (nodes: ReactNode[]) =>
  nodes.filter(isValidElement<{ href: string; children: string }>).map((n) => [n.props.children, n.props.href]);

describe("citeText", () => {
  it.each([
    ["Water when dry [S1].", [["S1", "#source-S1"]]],
    ["Both [S1, S2] agree.", [["S1", "#source-S1"], ["S2", "#source-S2"]]],
    ["Unknown [S9] stays text.", []],
    ["Mixed [S2, S9].", [["S2", "#source-S2"]]],
    ["See [see S1].", [["S1", "#source-S1"]]],
    ["Bare S1 outside brackets.", []],
    ["No markers at all.", []],
    ["", []],
    ["Unclosed [S1 text", []],
    ["Twice [S1] and [S1].", [["S1", "#source-S1"], ["S1", "#source-S1"]]],
  ])("%j links only known keys inside brackets", (text, expected) => {
    const out = citeText(text, keys);
    expect(links(out)).toEqual(expected);
    expect(flat(out)).toBe(text);
  });

  it("returns one plain string when nothing links, so the text stays a single node", () => {
    expect(citeText("<b>x</b> [S9]", keys)).toEqual(["<b>x</b> [S9]"]);
  });

  it("keeps brackets and commas as plain text around the links", () => {
    const out = citeText("[S1, S2]", keys);
    expect(out.filter((n) => typeof n === "string")).toEqual(["[", ", ", "]"]);
  });

  it("does not parse HTML in the text", () => {
    const text = "<img src=x onerror=alert(1)> [S1]";
    expect(flat(citeText(text, keys))).toBe(text);
  });
});
