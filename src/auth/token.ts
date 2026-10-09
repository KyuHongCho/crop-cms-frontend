import { clearNavMemory } from "../shell/navMemory";

const KEY = "crop-cms.token";

export const getToken = (): string | null => sessionStorage.getItem(KEY);
// Remembered locations belong to one session, so any token change drops them.
export const setToken = (token: string): void => {
  clearNavMemory();
  sessionStorage.setItem(KEY, token);
};
export const clearToken = (): void => {
  clearNavMemory();
  sessionStorage.removeItem(KEY);
};
