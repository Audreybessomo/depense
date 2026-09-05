import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser, voitTout } from "@/server/auth";
import {
  construireWhere, optionsReferentiels, pagination, OPTIONS_STATUT, type ParamsRecherche,
} from "@/server/filtres";
import { INCLUDE_LIGNE, TableDemandes } from "@/components/table-demandes";
import { BarreFiltres } from "@/components/filtres";
import { BoutonsExport } from "@/components/boutons-export";
import { Pagination } from "@/components/ui/pagination";
import { Card } from "@/components/ui/primitives";
import { Kpi } from "@/components/ui/kpi";
import { formatMoney } from "@/lib/money";
import { DEVISE_BASE } from "@/server/currency";

export const metadata = { title: "Toutes les dépenses" };

export default async function ToutesLesDemandes({
  searchParams,
}: {
  searchParams: Promise<ParamsRecherche>;
}) {
  const user = await requireUser();
  if (!voitTout(user.role)) redirect("/acces-refuse");

  const params = await searchParams;
  const { page, parPage, skip, take } = pagination(params, 30);
  const where = construireWhere(params);
  const { categories, departements } = await optionsReferentiels();

  const [demandes, total, agregat] = await Promise.all([
    prisma.expenseRequest.findMany({
      where, include: INCLUDE_LIGNE, orderBy: { createdAt: "desc" }, skip, take,
    }),
    prisma.expenseRequest.count({ where }),
    prisma.expenseRequest.aggregate({ where, _sum: { montantBase: true } }),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Toutes les dépenses</h1>
          <p className="doux text-sm">Recherche, filtres et export de l&apos;intégralité du registre.</p>
        </div>
        <Suspense fallback={null}>
          <BoutonsExport />
        </Suspense>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Kpi label="Dépenses correspondantes" valeur={String(total)} />
        <Kpi
          label={`Montant cumulé (${DEVISE_BASE})`}
          valeur={formatMoney(agregat._sum.montantBase ?? 0, DEVISE_BASE)}
          secondaire="Contre-valeur figée à la soumission"
        />
      </div>

      <Card>
        <div className="border-b px-5 py-3" style={{ borderColor: "var(--bordure)" }}>
          <Suspense fallback={null}>
            <BarreFiltres
              champs={[
                { nom: "statut", label: "Tous les statuts", options: OPTIONS_STATUT },
                { nom: "categoryId", label: "Toutes les catégories",
                  options: categories.map((c) => ({ valeur: c.id, label: c.nom })) },
                { nom: "departmentId", label: "Tous les services",
                  options: departements.map((d) => ({ valeur: d.id, label: d.nom })) },
              ]}
            />
          </Suspense>
        </div>
        <TableDemandes demandes={demandes} />
        <Pagination page={page} total={total} parPage={parPage} params={params} />
      </Card>
    </div>
  );
}
