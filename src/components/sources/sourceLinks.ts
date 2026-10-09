export const sourceId = (key: string) => `source-${key}`;

export function focusSource(key: string) {
  const el = document.getElementById(sourceId(key));
  if (!el) return;
  el.focus({ preventScroll: true });
  // jsdom has no scrollIntoView.
  el.scrollIntoView?.({ block: "nearest" });
}
