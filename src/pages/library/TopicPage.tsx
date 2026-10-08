import { useCallback } from "react";
import { useParams } from "react-router-dom";
import SourceCard from "../../components/sources/SourceCard";
import { fetchTopicSet, useLoad } from "./libraryApi";
import { BackLink, EmptyNote, LibraryError, LibraryLayout, LoadingBlock } from "./parts";

export default function TopicPage() {
  const { cropSlug = "", topic = "" } = useParams();
  const load = useCallback(() => fetchTopicSet(cropSlug, topic), [cropSlug, topic]);
  const state = useLoad(load);

  return (
    <LibraryLayout>
      <BackLink to={`/library/${encodeURIComponent(cropSlug)}`}>{`Back to ${cropSlug}`}</BackLink>
      <h1 className="text-2xl leading-tight font-semibold">{topic}</h1>
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading documents..." />}
        {state.status === "error" && <LibraryError error={state.error} notFound={`No crop named "${cropSlug}".`} />}
        {state.status === "ok" && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {state.data.document_count === 1 ? "1 document" : `${state.data.document_count} documents`}
            </p>
            {state.data.documents.length === 0 ? (
              <EmptyNote>No published documents for this topic.</EmptyNote>
            ) : (
              <ul aria-label="Documents" className="space-y-3">
                {state.data.documents.map((d) => (
                  <SourceCard key={d.id} doc={d} />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </LibraryLayout>
  );
}
