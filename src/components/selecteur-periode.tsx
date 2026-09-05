"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PERIODES, type PeriodKey } from "@/lib/dates";
import { Champ, Select } from "@/components/ui/primitives";
import { CalendarRange } from "lucide-react";

const GRANULARITES = [
  { valeur: "day", label: "Par jour" },
  { valeur: "month", label: "Par mois" },
  { valeur: "year", label: "Par année" },
];

export function SelecteurPeriode({
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

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div>
        <label className="doux mb-1 block text-[10px] font-medium uppercase tracking-wide">
          Période
        </label>
        <Select value={periode} onChange={(e) => set("periode", e.target.value)}
                className="w-auto min-w-[170px]">
          {PERIODES.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </Select>
      </div>

      {periode === "personnalise" ? (
        <>
          <div>
            <label className="doux mb-1 block text-[10px] font-medium uppercase tracking-wide">Du</label>
            <Champ type="date" defaultValue={params.get("du") ?? ""}
                   onChange={(e) => set("du", e.target.value)} className="w-auto" />
          </div>
          <div>
            <label className="doux mb-1 block text-[10px] font-medium uppercase tracking-wide">Au</label>
            <Champ type="date" defaultValue={params.get("au") ?? ""}
                   onChange={(e) => set("au", e.target.value)} className="w-auto" />
          </div>
        </>
      ) : null}

      <div>
        <label className="doux mb-1 block text-[10px] font-medium uppercase tracking-wide">
          Granularité
        </label>
        <Select value={params.get("granularite") ?? "month"}
                onChange={(e) => set("granularite", e.target.value)}
                className="w-auto min-w-[130px]">
          {GRANULARITES.map((g) => (
            <option key={g.valeur} value={g.valeur}>{g.label}</option>
          ))}
        </Select>
      </div>

      <div>
        <label className="doux mb-1 block text-[10px] font-medium uppercase tracking-wide">Service</label>
        <Select value={params.get("departmentId") ?? ""}
                onChange={(e) => set("departmentId", e.target.value)}
                className="w-auto min-w-[150px]">
          <option value="">Tous</option>
          {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </Select>
      </div>

      <div>
        <label className="doux mb-1 block text-[10px] font-medium uppercase tracking-wide">Catégorie</label>
        <Select value={params.get("categoryId") ?? ""}
                onChange={(e) => set("categoryId", e.target.value)}
                className="w-auto min-w-[150px]">
          <option value="">Toutes</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </Select>
      </div>

      <span className="doux hidden items-center gap-1 pb-2.5 text-xs sm:flex">
        <CalendarRange className="h-3.5 w-3.5" />
        Les filtres se retrouvent dans l&apos;export.
      </span>
    </div>
  );
}
