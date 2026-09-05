import { prisma } from "@/lib/prisma";
import { requireUser, peutApprouver } from "@/server/auth";
import { redirect } from "next/navigation";
import { INCLUDE_LIGNE, TableDemandes } from "@/components/table-demandes";
import { Card, CardHeader, Vide } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { DEVISE_BASE } from "@/server/currency";
import { joursOuvresEcoules } from "@/lib/dates";

export const metadata = { title: "À valider" };

export default async function Validations() {
  const user = await requireUser();
  if (!peutApprouver(user.role)) redirect("/acces-refuse");

  const [enAttente, traitees] = await Promise.all([
    prisma.expenseRequest.findMany({
      where: {
        statut: "EN_ATTENTE",
        etapes: { some: { approverId: user.id, statut: "EN_ATTENTE" } },
      },
      include: INCLUDE_LIGNE,
      orderBy: { submittedAt: "asc" },
    }),
    prisma.expenseRequest.findMany({
      where: {
        etapes: { some: { approverId: user.id, statut: { in: ["APPROUVEE", "REJETEE"] } } },
      },
      include: INCLUDE_LIGNE,
      orderBy: { decidedAt: "desc" },
      take: 20,
    }),
  ]);

  const montantEnAttente = enAttente.reduce((s, d) => s + Number(d.montantBase), 0);
  const plusAncienne = enAttente[0]?.submittedAt;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Dépenses à valider</h1>
        <p className="doux text-sm">
          Les plus anciennes en premier — c&apos;est l&apos;ordre dans lequel les traiter.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="px-4 py-3.5">
          <p className="doux text-xs">En attente de vous</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{enAttente.length}</p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="doux text-xs">Montant concerné</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {formatMoney(montantEnAttente, DEVISE_BASE)}
          </p>
        </Card>
        <Card className="px-4 py-3.5">
          <p className="doux text-xs">Attente la plus longue</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {plusAncienne ? `${joursOuvresEcoules(plusAncienne)} j` : "—"}
          </p>
        </Card>
      </div>

      <Card>
        <CardHeader titre="En attente de votre décision" />
        <TableDemandes
          demandes={enAttente}
          vide={
            <Vide titre="Rien à valider"
                  description="Toutes les dépenses qui vous étaient assignées ont été traitées." />
          }
        />
      </Card>

      {traitees.length > 0 ? (
        <Card>
          <CardHeader titre="Mes 20 dernières décisions" />
          <TableDemandes demandes={traitees} />
        </Card>
      ) : null}
    </div>
  );
}
