// Pure helpers shared by the UI and covered by tests.

const DAY_MS = 86_400_000;

export const todayISO = () =>
  new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Whole days from today until an ISO date (negative = past), or null for no date. */
export const daysUntil = (iso) => {
  if (!iso) return null;
  return Math.ceil((new Date(iso + "T00:00:00") - new Date().setHours(0, 0, 0, 0)) / DAY_MS);
};

/** A provider's cost normalised to a monthly amount. Planned and cancelled count as 0. */
export const monthly = (r) => {
  const c = parseFloat(r.cost);
  if (!Number.isFinite(c) || r.status === "cancelled" || r.status === "planned") return 0;
  return r.period === "yearly" ? c / 12 : r.period === "free" ? 0 : c;
};

/** Days until a secret is due for rotation (negative = overdue), or null if it has no schedule. */
export const rotationIn = (s) => {
  if (!s.rotated || !s.rotateDays) return null;
  const d = new Date(s.rotated + "T00:00:00");
  d.setDate(d.getDate() + Number(s.rotateDays));
  return Math.ceil((d - new Date().setHours(0, 0, 0, 0)) / DAY_MS);
};

/**
 * Add starter entries that are missing and fill only the blank fields of existing ones,
 * so nothing the user typed is overwritten.
 */
export function mergeById(saved, seed) {
  const ids = new Set(saved.map((r) => r.id));
  const merged = saved.map((r) => {
    const s = seed.find((x) => x.id === r.id);
    if (!s) return r;
    const out = { ...r };
    for (const [k, v] of Object.entries(s)) {
      const empty =
        out[k] === undefined || out[k] === "" || (Array.isArray(out[k]) && !out[k].length);
      if (empty) out[k] = v;
    }
    return out;
  });
  return [...merged, ...seed.filter((s) => !ids.has(s.id))];
}
