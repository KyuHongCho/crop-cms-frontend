import { clearNavMemory } from "../shell/navMemory";
import { clearScrollMemory } from "../shell/scrollPositions";

const KEY = "crop-cms.token";

export const getToken = (): string | null => sessionStorage.getItem(KEY);
// Remembered locations and scroll positions belong to one session, so any token change drops them.
export const setToken = (token: string): void => {
  clearNavMemory();
  clearScrollMemory();
  sessionStorage.setItem(KEY, token);
};
export const clearToken = (): void => {
  clearNavMemory();
  clearScrollMemory();
  sessionStorage.removeItem(KEY);
};
