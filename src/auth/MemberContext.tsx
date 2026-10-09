import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { client } from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "./AuthContext";

type Member = components["schemas"]["MemberResponse"];
type Loaded = { token: string | null; member: Member | null; error: string | null };

type Ctx = { member: Member | null; error: string | null; refresh: () => Promise<void> };
const MemberContext = createContext<Ctx | null>(null);

export function MemberProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [loaded, setLoaded] = useState<Loaded>({ token: null, member: null, error: null });

  useEffect(() => {
    let live = true;
    client
      .GET("/members/me")
      .then(({ data, response }) => {
        if (!live) return;
        if (data) setLoaded({ token, member: data, error: null });
        else if (response.status !== 401) {
          setLoaded({ token, member: null, error: `Could not load your profile (${response.status}).` });
        }
      })
      .catch(() => live && setLoaded({ token, member: null, error: "Could not reach the server." }));
    return () => {
      live = false;
    };
  }, [token]);

  const refresh = useCallback(async () => {
    try {
      const { data } = await client.GET("/members/me");
      if (data) setLoaded((prev) => (prev.token === token ? { ...prev, member: data } : prev));
    } catch {
      // the indicator stays on its last value; the answer is already shown
    }
  }, [token]);

  // A value loaded for another token is never shown, so a replaced session cannot flash the old name.
  const value = useMemo<Ctx>(
    () => ({
      member: loaded.token === token ? loaded.member : null,
      error: loaded.token === token ? loaded.error : null,
      refresh,
    }),
    [loaded, token, refresh],
  );
  return <MemberContext.Provider value={value}>{children}</MemberContext.Provider>;
}

export function useMember(): Ctx {
  const ctx = useContext(MemberContext);
  if (!ctx) throw new Error("useMember must be used inside MemberProvider");
  return ctx;
}
