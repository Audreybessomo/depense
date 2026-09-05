"use client";

import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";

/** Reprend les filtres courants de l'URL pour que l'export corresponde a l'ecran. */
export function BoutonsExport({ base = "/api/export/demandes" }: { base?: string }) {
  const params = useSearchParams();

  const lien = (format: string) => {
    const p = new URLSearchParams(params.toString());
    p.set("format", format);
    return `${base}?${p.toString()}`;
  };

  const classe =
    "surface inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800";

  return (
    <div className="flex gap-2">
      <a href={lien("csv")} className={classe}>
        <Download className="h-3.5 w-3.5" />CSV
      </a>
      <a href={lien("xlsx")} className={classe}>
        <FileSpreadsheet className="h-3.5 w-3.5" />Excel
      </a>
    </div>
  );
}
