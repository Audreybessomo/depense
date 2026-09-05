"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Champ, Select } from "@/components/ui/primitives";
import { Search } from "lucide-react";

export type OptionFiltre = { valeur: string; label: string };

/**
 * Filtres pilotes par l'URL : l'etat vit dans les searchParams, ce qui rend
 * chaque vue filtree partageable et rechargeable telle quelle.
 */
export function BarreFiltres({
  champs, recherche = true,
}: {
  champs: { nom: string; label: string; options: OptionFiltre[] }[];
  recherche?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const set = useCallback(
    (cle: string, valeur: string) => {
      const p = new URLSearchParams(params.toString());
      if (valeur) p.set(cle, valeur);
      else p.delete(cle);
      p.delete("page");
      router.replace(`${pathname}?${p.toString()}`);
    },
    [params, pathname, router],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {recherche ? (
        <div className="relative min-w-[200px] flex-1">
          <Search className="doux pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Champ
            defaultValue={params.get("q") ?? ""}
            onChange={(e) => set("q", e.target.value)}
            placeholder="Référence, objet, demandeur…"
            className="pl-9"
          />
        </div>
      ) : null}

      {champs.map((c) => (
        <Select
          key={c.nom}
          defaultValue={params.get(c.nom) ?? ""}
          onChange={(e) => set(c.nom, e.target.value)}
          className="w-auto min-w-[150px]"
          aria-label={c.label}
        >
          <option value="">{c.label}</option>
          {c.options.map((o) => (
            <option key={o.valeur} value={o.valeur}>{o.label}</option>
          ))}
        </Select>
      ))}
    </div>
  );
}
