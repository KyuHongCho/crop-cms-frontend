import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { client, setUnauthorizedHandler } from "../api/client";
import { normaliseError } from "../api/errors";
import { clearToken, getToken, setToken } from "./token";

type Auth = {
  token: string | null;
  sessionExpired: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(getToken);
  const [sessionExpired, setSessionExpired] = useState(false);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setSessionExpired(false);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setTokenState(null);
      setSessionExpired(true);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { data, error, response } = await client.POST("/members/login", {
      body: { email, password },
    });
    if (!data) throw normaliseError(response.status, error, response.headers);
    setToken(data.access_token);
    setTokenState(data.access_token);
    setSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider value={{ token, sessionExpired, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): Auth {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}
