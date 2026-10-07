import { describe, expect, it } from "vitest";
import { normaliseError } from "./errors";

describe("normaliseError", () => {
  it("reads a string detail", () => {
    expect(normaliseError(401, { detail: "Incorrect email or password" })).toEqual({
      kind: "unauthenticated",
      status: 401,
      message: "Incorrect email or password",
    });
  });

  it("joins a validation list", () => {
    const e = normaliseError(422, { detail: [{ msg: "too short" }, { msg: "bad email" }] });
    expect(e).toMatchObject({ kind: "validation", message: "too short; bad email" });
  });

  it("reads message from an object detail", () => {
    const e = normaliseError(413, { detail: { topic: "x", message: "Too much context" } });
    expect(e).toMatchObject({ kind: "too_large", message: "Too much context" });
  });

  it("carries Retry-After on a 429", () => {
    const e = normaliseError(
      429,
      { detail: "Daily token budget exhausted" },
      new Headers({ "Retry-After": "3600" }),
    );
    expect(e).toEqual({
      kind: "rate_limited",
      status: 429,
      message: "Daily token budget exhausted",
      retryAfter: 3600,
    });
  });

  it("falls back for unknown status and empty body", () => {
    expect(normaliseError(500, undefined)).toEqual({
      kind: "unknown",
      status: 500,
      message: "Request failed (500)",
    });
  });

  it("maps 400 and 503", () => {
    expect(normaliseError(400, { detail: "x" }).kind).toBe("bad_request");
    expect(normaliseError(503, { detail: "x" }).kind).toBe("unavailable");
  });
});
