import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "./cn";

/** Link-based pagination that preserves the other query parameters. */
export function Pagination({
  page,
  pageCount,
  basePath,
  params,
  lang,
}: {
  page: number;
  pageCount: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  lang: "ar" | "en";
}) {
  if (pageCount <= 1) {
    return null;
  }

  const href = (target: number) => {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params ?? {})) {
      if (value) {
        search.set(key, value);
      }
    }

    search.set("page", String(target));
    return `${basePath}?${search.toString()}`;
  };

  const linkClass =
    "inline-flex h-10 items-center gap-1.5 rounded-xl border border-line-strong bg-surface-2 px-3.5 text-sm font-semibold text-ink-2 hover:text-ink";

  return (
    <nav className="mt-6 flex items-center justify-between gap-3" aria-label={lang === "ar" ? "الصفحات" : "Pages"}>
      {page > 1 ? (
        <Link href={href(page - 1)} className={linkClass}>
          <ChevronRight size={16} className="ltr:rotate-180" aria-hidden />
          {lang === "ar" ? "السابق" : "Previous"}
        </Link>
      ) : (
        <span />
      )}
      <span className="nums text-sm text-ink-3">
        {page} / {pageCount}
      </span>
      {page < pageCount ? (
        <Link href={href(page + 1)} className={cn(linkClass)}>
          {lang === "ar" ? "التالي" : "Next"}
          <ChevronLeft size={16} className="ltr:rotate-180" aria-hidden />
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export function paginate<T>(rows: T[], pageParam: unknown, pageSize = 20) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const requested = Number(pageParam);
  const page = Number.isInteger(requested) && requested > 0 ? Math.min(requested, pageCount) : 1;

  return {
    page,
    pageCount,
    items: rows.slice((page - 1) * pageSize, page * pageSize),
    total: rows.length,
  };
}
