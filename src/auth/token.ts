const KEY = "crop-cms.token";

export const getToken = (): string | null => sessionStorage.getItem(KEY);
export const setToken = (token: string): void => sessionStorage.setItem(KEY, token);
export const clearToken = (): void => sessionStorage.removeItem(KEY);
