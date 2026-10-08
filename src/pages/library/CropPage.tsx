import { useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { normaliseError } from "../../api/errors";
import { fetchCrops, fetchItems, useLoad } from "./libraryApi";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { BackLink, documentCount, EmptyNote, LibraryError, LibraryLayout, LoadingBlock, PageHeading } from "./parts";

export default function CropPage() {
  const { cropSlug = "" } = useParams();
  const load = useCallback(async () => {
    const [crops, items] = await Promise.all([fetchCrops(), fetchItems()]);
    const crop = crops.find((c) => c.slug === cropSlug);
    if (!crop) throw normaliseError(404, null);
    // GET /items also returns drafts; only published documents are listed.
    const counts = new Map<string, number>();
    for (const i of items) {
      if (i.crop_id === crop.id && i.published === true && i.topic != null) counts.set(i.topic, (counts.get(i.topic) ?? 0) + 1);
    }
    return { crop, topics: [...counts].sort(([a], [b]) => a.localeCompare(b)) };
  }, [cropSlug]);
  const state = useLoad(load);
  const missing = `No crop named "${cropSlug}".`;
  const name = state.status === "ok" ? state.data.crop.common_name : cropSlug;
  useDocumentTitle(name, "Library");

  return (
    <LibraryLayout>
      <BackLink to="/library">Back to Library</BackLink>
      <PageHeading>{name}</PageHeading>
      {state.status === "loading" && <LoadingBlock label="Loading topics..." />}
      {state.status === "error" && (
        <div className="mt-4">
          <LibraryError error={state.error} notFound={missing} />
        </div>
      )}
      {state.status === "ok" && (
        <>
          <em className="mt-1 mb-6 block text-sm text-muted-foreground">{state.data.crop.scientific_name}</em>
          {state.data.topics.length === 0 ? (
            <EmptyNote>No published topics for this crop yet.</EmptyNote>
          ) : (
            <ul className="space-y-3">
              {state.data.topics.map(([topic, n]) => (
                <li key={topic}>
                  <Link
                    to={`/library/${encodeURIComponent(cropSlug)}/${encodeURIComponent(topic)}`}
                    className="flex items-baseline justify-between gap-4 rounded-xl border bg-card p-4 text-card-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
                  >
                    <span className="font-medium">{topic}</span>
                    <span className="shrink-0 text-sm text-muted-foreground">{documentCount(n)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </LibraryLayout>
  );
}
