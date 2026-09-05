import "server-only";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Limiteur en memoire : suffisant pour une instance unique. En cas de
 * deploiement multi-instances, remplacer la Map par Redis ou une table.
 */
export function rateLimit(cle: string, max: number, fenetreMs: number) {
  const now = Date.now();
  const b = buckets.get(cle);

  if (!b || b.resetAt < now) {
    buckets.set(cle, { count: 1, resetAt: now + fenetreMs });
    return { ok: true, restant: max - 1, resetDans: fenetreMs };
  }
  b.count += 1;
  if (b.count > max) {
    return { ok: false, restant: 0, resetDans: b.resetAt - now };
  }
  return { ok: true, restant: max - b.count, resetDans: b.resetAt - now };
}

// Purge periodique pour eviter la croissance illimitee de la Map.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  }, 60_000).unref?.();
}
