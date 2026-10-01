"use client";

import { useState } from "react";

import { cn } from "@/app/ui/cn";

export type TrendDatum = { key: string; label: string; revenue: number; expenses: number; profit: number; sales: number };

/**
 * Revenue vs expenses per period (grouped bars, one IQD axis) with net
 * profit as a line on the same axis. Colors are the validated finance set
 * (--color-viz-*); identity is also carried by the legend. Hovering or
 * focusing a period shows its values; the same data is available as a
 * table. Profit is drawn only when expenses are being recorded.
 */
export function TrendChart({
  data,
  showProfit,
  labels,
  format,
}: {
  data: TrendDatum[];
  showProfit: boolean;
  labels: { revenue: string; expenses: string; profit: string; sales: string; table: string; period: string; empty: string; title: string };
  format: { currency: string; locale: string };
}) {
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const money = (value: number) => `${new Intl.NumberFormat(format.locale === "ar" ? "en-US" : "en-US").format(Math.round(value))} ${format.currency}`;

  const hasData = data.some((point) => point.revenue || point.expenses);
  const max = Math.max(1, ...data.map((point) => Math.max(point.revenue, point.expenses, point.profit)));
  const min = showProfit ? Math.min(0, ...data.map((point) => point.profit)) : 0;
  const span = max - min || 1;
  const W = 720;
  const H = 240;
  const pad = { top: 16, bottom: 8 };
  const plotH = H - pad.top - pad.bottom;
  const y = (value: number) => pad.top + ((max - value) / span) * plotH;
  const colW = W / Math.max(1, data.length);
  const barW = Math.max(2, Math.min(18, colW / 2 - 3));
  const zeroY = y(0);
  const labelEvery = Math.ceil(data.length / 8);
  const ticks = [max, max / 2, 0, ...(min < 0 ? [min] : [])];

  if (!hasData) {
    return <p className="rounded-2xl border border-dashed border-line-strong p-8 text-center text-sm text-ink-3">{labels.empty}</p>;
  }

  return (
    <figure aria-label={labels.title} data-testid="finance-trend">
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-ink-2">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px] bg-viz-revenue" aria-hidden />{labels.revenue}</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-[3px] bg-viz-expenses" aria-hidden />{labels.expenses}</span>
        {showProfit ? <span className="inline-flex items-center gap-2"><span className="h-0.5 w-4 rounded-full bg-viz-profit" aria-hidden />{labels.profit}</span> : null}
        <button type="button" onClick={() => setTable((value) => !value)} className="ms-auto rounded-lg px-2 py-1 text-brand-ink hover:text-ink" aria-pressed={table}>
          {labels.table}
        </button>
      </div>

      {table ? (
        <div className="max-h-80 overflow-auto rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface-2 text-xs text-ink-3">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-semibold">{labels.period}</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">{labels.revenue}</th>
                <th scope="col" className="px-3 py-2 text-start font-semibold">{labels.expenses}</th>
                {showProfit ? <th scope="col" className="px-3 py-2 text-start font-semibold">{labels.profit}</th> : null}
                <th scope="col" className="px-3 py-2 text-start font-semibold">{labels.sales}</th>
              </tr>
            </thead>
            <tbody>
              {[...data].reverse().map((point) => (
                <tr key={point.key} className="border-t border-line/60">
                  <td className="nums px-3 py-2 text-ink-2">{point.label}</td>
                  <td className="nums px-3 py-2 font-semibold text-ink">{money(point.revenue)}</td>
                  <td className="nums px-3 py-2 text-ink-2">{money(point.expenses)}</td>
                  {showProfit ? <td className="nums px-3 py-2 text-ink-2">{money(point.profit)}</td> : null}
                  <td className="nums px-3 py-2 text-ink-2">{point.sales}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="relative" dir="ltr">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-64 w-full overflow-visible" preserveAspectRatio="none" role="img" aria-label={labels.title}>
            {ticks.map((tick) => (
              <line key={tick} x1={0} x2={W} y1={y(tick)} y2={y(tick)} stroke="rgb(203 233 253 / 0.08)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            <line x1={0} x2={W} y1={zeroY} y2={zeroY} stroke="rgb(203 233 253 / 0.22)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {data.map((point, index) => {
              const cx = index * colW + colW / 2;
              const revenueTop = y(point.revenue);
              const expensesTop = y(point.expenses);

              return (
                <g key={point.key} opacity={active === null || active === index ? 1 : 0.45}>
                  {point.revenue > 0 ? (
                    <rect x={cx - barW - 1} y={revenueTop} width={barW} height={Math.max(1, zeroY - revenueTop)} rx={Math.min(4, barW / 2)} className="fill-viz-revenue" />
                  ) : null}
                  {point.expenses > 0 ? (
                    <rect x={cx + 1} y={expensesTop} width={barW} height={Math.max(1, zeroY - expensesTop)} rx={Math.min(4, barW / 2)} className="fill-viz-expenses" />
                  ) : null}
                </g>
              );
            })}
            {showProfit ? (
              <polyline
                points={data.map((point, index) => `${index * colW + colW / 2},${y(point.profit)}`).join(" ")}
                fill="none"
                className="stroke-viz-profit"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {active !== null ? (
              <line x1={active * colW + colW / 2} x2={active * colW + colW / 2} y1={pad.top} y2={H - pad.bottom} stroke="rgb(203 233 253 / 0.35)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            ) : null}
          </svg>

          {/* Hit targets: one full-height column per period. */}
          <div className="absolute inset-0 flex">
            {data.map((point, index) => (
              <button
                key={point.key}
                type="button"
                className="h-full flex-1 focus:outline-none focus-visible:bg-white/5"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                aria-label={`${point.label}: ${labels.revenue} ${money(point.revenue)}, ${labels.expenses} ${money(point.expenses)}${showProfit ? `, ${labels.profit} ${money(point.profit)}` : ""}`}
              />
            ))}
          </div>

          {active !== null ? (
            <div
              className={cn(
                "glass-strong pointer-events-none absolute top-2 z-10 min-w-48 rounded-xl px-3 py-2.5 text-xs text-ink",
                active / data.length > 0.6 ? "-translate-x-full" : "",
              )}
              style={{ left: `${((active + 0.5) / data.length) * 100}%` }}
              dir="auto"
            >
              <p className="nums mb-1.5 font-bold text-ink">{data[active].label}</p>
              <p className="nums flex items-center justify-between gap-4"><span className="inline-flex items-center gap-1.5 text-ink-2"><span className="h-2 w-2 rounded-[2px] bg-viz-revenue" />{labels.revenue}</span>{money(data[active].revenue)}</p>
              <p className="nums flex items-center justify-between gap-4"><span className="inline-flex items-center gap-1.5 text-ink-2"><span className="h-2 w-2 rounded-[2px] bg-viz-expenses" />{labels.expenses}</span>{money(data[active].expenses)}</p>
              {showProfit ? <p className="nums flex items-center justify-between gap-4"><span className="inline-flex items-center gap-1.5 text-ink-2"><span className="h-0.5 w-3 rounded-full bg-viz-profit" />{labels.profit}</span>{money(data[active].profit)}</p> : null}
              <p className="nums mt-1 flex items-center justify-between gap-4 text-ink-3"><span>{labels.sales}</span>{data[active].sales}</p>
            </div>
          ) : null}

          <div className="mt-2 flex">
            {data.map((point, index) => (
              <span key={point.key} className="nums flex-1 truncate text-center text-[10px] text-ink-3">
                {index % labelEvery === 0 ? point.label : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  );
}
