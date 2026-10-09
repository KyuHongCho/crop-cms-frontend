import { describe, expect, it, vi } from "vitest";
import { clearToken, setToken } from "../auth/token";
import { clearNavMemory, remember, rememberedLocation } from "./navMemory";
import { SECTIONS, allows, routable, sectionFor } from "./sections";

const ask = SECTIONS[0];
const library = SECTIONS[1];

describe("sections registry", () => {
  it("lists Ask and Library with their prefix and home", () => {
    expect(SECTIONS.map((s) => [s.id, s.prefix, s.home])).toEqual([
      ["ask", "/chat", "/chat"],
      ["library", "/library", "/library"],
    ]);
  });

  it("finds a section by path prefix, not by exact path", () => {
    expect(sectionFor("/library")).toBe(library);
    expect(sectionFor("/library/basil/temperature")).toBe(library);
    expect(sectionFor("/chat")).toBe(ask);
    expect(sectionFor("/libraryx")).toBeUndefined();
    expect(sectionFor("/login")).toBeUndefined();
  });

  it("matches only paths the router has a route for", () => {
    expect(routable(library, "/library/basil/temperature")).toBe(true);
    expect(routable(library, "/library/a/b/c")).toBe(false);
  });

  it("shows a role-restricted section only to its roles, and open ones before the role is known", () => {
    const admin = { ...ask, roles: ["admin"] as const };
    expect(allows(admin, "admin")).toBe(true);
    expect(allows(admin, "member")).toBe(false);
    expect(allows(admin, undefined)).toBe(false);
    expect(allows(library, undefined)).toBe(true);
  });
});

describe("navigation memory", () => {
  it("starts at the section home", () => {
    expect(rememberedLocation(library)).toBe("/library");
  });

  it("remembers path and query per section", () => {
    remember("/library/basil/temperature", "?x=1");
    remember("/chat", "");
    expect(rememberedLocation(library)).toBe("/library/basil/temperature?x=1");
    expect(rememberedLocation(ask)).toBe("/chat");
    remember("/library/basil", "");
    expect(rememberedLocation(library)).toBe("/library/basil");
  });

  it("ignores paths outside every section", () => {
    remember("/login", "");
    expect(sessionStorage.getItem("crop-cms.nav")).toBeNull();
  });

  it("falls back to the home for a location the router cannot match", () => {
    remember("/library/a/b/c", "");
    expect(rememberedLocation(library)).toBe("/library");
  });

  it("falls back to the home for corrupt or foreign stored data", () => {
    sessionStorage.setItem("crop-cms.nav", "not json");
    expect(rememberedLocation(library)).toBe("/library");
    sessionStorage.setItem("crop-cms.nav", JSON.stringify({ library: "/chat" }));
    expect(rememberedLocation(library)).toBe("/library");
    sessionStorage.setItem("crop-cms.nav", JSON.stringify({ library: 5 }));
    expect(rememberedLocation(library)).toBe("/library");
  });

  it("is cleared by clearNavMemory and by any token change", () => {
    remember("/library/basil", "");
    clearNavMemory();
    expect(rememberedLocation(library)).toBe("/library");
    remember("/library/basil", "");
    setToken("t");
    expect(rememberedLocation(library)).toBe("/library");
    remember("/library/basil", "");
    clearToken();
    expect(rememberedLocation(library)).toBe("/library");
  });

  it("stays silent when storage refuses a write", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    expect(() => remember("/library/basil", "")).not.toThrow();
    spy.mockRestore();
    expect(rememberedLocation(library)).toBe("/library");
  });
});
