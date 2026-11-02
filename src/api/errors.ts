export type ApiError = {
  kind:
    | "unauthenticated"
    | "bad_request"
    | "validation"
    | "too_large"
    | "rate_limited"
    | "unavailable"
    | "unknown";
  status: number;
  message: string;
  retryAfter?: number;
};

const KIND_BY_STATUS: Record<number, ApiError["kind"]> = {
  400: "bad_request",
  401: "unauthenticated",
  413: "too_large",
  422: "validation",
  429: "rate_limited",
  502: "unavailable",
  503: "unavailable",
  504: "unavailable",
};

// A proxy's 502/504 carries no FastAPI `detail`, so the message has to come from the status.
const NO_ANSWER = "The server did not answer. Try again in a moment.";
const FALLBACK_BY_STATUS: Record<number, string> = { 502: NO_ANSWER, 504: NO_ANSWER };

// FastAPI `detail` is a string, a list of validation items, or an object with `message`.
function detailMessage(body: unknown, status: number): string {
  const detail = (body as { detail?: unknown } | null | undefined)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((d) => (d as { msg?: unknown })?.msg).filter((m) => typeof m === "string");
    if (parts.length > 0) return parts.join("; ");
  } else if (detail && typeof detail === "object") {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return FALLBACK_BY_STATUS[status] ?? `Request failed (${status})`;
}

export function normaliseError(status: number, body: unknown, headers?: Headers): ApiError {
  const error: ApiError = {
    kind: KIND_BY_STATUS[status] ?? "unknown",
    status,
    message: detailMessage(body, status),
  };
  const retry = Number(headers?.get("Retry-After"));
  if (Number.isFinite(retry) && retry > 0) error.retryAfter = retry;
  return error;
}

export const isApiError = (e: unknown): e is ApiError =>
  typeof e === "object" && e !== null && "kind" in e && "status" in e;
