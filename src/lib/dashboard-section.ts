/**
 * One Console Home section's data. `null` = the role may not see it (it is
 * never loaded); `{ ok: false }` = loading failed (shown as "unavailable",
 * never as zero); `{ ok: true, data }` = real data.
 */
export type Section<T> = { ok: true; data: T } | { ok: false };
export type Gated<T> = Section<T> | null;

export async function loadSection<T>(allowed: boolean, label: string, run: () => Promise<T>): Promise<Gated<T>> {
  if (!allowed) return null;

  try {
    return { ok: true, data: await run() };
  } catch (error) {
    console.error(`DASHBOARD_${label}_ERROR:`, error);
    return { ok: false };
  }
}
