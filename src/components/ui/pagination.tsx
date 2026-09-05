import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({
  page, total, parPage, params,
}: {
  page: number;
  total: number;
  parPage: number;
  params: Record<string, string | string[] | undefined>;
}) {
  const pages = Math.max(1, Math.ceil(total / parPage));
  if (pages <= 1) return null;

  const lien = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string" && v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  };

  const debut = (page - 1) * parPage + 1;
  const fin = Math.min(page * parPage, total);

  return (
    <div className="flex items-center justify-between border-t px-5 py-3 text-xs"
         style={{ borderColor: "var(--bordure)" }}>
      <span className="doux">
        {debut}–{fin} sur {total}
      </span>
      <div className="flex gap-1">
        {Array.from({ length: pages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === pages || Math.abs(p - page) <= 1)
          .map((p, i, arr) => (
            <span key={p} className="flex items-center gap-1">
              {i > 0 && arr[i - 1] !== p - 1 ? <span className="doux px-1">…</span> : null}
              <Link
                href={lien(p)}
                className={cn(
                  "rounded-md px-2.5 py-1",
                  p === page
                    ? "bg-slate-900 text-white dark:bg-indigo-600"
                    : "doux hover:bg-slate-100 dark:hover:bg-slate-800",
                )}
              >
                {p}
              </Link>
            </span>
          ))}
      </div>
    </div>
  );
}
