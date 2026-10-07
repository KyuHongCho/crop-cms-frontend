import createClient from "openapi-fetch";
import type { paths } from "./schema";
import { getToken } from "../auth/token";

let onUnauthorized: () => void = () => {};
export const setUnauthorizedHandler = (fn: () => void): void => {
  onUnauthorized = fn;
};

// Absolute URL because Node's fetch (tests) cannot resolve a relative base. fetch is looked up per
// call because openapi-fetch otherwise captures it at import, before MSW patches it.
export const client = createClient<paths>({
  baseUrl: `${window.location.origin}/api`,
  fetch: (request) => globalThis.fetch(request),
});

client.use({
  onRequest({ request }) {
    const token = getToken();
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
  onResponse({ request, response }) {
    // Only a 401 for the token still in use means "session expired": a bad login carries none, and a
    // late 401 for a token the user already replaced must not end the new session.
    const sent = request.headers.get("Authorization");
    if (response.status === 401 && sent !== null && sent === `Bearer ${getToken()}`) onUnauthorized();
    return response;
  },
});
