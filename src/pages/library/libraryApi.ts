import { useEffect, useState } from "react";
import { isApiError, normaliseError, type ApiError } from "../../api/errors";
import { client } from "../../api/client";

type Result<T> = { data?: T; error?: unknown; response: Response };

async function unwrap<T>(call: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await call;
  if (!response.ok || data === undefined) throw normaliseError(response.status, error, response.headers);
  return data;
}

export const fetchCrops = () => unwrap(client.GET("/crops"));
export const fetchItems = () => unwrap(client.GET("/items"));
export const fetchTopicSet = (crop: string, topic: string) =>
  unwrap(client.GET("/retrieval/{crop_slug}/{topic}", { params: { path: { crop_slug: crop, topic } } }));

// null means the request never got an answer (offline), as opposed to an ApiError.
export type Load<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "error"; error: ApiError | null };

export function useLoad<T>(load: () => Promise<T>): Load<T> {
  const [done, setDone] = useState<{ from: () => Promise<T>; result: Load<T> } | null>(null);
  useEffect(() => {
    let live = true;
    load().then(
      (data) => live && setDone({ from: load, result: { status: "ok", data } }),
      (e: unknown) => live && setDone({ from: load, result: { status: "error", error: isApiError(e) ? e : null } }),
    );
    return () => {
      live = false;
    };
  }, [load]);
  return done && done.from === load ? done.result : { status: "loading" };
}
