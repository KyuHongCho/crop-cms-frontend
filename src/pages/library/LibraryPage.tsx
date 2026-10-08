import { Link } from "react-router-dom";
import { fetchCrops, useLoad } from "./libraryApi";
import { EmptyNote, LibraryError, LibraryLayout, LoadingBlock } from "./parts";

export default function LibraryPage() {
  const state = useLoad(fetchCrops);
  return (
    <LibraryLayout>
      <h1 className="mb-4 text-2xl leading-tight font-semibold">Library</h1>
      <p className="mb-6 text-sm text-muted-foreground">Published documents the answers draw on, by crop and topic.</p>
      {state.status === "loading" && <LoadingBlock label="Loading crops..." />}
      {state.status === "error" && <LibraryError error={state.error} notFound="Crops were not found." />}
      {state.status === "ok" && state.data.length === 0 && <EmptyNote>No crops yet.</EmptyNote>}
      {state.status === "ok" && state.data.length > 0 && (
        <ul className="space-y-3">
          {state.data.map((c) => (
            <li key={c.id}>
              <Link
                to={`/library/${encodeURIComponent(c.slug)}`}
                className="block rounded-xl border bg-card p-4 text-card-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring"
              >
                <span className="font-medium">{c.common_name}</span>
                <em className="mt-0.5 block text-sm text-muted-foreground">{c.scientific_name}</em>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </LibraryLayout>
  );
}
