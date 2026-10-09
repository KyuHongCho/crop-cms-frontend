import { routable, sectionFor, type Section } from "./sections";

const KEY = "crop-cms.nav";

type Memory = Record<string, string>;

function read(): Memory {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(KEY) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Memory) : {};
  } catch {
    return {};
  }
}

export function remember(pathname: string, search: string): void {
  const section = sectionFor(pathname);
  if (!section) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...read(), [section.id]: pathname + search }));
  } catch {
    // Losing the memory is harmless; an uncaught throw from the shell's effect would blank the app.
  }
}

// Falls back to the section home when nothing is stored or the stored path no longer matches a route.
export function rememberedLocation(section: Section): string {
  const stored = read()[section.id];
  if (typeof stored !== "string") return section.home;
  const pathname = stored.split(/[?#]/, 1)[0];
  return sectionFor(pathname) === section && routable(section, pathname) ? stored : section.home;
}

export function clearNavMemory(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
