import { useEffect, useState } from "react";
import { client } from "../api/client";
import type { components } from "../api/schema";
import { useAuth } from "../auth/AuthContext";

type Member = components["schemas"]["MemberResponse"];

export default function ChatPage() {
  const { logout } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    client
      .GET("/members/me")
      .then(({ data, response }) => {
        if (!live) return;
        if (data) setMember(data);
        else if (response.status !== 401) setError(`Could not load your profile (${response.status}).`);
      })
      .catch(() => live && setError("Could not reach the server."));
    return () => {
      live = false;
    };
  }, []);

  return (
    <main>
      <h1>Chat</h1>
      {member && (
        <p>
          Signed in as {member.display_name || member.email}. Tokens used today:{" "}
          {member.tokens_used_today} / {member.tokens_budget_daily}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button onClick={logout}>Log out</button>
    </main>
  );
}
