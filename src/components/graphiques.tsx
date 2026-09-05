"use client";

import { useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip,
  XAxis, YAxis,
} from "recharts";
import { formatCompact, formatMoney } from "@/lib/money";
import { Table2, BarChart3 } from "lucide-react";

const AXE = { fontSize: 11, fill: "var(--viz-axe)" };

/**
 * Palette validee (bande de clarte, plancher chroma, separation CVD,
 * plancher vision normale) en clair et en sombre. Les series sont toujours
 * legendees et une vue tableau est disponible : la couleur ne porte jamais
 * seule l'information.
 */
/**
 * Quatre etats mutuellement exclusifs : leur somme fait le montant soumis sur
 * la periode. « Approuve » ne compte donc que ce qui n'est pas encore regle,
 * sinon un meme montant serait compte deux fois a l'oeil.
 *
 * L'ordre est celui du cycle de vie ; il a ete retenu parce qu'il passe la
 * separation daltonisme en clair, la ou l'ordre inverse echouait.
 */
const SERIES = [
  { cle: "regle", label: "Réglé", couleur: "var(--viz-regle)" },
  { cle: "approuve", label: "Approuvé, non réglé", couleur: "var(--viz-approuve)" },
  { cle: "attente", label: "En attente", couleur: "var(--viz-attente)" },
  { cle: "rejete", label: "Rejeté", couleur: "var(--viz-rejete)" },
] as const;

function Infobulle({ active, payload, label, devise }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="surface rounded-lg border px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 tabular-nums">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span className="doux">{p.name}</span>
          <span className="ml-auto font-medium">{formatMoney(p.value, devise)}</span>
        </p>
      ))}
    </div>
  );
}

function Legende() {
  return (
    <div className="flex flex-wrap items-center gap-4 px-1 pb-2 text-xs">
      {SERIES.map((s) => (
        <span key={s.cle} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.couleur }} />
          <span className="doux">{s.label}</span>
        </span>
      ))}
    </div>
  );
}

export type PointGraphique = {
  label: string;
  regle: number;
  approuve: number;
  attente: number;
  rejete: number;
  nb: number;
};

export function GraphiqueEvolution({
  donnees, devise,
}: {
  donnees: PointGraphique[];
  devise: string;
}) {
  const [vue, setVue] = useState<"graphique" | "tableau">("graphique");

  if (donnees.length === 0) {
    return <p className="doux px-5 py-12 text-center text-sm">Aucune donnée sur la période.</p>;
  }

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="mb-1 flex items-center justify-between">
        <Legende />
        <button
          onClick={() => setVue(vue === "graphique" ? "tableau" : "graphique")}
          className="doux inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          {vue === "graphique" ? <Table2 className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
          {vue === "graphique" ? "Voir le tableau" : "Voir le graphique"}
        </button>
      </div>

      {vue === "tableau" ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="doux border-b text-left" style={{ borderColor: "var(--bordure)" }}>
                <th className="py-2 pr-3 font-medium">Période</th>
                {SERIES.map((s) => (
                  <th key={s.cle} className="py-2 pr-3 text-right font-medium">{s.label}</th>
                ))}
                <th className="py-2 text-right font-medium">Demandes</th>
              </tr>
            </thead>
            <tbody>
              {donnees.map((d) => (
                <tr key={d.label} className="border-b last:border-0" style={{ borderColor: "var(--bordure)" }}>
                  <td className="py-1.5 pr-3">{d.label}</td>
                  {SERIES.map((s) => (
                    <td key={s.cle} className="py-1.5 pr-3 text-right tabular-nums">
                      {formatMoney(d[s.cle], devise)}
                    </td>
                  ))}
                  <td className="py-1.5 text-right tabular-nums">{d.nb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={donnees} margin={{ top: 8, right: 8, left: 8, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="0" vertical={false} stroke="var(--viz-grille)" />
            <XAxis dataKey="label" tick={AXE} tickLine={false} axisLine={{ stroke: "var(--viz-grille)" }} />
            <YAxis
              tick={AXE}
              tickLine={false}
              axisLine={false}
              width={72}
              tickFormatter={(v) => formatCompact(v, "").trim()}
            />
            <Tooltip content={<Infobulle devise={devise} />} cursor={{ fill: "var(--viz-grille)", opacity: 0.3 }} />
            {SERIES.map((s) => (
              <Bar key={s.cle} dataKey={s.cle} name={s.label} fill={s.couleur} radius={[4, 4, 0, 0]} maxBarSize={28} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export type PointRepartition = { nom: string; montant: number; nb: number };

/** Barres horizontales : la comparaison de longueurs bat le camembert. */
export function GraphiqueRepartition({
  donnees, devise, limite = 8,
}: {
  donnees: PointRepartition[];
  devise: string;
  limite?: number;
}) {
  if (donnees.length === 0) {
    return <p className="doux px-5 py-12 text-center text-sm">Aucune donnée sur la période.</p>;
  }

  const tete = donnees.slice(0, limite);
  const reste = donnees.slice(limite);
  const lignes = reste.length
    ? [...tete, {
        nom: `Autres (${reste.length})`,
        montant: reste.reduce((s, r) => s + r.montant, 0),
        nb: reste.reduce((s, r) => s + r.nb, 0),
      }]
    : tete;

  const max = Math.max(...lignes.map((l) => l.montant), 1);

  return (
    <ul className="space-y-2.5 px-5 py-4">
      {lignes.map((l) => (
        <li key={l.nom}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="truncate">{l.nom}</span>
            <span className="doux shrink-0 tabular-nums">
              {formatMoney(l.montant, devise)} · {l.nb}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${(l.montant / max) * 100}%`, background: "var(--viz-serie)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Entonnoir des statuts : combien de demandes franchissent chaque étape. */
export function Entonnoir({
  etapes,
}: {
  etapes: { label: string; nb: number }[];
}) {
  const max = Math.max(...etapes.map((e) => e.nb), 1);
  return (
    <ul className="space-y-2.5 px-5 py-4">
      {etapes.map((e) => (
        <li key={e.label} className="flex items-center gap-3">
          <span className="doux w-32 shrink-0 truncate text-xs">{e.label}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-800">
            <div
              className="flex h-full items-center justify-end rounded-md px-2 text-[11px] font-medium text-white"
              style={{ width: `${Math.max((e.nb / max) * 100, 6)}%`, background: "var(--viz-serie)" }}
            >
              {e.nb}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Cellule coloree du tableau croise service x mois. */
export function CelluleChaleur({ valeur, max, devise }: {
  valeur: number; max: number; devise: string;
}) {
  const intensite = max > 0 ? valeur / max : 0;
  return (
    <td
      className="px-2 py-1.5 text-right text-xs tabular-nums"
      style={{
        background: intensite > 0
          ? `color-mix(in srgb, var(--viz-serie) ${Math.round(intensite * 70)}%, transparent)`
          : undefined,
        color: intensite > 0.55 ? "#fff" : undefined,
      }}
      title={formatMoney(valeur, devise)}
    >
      {valeur > 0 ? formatCompact(valeur, "").trim() : "—"}
    </td>
  );
}
