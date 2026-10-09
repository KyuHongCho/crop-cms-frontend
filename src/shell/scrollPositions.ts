const KEY = "crop-cms.scroll";
export const MAX_ENTRIES = 50;

// An array, not an object: a numeric-looking location key would reorder an object's keys and break eviction.
type Entry = { key: string; path: string; y: number };

function read(): Entry[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is Entry => !!e && typeof e.key === "string" && typeof e.path === "string" && Number.isFinite(e.y),
    );
  } catch {
    return [];
  }
}

export function savePosition(key: string, path: string, y: number): void {
  try {
    const entries = read().filter((e) => e.key !== key);
    entries.push({ key, path, y: Math.max(0, Math.round(y)) });
    sessionStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX_ENTRIES)));
  } catch {
    // Losing a position is harmless; an uncaught throw from a scroll handler would not be.
  }
}

// The path must match: a fresh document's first entry always has the key "default", whatever page it shows.
export function positionFor(key: string, path: string): number | undefined {
  return read().find((e) => e.key === key && e.path === path)?.y;
}

export function latestPositionFor(path: string): number | undefined {
  return read().reverse().find((e) => e.path === path)?.y;
}

export function clearScrollMemory(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function takeOverScroll(): void {
  try {
    history.scrollRestoration = "manual";
  } catch {
    // Without it the browser keeps restoring on its own, which is the old behaviour.
  }
}
