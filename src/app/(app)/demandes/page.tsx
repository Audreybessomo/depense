import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { construireWhere, optionsReferentiels, pagination, OPTIONS_STATUT, type ParamsRecherche } from "@/server/filtres";
import { INCLUDE_LIGNE, TableDemandes } from "@/components/table-demandes";
import { BarreFiltres } from "@/components/filtres";
import { Pagination } from "@/components/ui/pagination";
import { Bouton, Card, Vide } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { DEVISE_BASE } from "@/server/currency";
import { Plus } from "lucide-react";

export const metadata = { title: "Mes dépenses" };

export default async function MesDemandes({
  searchParams,
}: {
  searchParams: Promise<ParamsRecherche>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const { page, parPage, skip, take } = pagination(params);
  const where = construireWhere(params, { demandeurId: user.id });
  const { categories } = await optionsReferentiels();

  const [demandes, total, agregats] = await Promise.all([
    prisma.expenseRequest.findMany({
      where, include: INCLUDE_LIGNE, orderBy: { createdAt: "desc" }, skip, take,
    }),
    prisma.expenseRequest.count({ where }),
    prisma.expenseRequest.groupBy({
      by: ["statut"],
      where: { demandeurId: user.id },
      _count: { _all: true },
      _sum: { montantBase: true },
    }),
  ]);

  const par = (s: string) => agregats.find((a) => a.statut === s);
  const cartes = [
    { label: "En attente de validation", valeur: par("EN_ATTENTE")?._count._all ?? 0,
      montant: par("EN_ATTENTE")?._sum.montantBase },
    { label: "Approuvées", valeur: (par("APPROUVEE")?._count._all ?? 0) + (par("PAYEE")?._count._all ?? 0),
      montant: Number(par("APPROUVEE")?._sum.montantBase ?? 0) + Number(par("PAYEE")?._sum.montantBase ?? 0) },
    { label: "À compléter", valeur: (par("INFO_DEMANDEE")?._count._all ?? 0) + (par("BROUILLON")?._count._all ?? 0), montant: null },
    { label: "Rejetées", valeur: par("REJETEE")?._count._all ?? 0, montant: par("REJETEE")?._sum.montantBase },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Mes dépenses</h1>
          <p className="doux text-sm">Suivez l&apos;avancement des dépenses que vous avez engagées.</p>
        </div>
        <Link href="/demandes/nouvelle">
          <Bouton><Plus className="h-4 w-4" />Nouvelle dépense</Bouton>
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cartes.map((c) => (
          <Card key={c.label} className="px-4 py-3.5">
            <p className="doux text-xs">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{c.valeur}</p>
            {c.montant !== null && c.montant !== undefined ? (
              <p className="doux mt-0.5 text-xs tabular-nums">
                {formatMoney(c.montant, DEVISE_BASE)}
              </p>
            ) : null}
          </Card>
        ))}
      </div>

      <Card>
        <div className="border-b px-5 py-3" style={{ borderColor: "var(--bordure)" }}>
          <BarreFiltres
            champs={[
              { nom: "statut", label: "Tous les statuts", options: OPTIONS_STATUT },
              { nom: "categoryId", label: "Toutes les catégories",
                options: categories.map((c) => ({ valeur: c.id, label: c.nom })) },
            ]}
          />
        </div>
        <TableDemandes
          demandes={demandes}
          colonneDemandeur={false}
          vide={
            <Vide
              titre="Aucune dépense pour l'instant"
              description="Créez votre première dépense : chargez le justificatif, indiquez le montant et assignez-la à votre approbateur."
              action={<Link href="/demandes/nouvelle"><Bouton>Créer une dépense</Bouton></Link>}
            />
          }
        />
        <Pagination page={page} total={total} parPage={parPage} params={params} />
      </Card>
    </div>
  );
}
