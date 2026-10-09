import { useCallback } from "react";
import { useParams } from "react-router-dom";
import SourceCard from "../../components/sources/SourceCard";
import { fetchTopicSet, useLoad } from "./libraryApi";
import { usePageReady } from "../../shell/ScrollMemory";
import { useDocumentTitle } from "../../lib/useDocumentTitle";
import { BackLink, documentCount, EmptyNote, LibraryError, LibraryLayout, LoadingBlock, PageHeading } from "./parts";

export default function TopicPage() {
  const { cropSlug = "", topic = "" } = useParams();
  const load = useCallback(() => fetchTopicSet(cropSlug, topic), [cropSlug, topic]);
  const state = useLoad(load);
  useDocumentTitle(topic, cropSlug, "Library");
  usePageReady(state.status !== "loading");
  // A route miss is also a 404; only the backend's "crop '<slug>' not found" says the crop is the missing part.
  const cropMissing =
    state.status === "error" && state.error?.status === 404 && /^crop .* not found$/.test(state.error.message) && state.error.message.includes(cropSlug)
      ? `No crop named "${cropSlug}".`
      : undefined;

  return (
    <LibraryLayout>
      <BackLink to={`/library/${encodeURIComponent(cropSlug)}`}>{`Back to ${cropSlug}`}</BackLink>
      <PageHeading>{topic}</PageHeading>
      <div className="mt-6">
        {state.status === "loading" && <LoadingBlock label="Loading documents..." />}
        {state.status === "error" && <LibraryError error={state.error} notFound={cropMissing} />}
        {state.status === "ok" && (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {documentCount(state.data.document_count)}
            </p>
            <h2 className="sr-only">Documents</h2>
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
