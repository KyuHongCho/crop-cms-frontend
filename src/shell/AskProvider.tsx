import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { client } from "../api/client";
import { isApiError, normaliseError, type ApiError } from "../api/errors";
import type { components } from "../api/schema";
import { useAuth } from "../auth/AuthContext";
import { useMember } from "../auth/MemberContext";

type Chat = components["schemas"]["ChatResponse"];
export type AskResult = { answer: Chat } | { error: ApiError } | { offline: true } | null;

export const MAX_QUESTION = 2000;

type Fields = { question: string; loading: boolean; result: AskResult; lastAsked: string };
type State = Fields & { token: string | null };

type Ctx = Fields & { setQuestion: (q: string) => void; ask: (text: string) => Promise<void> };

const AskContext = createContext<Ctx | null>(null);

const empty = (token: string | null): State => ({ token, question: "", loading: false, result: null, lastAsked: "" });

export function AskProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const { refresh: refreshMember } = useMember();
  const [state, setState] = useState<State>(() => empty(token));
  const inFlight = useRef(false);
  const currentToken = useRef(token);

  useEffect(() => {
    currentToken.current = token;
    inFlight.current = false;
  }, [token]);

  // A state held for another token is never shown, so a replaced session cannot see the old answer.
  const fields = state.token === token ? state : empty(token);

  const patch = useCallback(
    (change: Partial<Fields>) =>
      setState((prev) => ({ ...(prev.token === token ? prev : empty(token)), ...change })),
    [token],
  );

  const setQuestion = useCallback((question: string) => patch({ question }), [patch]);

  const ask = useCallback(
    async (text: string) => {
      if (inFlight.current) return;
      const q = text.trim();
      const n = [...q].length;
      if (n === 0 || n > MAX_QUESTION) return;
      inFlight.current = true;
      patch({ loading: true, result: null, lastAsked: q });
      let result: AskResult;
      try {
        const { data, error: body, response } = await client.POST("/chat", { body: { question: q } });
        result = data ? { answer: data } : { error: normaliseError(response.status, body, response.headers) };
      } catch (e) {
        result = isApiError(e) ? { error: e } : { offline: true };
      }
      // Logout or a 401 while the POST was out: this result belongs to a session that no longer exists.
      if (currentToken.current !== token) return;
      inFlight.current = false;
      patch({ loading: false, result });
      if ("answer" in result) void refreshMember();
    },
    [token, patch, refreshMember],
  );

  const value = useMemo<Ctx>(
    () => ({ question: fields.question, loading: fields.loading, result: fields.result, lastAsked: fields.lastAsked, setQuestion, ask }),
    [fields.question, fields.loading, fields.result, fields.lastAsked, setQuestion, ask],
  );
  return <AskContext.Provider value={value}>{children}</AskContext.Provider>;
}

export function useAsk(): Ctx {
  const ctx = useContext(AskContext);
  if (!ctx) throw new Error("useAsk must be used inside AskProvider");
  return ctx;
}
