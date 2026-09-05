import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, peutRegler } from "@/server/auth";
import { INCLUDE_LIGNE, TableDemandes } from "@/components/table-demandes";
import { Card, CardHeader, Vide } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { DEVISE_BASE } from "@/server/currency";

export const metadata = { title: "À régler" };

export default async function Tresorerie() {
  const user = await requireUser();
  if (!peutRegler(user.role)) redirect("/acces-refuse");

  const [aRegler, aConfirmer, echues, payees] = await Promise.all([
    prisma.expenseRequest.findMany({
      where: { statut: "APPROUVEE" },
      include: INCLUDE_LIGNE,
      orderBy: [{ dateEcheance: "asc" }, { decidedAt: "asc" }],
    }),
    prisma.expenseRequest.findMany({
      where: { statut: "PAYEE" },
      include: INCLUDE_LIGNE,
      orderBy: { paidAt: "asc" },
    }),
    prisma.expenseRequest.count({
      where: { statut: "APPROUVEE", dateEcheance: { lt: new Date() } },
    }),
    prisma.expenseRequest.aggregate({
      where: { statut: { in: ["PAYEE", "CONFIRMEE"] } },
      _sum: { montantBase: true },
      _count: { _all: true },
    }),
  ]);

  const total = aRegler.reduce((s, d) => s + Number(d.montantBase), 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Dépenses à régler</h1>
        <p className="doux text-sm">
          Approuvées et en attente de paiement, triées par échéance.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="px-4 py-3.5">
          <p className="doux text-xs">À régler</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{aRegler.length}</p>
          <p className="doux mt-0.5 text-xs tabular-nums">{formatMoney(total, DEVISE_BASE)}</p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="doux text-xs">Réglées, en attente de confirmation</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${aConfirmer.length > 0 ? "text-amber-600" : ""}`}>
            {aConfirmer.length}
          </p>
          <p className="doux mt-0.5 text-xs">justificatifs définitifs attendus</p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="doux text-xs">Échéance dépassée</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${echues > 0 ? "text-rose-600" : ""}`}>
            {echues}
          </p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="doux text-xs">Déjà réglé (total)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatMoney(payees._sum.montantBase ?? 0, DEVISE_BASE)}
          </p>
          <p className="doux mt-0.5 text-xs">{payees._count._all} demande(s)</p>
        </Card>
      </div>

      <Card>
        <CardHeader titre="File de règlement"
                    description="Ouvrez une dépense pour saisir la référence du paiement." />
        <TableDemandes
          demandes={aRegler}
          vide={<Vide titre="Rien à régler" description="Aucune dépense approuvée en attente de paiement." />}
        />
      </Card>

      <Card>
        <CardHeader
          titre="Réglées, en attente de confirmation"
          description="Le demandeur doit confirmer la réception et rapporter ses pièces définitives."
        />
        <TableDemandes
          demandes={aConfirmer}
          vide={
            <Vide titre="Tout est confirmé"
                  description="Chaque dépense réglée a été confirmée par son demandeur." />
          }
        />
      </Card>
    </div>
  );
}
