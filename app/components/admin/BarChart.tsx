/**
 * Minimal single-series bar chart (server-rendered, no JS). One hue that
 * passed the palette validator on the dark surface; 4px rounded data ends;
 * values on hover/focus; the page also renders the same data as a table.
 */
export function BarChart({
  data,
  formatValue,
  label,
}: {
  data: { key: string; label: string; value: number }[];
  formatValue: (value: number) => string;
  label: string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <figure aria-label={label}>
      <div className="flex h-56 items-end gap-[2px] border-b border-line" dir="ltr">
        {data.map((item) => (
          <div key={item.key} className="group relative flex h-full flex-1 flex-col justify-end" tabIndex={0} aria-label={`${item.label}: ${formatValue(item.value)}`}>
            <span className="nums pointer-events-none absolute -top-7 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-surface-3 px-2 py-1 text-[11px] font-semibold text-ink shadow-card group-hover:block group-focus:block">
              {formatValue(item.value)}
            </span>
            <div
              className="mx-auto w-full max-w-10 rounded-t-[4px] bg-[#4d82ff] transition-opacity group-hover:opacity-80"
              style={{ height: `${Math.max(item.value ? 2 : 0, (item.value / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px]" dir="ltr">
        {data.map((item) => (
          <span key={item.key} className="nums flex-1 text-center text-[10px] text-ink-3">
            {item.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
