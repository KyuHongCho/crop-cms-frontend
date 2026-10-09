import { act, fireEvent, render } from "@testing-library/react";
import { useEffect, useState } from "react";
import { MemoryRouter, useNavigate, type NavigateFunction, type To } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScrollMemory, { RESTORE_BOUND_MS, SAVE_THROTTLE_MS, usePageReady } from "./ScrollMemory";
import { positionFor, savePosition } from "./scrollPositions";

let y = 0;
let maxY = Infinity;
let startReady = true;
let setReady: (ready: boolean) => void;
let nav: NavigateFunction;
let scrollTo: ReturnType<typeof vi.fn>;

function Page() {
  const [ready, set] = useState(startReady);
  useEffect(() => {
    setReady = set;
  }, [set]);
  usePageReady(ready);
  return null;
}

function Handle() {
  const navigate = useNavigate();
  useEffect(() => {
    nav = navigate;
  }, [navigate]);
  return null;
}

function mount(path = "/a") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Handle />
      <ScrollMemory>
        <Page />
      </ScrollMemory>
    </MemoryRouter>,
  );
}

const go = (to: To | number, opts?: { state?: unknown }) => act(() => (typeof to === "number" ? nav(to) : nav(to, opts)));
const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const scrollTo400 = () => {
  y = 400;
  act(() => void fireEvent.scroll(window));
};

beforeEach(() => {
  vi.useFakeTimers();
  y = 0;
  maxY = Infinity;
  startReady = true;
  Object.defineProperty(window, "scrollY", { configurable: true, get: () => y });
  scrollTo = vi.fn((_x: number, to: number) => {
    y = Math.min(to, maxY);
  });
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
});

afterEach(() => {
  vi.useRealTimers();
  window.scrollTo = () => {};
  Reflect.deleteProperty(window, "scrollY");
});

describe("saving", () => {
  it("saves the position at scroll time, throttled, under the current location key", async () => {
    mount("/a");
    scrollTo400();
    expect(positionFor("default", "/a")).toBe(0);
    await wait(SAVE_THROTTLE_MS);
    expect(positionFor("default", "/a")).toBe(400);
  });

  it("saves the value seen when the scroll event fired, not the value at leave time", async () => {
    mount("/a");
    scrollTo400();
    y = 0; // the browser clamped it while the next page rendered
    await go("/b");
    await wait(SAVE_THROTTLE_MS);
    expect(positionFor("default", "/a")).toBe(400);
  });

  it("writes a pending position at once on pagehide", () => {
    mount("/a");
    scrollTo400();
    act(() => void window.dispatchEvent(new Event("pagehide")));
    expect(positionFor("default", "/a")).toBe(400);
  });

  it("does not write after it unmounts, so a logout leaves nothing behind", async () => {
    const view = mount("/a");
    scrollTo400();
    view.unmount();
    sessionStorage.clear();
    await wait(SAVE_THROTTLE_MS * 2);
    expect(sessionStorage.getItem("crop-cms.scroll")).toBeNull();
  });
});

