import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import { server } from "./server";

// onUnhandledRequest:"error" only logs and fails the fetch, which the app can swallow; collecting
// the URLs lets afterEach fail the test that made the call.
let unhandled: string[] = [];
const onUnhandled = ({ request }: { request: Request }) => {
  unhandled.push(`${request.method} ${request.url}`);
};

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
  server.events.on("request:unhandled", onUnhandled);
});
beforeEach(() => {
  unhandled = [];
});
afterEach(() => {
  server.resetHandlers();
  cleanup();
  sessionStorage.clear();
  const seen = unhandled;
  unhandled = [];
  if (seen.length > 0) throw new Error(`Unhandled network request(s):\n${seen.join("\n")}`);
});
afterAll(() => {
  server.events.removeAllListeners();
  server.close();
});
