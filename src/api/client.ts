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
    // Only a request that carried a token can mean "session expired"; a bad login also returns 401.
    if (response.status === 401 && request.headers.has("Authorization")) onUnauthorized();
    return response;
  },
});
