import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, voitTout } from "@/server/auth";
import { calculerKpis, repartitionPar, serieTemporelle } from "@/server/reports";
import { DEVISE_BASE } from "@/server/currency";
import { resolvePeriod, formatDateHeure, formatMois } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader, Bouton } from "@/components/ui/primitives";
import { Kpi } from "@/components/ui/kpi";
import { GraphiqueEvolution, GraphiqueRepartition, Entonnoir } from "@/components/graphiques";
import { INCLUDE_LIGNE, TableDemandes } from "@/components/table-demandes";
import { BarChart3, ArrowRight } from "lucide-react";

export const metadata = { title: "Tableau de bord" };

export default async function TableauDeBord() {
  const user = await requireUser();
  if (!voitTout(user.role)) redirect("/acces-refuse");

  const annee = resolvePeriod("annee");
  const mois = resolvePeriod("mois");

  const [kpisAnnee, kpisMois, serie, parCategorie, recentes, aTraiter] = await Promise.all([
    calculerKpis(annee),
    calculerKpis(mois),
    serieTemporelle(annee, "month"),
    repartitionPar(annee, "categoryId"),
    prisma.expenseRequest.findMany({
      where: { statut: { not: "BROUILLON" } },
      include: INCLUDE_LIGNE,
      orderBy: { updatedAt: "desc" },
      take: 8,
    }),
    prisma.expenseRequest.findMany({
      where: { statut: "EN_ATTENTE" },
      include: INCLUDE_LIGNE,
      orderBy: { submittedAt: "asc" },
      take: 5,
    }),
  ]);

  // Les quatre séries ne se recouvrent pas : « approuvé » exclut ce qui est
  // déjà réglé, sinon un même montant apparaîtrait deux fois.
  const donneesGraphique = serie.map((p) => ({
    label: p.label,
    regle: p.paye,
    approuve: Math.max(0, p.approuve - p.paye),
    attente: Math.max(0, p.soumis - p.approuve - p.rejete),
    rejete: p.rejete,
    nb: p.nb,
  }));

  const delai = (h: number | null) =>
    h == null ? "—" : h < 24 ? `${h.toFixed(0)} h` : `${(h / 24).toFixed(1)} j`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Tableau de bord</h1>
          <p className="doux text-sm">
            Vue d&apos;ensemble — année {annee.label}, tous montants en {DEVISE_BASE}.
          </p>
        </div>
        <Link href="/admin/rapports">
          <Bouton variante="secondaire">
            <BarChart3 className="h-4 w-4" />
            Rapports détaillés
          </Bouton>
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label={`Approuvé — ${formatMois(new Date())}`}
          valeur={formatMoney(kpisMois.montantApprouve, DEVISE_BASE)}
          secondaire={`${kpisMois.nbApprouvees} dépense(s)`}
        />
        <Kpi
          label={`Réglé — ${formatMois(new Date())}`}
          valeur={formatMoney(kpisMois.montantPaye, DEVISE_BASE)}
          secondaire={`${kpisMois.nbPayees} dépense(s) sorties de caisse`}
        />
        <Kpi
          label={`Réglé — année ${annee.label}`}
          valeur={formatMoney(kpisAnnee.montantPaye, DEVISE_BASE)}
          secondaire={`${kpisAnnee.nbPayees} dépense(s)`}
        />
        <Kpi
          label="En attente de validation"
          valeur={formatMoney(kpisAnnee.montantEnAttente, DEVISE_BASE)}
          secondaire={`${kpisAnnee.nbEnAttente} dépense(s)`}
        />
        <Kpi
          label="Réglé, non confirmé"
          valeur={formatMoney(kpisAnnee.montantAConfirmer, DEVISE_BASE)}
          secondaire={`${kpisAnnee.nbAConfirmer} sans pièces définitives`}
        />
        <Kpi
          label="Délai médian de validation"
          valeur={delai(kpisAnnee.delaiMedianHeures)}
          secondaire={`moyenne ${delai(kpisAnnee.delaiMoyenHeures)}`}
        />
        <Kpi
          label="Taux de rejet (année)"
          valeur={`${kpisAnnee.tauxRejet.toFixed(1)} %`}
          secondaire={`${kpisAnnee.nbRejetees} rejetée(s)`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            titre={`Évolution mensuelle ${annee.label}`}
            description={`Montants en ${DEVISE_BASE}, par mois de soumission`}
          />
          <GraphiqueEvolution donnees={donneesGraphique} devise={DEVISE_BASE} />
        </Card>

        <Card>
          <CardHeader titre="Par catégorie" description="Montants approuvés sur l'année" />
          <GraphiqueRepartition donnees={parCategorie} devise={DEVISE_BASE} limite={7} />
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader titre="Entonnoir de l'année" description="Nombre de demandes par état" />
          <Entonnoir
            etapes={[
              { label: "Soumises", nb: kpisAnnee.nbTotal },
              { label: "Approuvées", nb: kpisAnnee.nbApprouvees },
              { label: "Réglées", nb: kpisAnnee.nbPayees },
              { label: "Confirmées", nb: kpisAnnee.nbPayees - kpisAnnee.nbAConfirmer },
              { label: "Rejetées", nb: kpisAnnee.nbRejetees },
            ]}
          />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            titre="Les plus anciennes en attente"
            description="À relancer en priorité"
            action={
              <Link href="/admin/demandes?statut=EN_ATTENTE"
                    className="doux inline-flex items-center gap-1 text-xs hover:underline">
                Tout voir <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <TableDemandes demandes={aTraiter} />
        </Card>
      </div>

      <Card>
        <CardHeader
          titre="Activité récente"
          description={`Dernière mise à jour ${formatDateHeure(recentes[0]?.updatedAt)}`}
          action={
            <Link href="/admin/demandes" className="doux inline-flex items-center gap-1 text-xs hover:underline">
              Toutes les demandes <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <TableDemandes demandes={recentes} />
      </Card>
    </div>
  );
}
