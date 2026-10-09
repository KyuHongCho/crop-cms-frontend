import { afterEach, describe, expect, it, vi } from "vitest";
import { clearToken, setToken } from "../auth/token";
import { MAX_ENTRIES, clearScrollMemory, latestPositionFor, positionFor, savePosition, takeOverScroll } from "./scrollPositions";

afterEach(() => vi.restoreAllMocks());

describe("saved scroll positions", () => {
  it("returns a position for the same key and path, and nothing for another path under that key", () => {
    savePosition("k1", "/library/basil", 400);
    expect(positionFor("k1", "/library/basil")).toBe(400);
    expect(positionFor("k1", "/chat")).toBeUndefined();
    expect(positionFor("other", "/library/basil")).toBeUndefined();
  });

  it("overwrites a key's earlier position and rounds to whole pixels", () => {
    savePosition("k1", "/chat", 10);
    savePosition("k1", "/chat", 250.6);
    expect(positionFor("k1", "/chat")).toBe(251);
  });

  it("finds the most recently saved position for a path", () => {
    savePosition("a", "/library/basil", 400);
    savePosition("b", "/library/basil", 0);
    savePosition("c", "/chat", 90);
    expect(latestPositionFor("/library/basil")).toBe(0);
    savePosition("a", "/library/basil", 120);
    expect(latestPositionFor("/library/basil")).toBe(120);
    expect(latestPositionFor("/nowhere")).toBeUndefined();
  });

  it("keeps at most MAX_ENTRIES and drops the oldest, even for numeric-looking keys", () => {
    for (let i = 0; i < MAX_ENTRIES + 5; i++) savePosition(String(i), "/chat", i);
    expect(JSON.parse(sessionStorage.getItem("crop-cms.scroll")!)).toHaveLength(MAX_ENTRIES);
    expect(positionFor("0", "/chat")).toBeUndefined();
    expect(positionFor("4", "/chat")).toBeUndefined();
    expect(positionFor("5", "/chat")).toBe(5);
    expect(positionFor(String(MAX_ENTRIES + 4), "/chat")).toBe(MAX_ENTRIES + 4);
  });

  it("ignores stored data that is not a list of entries", () => {
    sessionStorage.setItem("crop-cms.scroll", "{not json");
    expect(positionFor("k", "/chat")).toBeUndefined();
    sessionStorage.setItem("crop-cms.scroll", JSON.stringify({ k: 1 }));
    expect(positionFor("k", "/chat")).toBeUndefined();
    sessionStorage.setItem("crop-cms.scroll", JSON.stringify([{ key: "k", path: "/chat", y: "x" }, null]));
    expect(positionFor("k", "/chat")).toBeUndefined();
  });

  it("does not throw when sessionStorage fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => savePosition("k", "/chat", 5)).not.toThrow();
    expect(positionFor("k", "/chat")).toBeUndefined();
    expect(() => clearScrollMemory()).not.toThrow();
  });

  it("is cleared by a token change, like the remembered pages", () => {
    savePosition("k", "/chat", 5);
    setToken("tok-2");
    expect(sessionStorage.getItem("crop-cms.scroll")).toBeNull();
    savePosition("k", "/chat", 5);
    clearToken();
    expect(sessionStorage.getItem("crop-cms.scroll")).toBeNull();
  });
});

describe("takeOverScroll", () => {
  it("turns the browser's own scroll restoration off", () => {
    history.scrollRestoration = "auto";
    takeOverScroll();
    expect(history.scrollRestoration).toBe("manual");
  });
});
