// Retry-After is seconds until the backend's daily rollover, so a relative phrase avoids guessing
// the member's timezone.
export function formatReset(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (seconds < 60) return "less than a minute";
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(seconds / 3600);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}
