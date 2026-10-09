import { ArrowLeft, CircleSlash, WifiOff, type LucideIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link, useLocation, useNavigationType } from "react-router-dom";
import type { ApiError } from "../../api/errors";
import FormError from "../../components/FormError";
import { Skeleton } from "@/components/ui/skeleton";

export const documentCount = (n: number) => (n === 1 ? "1 document" : `${n} documents`);

export function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="max-w-3xl">{children}</div>
    </div>
  );
}

// Following a link unmounts it and drops focus to <body>; focus moves on only if it was lost, and never on POP
// (first load, reload, back/forward) or a tab click (`fromTab`), where the user already chose the place; not left to
// where focus happens to be, since Safari may not focus a clicked link.
export function PageHeading({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const { pathname, state } = useLocation();
  const navType = useNavigationType();
  const fromTab = (state as { fromTab?: boolean } | null)?.fromTab === true;
  useEffect(() => {
    if (navType === "POP" || fromTab) return;
    if (document.activeElement === document.body || document.activeElement === null) ref.current?.focus();
  }, [pathname, navType, fromTab]);
  return (
    <h1 ref={ref} tabIndex={-1} className={`text-2xl leading-tight font-semibold outline-none ${className ?? ""}`.trim()}>
      {children}
    </h1>
  );
}

export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="mb-4 inline-flex items-center gap-1.5 rounded-lg text-sm text-primary underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {children}
    </Link>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div role="status" className="space-y-3">
      <Skeleton aria-hidden="true" className="h-16 w-full" />
      <Skeleton aria-hidden="true" className="h-16 w-full" />
      <Skeleton aria-hidden="true" className="h-16 w-5/6" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

export function EmptyNote({ icon: Icon = CircleSlash, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-1.5 text-sm text-muted-foreground">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

export function LibraryError({ error, notFound }: { error: ApiError | null; notFound?: string }) {
  if (error === null) return <FormError icon={WifiOff}>Could not reach the server.</FormError>;
  return <FormError>{error.status === 404 && notFound ? notFound : error.message}</FormError>;
}