describe("restoring", () => {
  async function leaveScrolledAndComeBack() {
    mount("/a");
    scrollTo400();
    await wait(SAVE_THROTTLE_MS);
    await go("/b");
    expect(y).toBe(0);
    scrollTo.mockClear();
  }

  it("waits for the page to be ready before restoring on Back", async () => {
    await leaveScrolledAndComeBack();
    act(() => setReady(false));
    await go(-1);
    await wait(500);
    expect(scrollTo).not.toHaveBeenCalledWith(0, 400);
    act(() => setReady(true));
    expect(scrollTo).toHaveBeenCalledWith(0, 400);
    expect(y).toBe(400);
  });

  it("restores at once on Back when the page is ready", async () => {
    await leaveScrolledAndComeBack();
    await go(-1);
    expect(scrollTo).toHaveBeenCalledWith(0, 400);
    expect(y).toBe(400);
  });

  it("restores a position saved before a reload", async () => {
    savePosition("default", "/a", 300);
    mount("/a");
    expect(scrollTo).toHaveBeenCalledWith(0, 300);
    expect(y).toBe(300);
  });

  it("does not use a position saved for another path under the same key", () => {
    savePosition("default", "/other", 300);
    mount("/a");
    expect(scrollTo).not.toHaveBeenCalledWith(0, 300);
  });

  it("keeps trying while the page is too short, then stops at the bound", async () => {
    savePosition("default", "/a", 300);
    maxY = 100;
    mount("/a");
    await wait(RESTORE_BOUND_MS + 100);
    const calls = scrollTo.mock.calls.length;
    expect(calls).toBeGreaterThan(3);
    expect(y).toBe(100);
    await wait(5000);
    expect(scrollTo.mock.calls.length).toBe(calls);
  });

  it("succeeds on a retry when the content grows after the page reported ready", async () => {
    savePosition("default", "/a", 300);
    maxY = 100;
    mount("/a");
    await wait(200);
    maxY = Infinity;
    await wait(100);
    expect(y).toBe(300);
    const calls = scrollTo.mock.calls.length;
    await wait(1000);
    expect(scrollTo.mock.calls.length).toBe(calls);
  });

  it("counts the bound from the navigation, so a late ready signal does not extend it", async () => {
    startReady = false;
    savePosition("default", "/a", 300);
    maxY = 100;
    mount("/a");
    await wait(1500);
    act(() => setReady(true));
    await wait(RESTORE_BOUND_MS - 1500 + 100);
    const calls = scrollTo.mock.calls.length;
    expect(calls).toBeGreaterThan(1);
    await wait(5000);
    expect(scrollTo.mock.calls.length).toBe(calls);
  });

  it("makes a single attempt at the bound when the page never reports ready", async () => {
    savePosition("default", "/a", 300);
    startReady = false;
    maxY = 100;
    mount("/a");
    await wait(RESTORE_BOUND_MS - 100);
    expect(scrollTo).not.toHaveBeenCalledWith(0, 300);
    await wait(200);
    expect(scrollTo).toHaveBeenCalledWith(0, 300);
    await wait(5000);
    expect(scrollTo.mock.calls.filter((c) => c[1] === 300)).toHaveLength(1);
  });

  it("does not overwrite the saved position with the clamped one while waiting", async () => {
    await leaveScrolledAndComeBack();
    act(() => setReady(false));
    await go(-1);
    y = 0;
    act(() => void fireEvent.scroll(window));
    await wait(SAVE_THROTTLE_MS * 2);
    expect(positionFor("default", "/a")).toBe(400);
  });

  it("resumes saving after the restore has finished", async () => {
    await leaveScrolledAndComeBack();
    await go(-1);
    y = 520;
    act(() => void fireEvent.scroll(window));
    await wait(SAVE_THROTTLE_MS);
    expect(positionFor("default", "/a")).toBe(520);
  });
});

describe("a new location", () => {
  it("renders and navigates when scrollTo returns a Promise and nothing is saved", async () => {
    scrollTo.mockImplementation(() => Promise.resolve());
    const view = mount("/a");
    await go("/b");
    await go(-1);
    view.unmount();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it("goes to the top on a PUSH, even to a path that was scrolled before", async () => {
    mount("/a");
    scrollTo400();
    await wait(SAVE_THROTTLE_MS);
    await go("/b");
    scrollTo.mockClear();
    await go("/a");
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
    expect(scrollTo).not.toHaveBeenCalledWith(0, 400);
    expect(y).toBe(0);
  });

  it("restores the last position of the remembered location on a tab return", async () => {
    mount("/a");
    scrollTo400();
    await wait(SAVE_THROTTLE_MS);
    await go("/b");
    scrollTo.mockClear();
    await go("/a", { state: { fromTab: true, resume: true } });
    expect(scrollTo).toHaveBeenCalledWith(0, 400);
    expect(y).toBe(400);
  });

  it("goes to the top on the active tab (section home), which is not a tab return", async () => {
    mount("/a");
    scrollTo400();
    await wait(SAVE_THROTTLE_MS);
    scrollTo.mockClear();
    await go("/a", { state: { fromTab: true, resume: false } });
    expect(y).toBe(0);
  });

  it("goes to the top on a tab return to a location that was never scrolled", async () => {
    mount("/a");
    await go("/b");
    y = 250;
    scrollTo.mockClear();
    await go("/a", { state: { fromTab: true, resume: true } });
    expect(y).toBe(0);
  });

  it("returns to the top on Back to a page that was left at the top", async () => {
    mount("/a");
    await go("/b");
    scrollTo400();
    await wait(SAVE_THROTTLE_MS);
    await go(-1);
    expect(y).toBe(0);
  });
});
