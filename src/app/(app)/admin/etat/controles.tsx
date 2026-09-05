"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIODES, type PeriodKey } from "@/lib/dates";
import { PORTEES } from "@/lib/portees";
import { Champ, Select } from "@/components/ui/primitives";
import { Download, FileSpreadsheet, FolderArchive } from "lucide-react";

function Etiquette({ children }: { children: React.ReactNode }) {
  return (
    <label className="doux mb-1 block text-[10px] font-medium uppercase tracking-wide">
      {children}
    </label>
  );
}

export function ControlesEtat({
  departements, categories,
}: {
  departements: { id: string; nom: string }[];
  categories: { id: string; nom: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const periode = (params.get("periode") ?? "mois") as PeriodKey;

  const set = (cle: string, valeur: string) => {
    const p = new URLSearchParams(params.toString());
    if (valeur) p.set(cle, valeur);
    else p.delete(cle);
    router.replace(`${pathname}?${p.toString()}`);
  };

  const lien = (base: string, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    if (!p.has("periode")) p.set("periode", "mois");
    return `${base}?${p.toString()}`;
  };

  const bouton =
    "surface inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Etiquette>Période</Etiquette>
          <Select value={periode} onChange={(e) => set("periode", e.target.value)}
                  className="w-auto min-w-[170px]">
            {PERIODES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </Select>
        </div>

        {periode === "personnalise" ? (
          <>
            <div>
              <Etiquette>Du</Etiquette>
              <Champ type="date" defaultValue={params.get("du") ?? ""}
                     onChange={(e) => set("du", e.target.value)} className="w-auto" />
            </div>
            <div>
              <Etiquette>Au</Etiquette>
              <Champ type="date" defaultValue={params.get("au") ?? ""}
                     onChange={(e) => set("au", e.target.value)} className="w-auto" />
            </div>
          </>
        ) : null}

        <div>
          <Etiquette>Contenu de l&apos;état</Etiquette>
          <Select value={params.get("portee") ?? "engage"}
                  onChange={(e) => set("portee", e.target.value)}
                  className="w-auto min-w-[250px]">
            {PORTEES.map((p) => <option key={p.valeur} value={p.valeur}>{p.label}</option>)}
          </Select>
        </div>

        <div>
          <Etiquette>Service</Etiquette>
          <Select value={params.get("departmentId") ?? ""}
                  onChange={(e) => set("departmentId", e.target.value)}
                  className="w-auto min-w-[150px]">
            <option value="">Tous</option>
            {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </Select>
        </div>

        <div>
          <Etiquette>Catégorie</Etiquette>
          <Select value={params.get("categoryId") ?? ""}
                  onChange={(e) => set("categoryId", e.target.value)}
                  className="w-auto min-w-[150px]">
            <option value="">Toutes</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: "var(--bordure)" }}>
        <a href={lien("/api/export/dossier")}
           className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500">
          <FolderArchive className="h-4 w-4" />
          Dossier complet (ZIP)
        </a>
        <a href={lien("/api/export/demandes", { format: "xlsx" })} className={bouton}>
          <FileSpreadsheet className="h-4 w-4" />
          État seul (Excel)
        </a>
        <a href={lien("/api/export/demandes", { format: "csv" })} className={bouton}>
          <Download className="h-4 w-4" />
          État seul (CSV)
        </a>
      </div>
    </div>
  );
}
