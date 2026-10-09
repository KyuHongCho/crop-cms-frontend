import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";
import { latestPositionFor, positionFor, savePosition } from "./scrollPositions";

export const SAVE_THROTTLE_MS = 100;
export const RETRY_MS = 50;
export const RESTORE_BOUND_MS = 2000;

const ReadyContext = createContext<() => void>(() => {});

type Restore = {
  target: number;
  begun: boolean;
  startedAt: number;
  begin?: () => void;
  timer?: ReturnType<typeof setTimeout>;
  deadline?: ReturnType<typeof setTimeout>;
};
type Pending = { key: string; path: string; y: number };

// Block body: some browsers' scrollTo returns a Promise, which React would call as cleanup.
function jump(y: number): void {
  window.scrollTo(0, y);
}

// Pages call this with "my data is shown"; a restore waits for it, since a skeleton is too short to scroll to.
export function usePageReady(ready: boolean): void {
  const { key } = useLocation();
  const signal = useContext(ReadyContext);
  useEffect(() => {
    if (ready) signal();
  }, [ready, key, signal]);
}

export default function ScrollMemory({ children }: { children: ReactNode }) {
  const { key, pathname, search, state } = useLocation();
  const navType = useNavigationType();
  const path = pathname + search;
  const resume = (state as { resume?: boolean } | null)?.resume === true;
  const here = useRef({ key, path });
  const restore = useRef<Restore | null>(null);
  const pending = useRef<Pending | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // The value is read when the scroll event fires: by leave time the browser may have clamped it.
  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    const p = pending.current;
    pending.current = null;
    if (p) savePosition(p.key, p.path, p.y);
  }, []);

  // Layout effect: it must run before the page's own ready effect in the same commit.
  useLayoutEffect(() => {
    flush();
    here.current = { key, path };
    const target = navType === "POP" ? positionFor(key, path) : resume ? latestPositionFor(path) : undefined;
    if (!target) {
      jump(0);
      savePosition(key, path, 0);
      return;
    }
    if (resume) savePosition(key, path, target);
    const r: Restore = { target, begun: false, startedAt: Date.now() };
    restore.current = r;
    const attempt = () => {
      jump(r.target);
      if (Math.abs(window.scrollY - r.target) < 1 || Date.now() - r.startedAt >= RESTORE_BOUND_MS) {
        restore.current = null;
        return;
      }
      r.timer = setTimeout(attempt, RETRY_MS);
    };
    r.begin = () => {
      if (r.begun) return;
      r.begun = true;
      clearTimeout(r.deadline);
      attempt();
    };
    r.deadline = setTimeout(r.begin, RESTORE_BOUND_MS);
    return () => {
      clearTimeout(r.timer);
      clearTimeout(r.deadline);
      if (restore.current === r) restore.current = null;
    };
  }, [key, path, navType, resume, flush]);

  useEffect(() => {
    const onScroll = () => {
      // Scroll events during a restore come from a page still too short to hold the saved position.
      if (restore.current) return;
      pending.current = { ...here.current, y: window.scrollY };
      saveTimer.current ??= setTimeout(flush, SAVE_THROTTLE_MS);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", flush);
      clearTimeout(saveTimer.current);
      saveTimer.current = undefined;
      pending.current = null;
    };
  }, [flush]);

  const signal = useCallback(() => restore.current?.begin?.(), []);
  return <ReadyContext.Provider value={signal}>{children}</ReadyContext.Provider>;
}
