import type { ReactNode } from "react";

import { cn } from "./cn";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  /** Hide on small screens (the row still shows the primary columns). */
  hideOnMobile?: boolean;
};

/**
 * Responsive table: a real <table> from `md` up, stacked cards on phones.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  caption,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  empty?: ReactNode;
  caption?: string;
}) {
  if (!rows.length) {
    return <>{empty ?? null}</>;
  }

  return (
    <>
      <div className="surface hidden overflow-x-auto rounded-card md:block">
        <table className="w-full text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead>
            <tr className="border-b border-line text-start text-xs text-ink-3">
              {columns.map((column) => (
                <th key={column.key} scope="col" className={cn("px-4 py-3 text-start font-semibold", column.className)}>
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className="border-b border-line/70 last:border-0 hover:bg-surface-2/60">
                {columns.map((column) => (
                  <td key={column.key} className={cn("px-4 py-3.5 align-middle text-ink-2", column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="surface rounded-card p-4">
            <dl className="space-y-2.5">
              {columns
                .filter((column) => !column.hideOnMobile)
                .map((column) => (
                  <div key={column.key} className="flex items-start justify-between gap-4 text-sm">
                    <dt className="shrink-0 text-xs font-semibold text-ink-3">{column.header}</dt>
                    <dd className="min-w-0 text-end text-ink-2">{column.cell(row)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
