import { expect, it } from "vitest";
import { clearToken, getToken, setToken } from "./token";

it("stores, reads and clears the token in sessionStorage", () => {
  expect(getToken()).toBeNull();
  setToken("abc");
  expect(getToken()).toBe("abc");
  expect(sessionStorage.length).toBe(1);
  clearToken();
  expect(getToken()).toBeNull();
});
