import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "./cn";

export function LinkTabs({
  tabs,
  active,
  label,
}: {
  tabs: { key: string; href: string; label: ReactNode; count?: number }[];
  active: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="scrollbar-none -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-2xl border border-line bg-surface p-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;

          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition",
                  isActive ? "bg-surface-3 text-ink shadow-card" : "text-ink-3 hover:text-ink",
                )}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span className={cn("nums rounded-full px-1.5 text-xs", isActive ? "bg-brand/20 text-brand-ink" : "bg-surface-3 text-ink-3")}>
                    {tab.count}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
