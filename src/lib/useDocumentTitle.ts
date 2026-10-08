import { useEffect } from "react";

export const APP_TITLE = "Crop CMS";

export function useDocumentTitle(...parts: string[]) {
  const title = [...parts, APP_TITLE].join(" · ");
  useEffect(() => {
    document.title = title;
  }, [title]);
}
