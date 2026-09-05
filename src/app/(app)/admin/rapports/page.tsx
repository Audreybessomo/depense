import { redirect } from "next/navigation";
import { Suspense } from "react";
import { requireUser, voitTout } from "@/server/auth";
import { optionsReferentiels, type ParamsRecherche } from "@/server/filtres";
import {
  calculerKpis, croiseServiceMois, performanceApprobateurs, repartitionPar, serieTemporelle,
  type FiltresRapport,
} from "@/server/reports";
import { DEVISE_BASE } from "@/server/currency";
import { periodePrecedente, resolvePeriod, type PeriodKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card, CardHeader } from "@/components/ui/primitives";
import { Kpi } from "@/components/ui/kpi";
import { SelecteurPeriode } from "@/components/selecteur-periode";
import { BoutonsExport } from "@/components/boutons-export";
import { CelluleChaleur, GraphiqueEvolution, GraphiqueRepartition } from "@/components/graphiques";
import { Printer } from "lucide-react";

export const metadata = { title: "Rapports" };

const lire = (p: ParamsRecherche, c: string) => {
  const v = p[c];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
};

const variation = (courant: number, precedent: number) =>
  precedent === 0 ? null : ((courant - precedent) / precedent) * 100;

const delai = (h: number | null) =>
  h == null ? "—" : h < 24 ? `${h.toFixed(0)} h` : `${(h / 24).toFixed(1)} j`;

export default async function Rapports({
  searchParams,
}: {
  searchParams: Promise<ParamsRecherche>;
}) {
  const user = await requireUser();
  if (!voitTout(user.role)) redirect("/acces-refuse");

  const params = await searchParams;
  const periode = resolvePeriod(
    (lire(params, "periode") ?? "mois") as PeriodKey,
    lire(params, "du"),
    lire(params, "au"),
  );
  const granularite = (lire(params, "granularite") ?? "month") as "day" | "month" | "year";

  const filtres: FiltresRapport = {
    debut: periode.debut,
    fin: periode.fin,
    departmentId: lire(params, "departmentId") ?? null,
    categoryId: lire(params, "categoryId") ?? null,
  };
  const precedent = periodePrecedente(periode.debut, periode.fin);

  const { categories, departements } = await optionsReferentiels();

  const [kpis, kpisN1, serie, parCategorie, parService, parDemandeur, perfs, croise] =
    await Promise.all([
      calculerKpis(filtres),
      calculerKpis({ ...filtres, debut: precedent.debut, fin: precedent.fin }),
      serieTemporelle(filtres, granularite),
      repartitionPar(filtres, "categoryId"),
      repartitionPar(filtres, "departmentId"),
      repartitionPar(filtres, "demandeurId"),
      performanceApprobateurs(filtres),
      croiseServiceMois(filtres),
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

  // Tableau croise service x mois
  const moisCroise = [...new Set(croise.map((c) => c.mois.toISOString()))].sort();
  const services = [...new Set(croise.map((c) => c.service))].sort();
  const valeur = (s: string, m: string) =>
    croise.find((c) => c.service === s && c.mois.toISOString() === m)?.montant ?? 0;
  const maxCroise = Math.max(...croise.map((c) => c.montant), 1);
  const fmtMois = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Rapports</h1>
          <p className="doux text-sm">
            {periode.label} — montants exprimés en {DEVISE_BASE}, comparaison avec la même
            période l&apos;an dernier.
          </p>
        </div>
        <div className="no-print flex items-center gap-2">
          <Suspense fallback={null}><BoutonsExport /></Suspense>
        </div>
      </header>

      <Card className="no-print px-4 py-3">
        <Suspense fallback={null}>
          <SelecteurPeriode
            departements={departements.map((d) => ({ id: d.id, nom: d.nom }))}
            categories={categories.map((c) => ({ id: c.id, nom: c.nom }))}
          />
        </Suspense>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Montant soumis"
          valeur={formatMoney(kpis.montantTotal, DEVISE_BASE)}
          secondaire={`${kpis.nbTotal} demande(s)`}
          variation={variation(kpis.montantTotal, kpisN1.montantTotal)}
        />
        <Kpi
          label="Montant approuvé"
          valeur={formatMoney(kpis.montantApprouve, DEVISE_BASE)}
          secondaire={`${kpis.nbApprouvees} demande(s)`}
          variation={variation(kpis.montantApprouve, kpisN1.montantApprouve)}
        />
        <Kpi
          label="Montant réglé"
          valeur={formatMoney(kpis.montantPaye, DEVISE_BASE)}
          secondaire={`${kpis.nbPayees} demande(s)`}
          variation={variation(kpis.montantPaye, kpisN1.montantPaye)}
        />
        <Kpi
          label="Reste à valider"
          valeur={formatMoney(kpis.montantEnAttente, DEVISE_BASE)}
          secondaire={`${kpis.nbEnAttente} demande(s)`}
        />
        <Kpi
          label="Taux de rejet"
          valeur={`${kpis.tauxRejet.toFixed(1)} %`}
          secondaire={`${kpis.nbRejetees} rejetée(s)`}
          variation={variation(kpis.tauxRejet, kpisN1.tauxRejet)}
          inverse
        />
        <Kpi
          label="Délai médian de décision"
          valeur={delai(kpis.delaiMedianHeures)}
          secondaire={`moyenne ${delai(kpis.delaiMoyenHeures)}`}
          variation={
            kpis.delaiMedianHeures != null && kpisN1.delaiMedianHeures != null
              ? variation(kpis.delaiMedianHeures, kpisN1.delaiMedianHeures)
              : null
          }
          inverse
        />
        <Kpi
          label="Réglé, non confirmé"
          valeur={formatMoney(kpis.montantAConfirmer, DEVISE_BASE)}
          secondaire={`${kpis.nbAConfirmer} dépense(s) sans pièces définitives`}
        />
        <Kpi
          label="Ticket moyen"
          valeur={formatMoney(
            kpis.nbApprouvees > 0 ? kpis.montantApprouve / kpis.nbApprouvees : 0,
            DEVISE_BASE,
          )}
          secondaire="sur les demandes approuvées"
        />
      </div>

      <Card>
        <CardHeader
          titre="Évolution"
          description={`Montants par ${granularite === "day" ? "jour" : granularite === "year" ? "année" : "mois"} de soumission`}
        />
        <GraphiqueEvolution donnees={donneesGraphique} devise={DEVISE_BASE} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader titre="Par catégorie" description="Montants approuvés" />
          <GraphiqueRepartition donnees={parCategorie} devise={DEVISE_BASE} />
        </Card>
        <Card>
          <CardHeader titre="Par service" description="Montants approuvés" />
          <GraphiqueRepartition donnees={parService} devise={DEVISE_BASE} />
        </Card>
        <Card>
          <CardHeader titre="Top demandeurs" description="Montants approuvés" />
          <GraphiqueRepartition donnees={parDemandeur} devise={DEVISE_BASE} limite={10} />
        </Card>
      </div>

      {services.length > 0 ? (
        <Card>
          <CardHeader
            titre="Service × mois"
            description={`Montants approuvés en ${DEVISE_BASE} — survolez une cellule pour le détail`}
          />
          <div className="overflow-x-auto px-5 py-4">
            <table className="w-full min-w-[520px] text-xs">
              <thead>
                <tr className="doux border-b text-left" style={{ borderColor: "var(--bordure)" }}>
                  <th className="py-2 pr-3 font-medium">Service</th>
                  {moisCroise.map((m) => (
                    <th key={m} className="px-2 py-2 text-right font-medium">
                      {fmtMois.format(new Date(m))}
                    </th>
                  ))}
                  <th className="pl-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => {
                  const total = moisCroise.reduce((acc, m) => acc + valeur(s, m), 0);
                  return (
                    <tr key={s} className="border-b last:border-0" style={{ borderColor: "var(--bordure)" }}>
                      <td className="py-1.5 pr-3">{s}</td>
                      {moisCroise.map((m) => (
                        <CelluleChaleur key={m} valeur={valeur(s, m)} max={maxCroise} devise={DEVISE_BASE} />
                      ))}
                      <td className="pl-3 text-right font-medium tabular-nums">
                        {formatMoney(total, DEVISE_BASE)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          titre="Performance des approbateurs"
          description="Délai médian entre l'assignation et la décision"
        />
        {perfs.length === 0 ? (
          <p className="doux px-5 py-8 text-center text-sm">Aucune validation sur la période.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="doux border-b text-left text-xs" style={{ borderColor: "var(--bordure)" }}>
                  <th className="px-5 py-2.5 font-medium">Approbateur</th>
                  <th className="px-3 py-2.5 text-right font-medium">Traitées</th>
                  <th className="px-3 py-2.5 text-right font-medium">Approuvées</th>
                  <th className="px-3 py-2.5 text-right font-medium">Rejetées</th>
                  <th className="px-3 py-2.5 text-right font-medium">En attente</th>
                  <th className="px-5 py-2.5 text-right font-medium">Délai médian</th>
                </tr>
              </thead>
              <tbody>
                {perfs.map((p) => (
                  <tr key={p.id} className="border-b last:border-0" style={{ borderColor: "var(--bordure)" }}>
                    <td className="px-5 py-2.5">{p.nom}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.traitees}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.approuvees}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.rejetees}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${p.enAttente > 0 ? "font-medium text-amber-600" : ""}`}>
                      {p.enAttente}
                    </td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{delai(p.delaiMedianHeures)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="doux no-print flex items-center gap-1.5 text-xs">
        <Printer className="h-3.5 w-3.5" />
        Utilisez l&apos;impression du navigateur (Cmd/Ctrl + P) pour générer un PDF de ce rapport.
      </p>
    </div>
  );
}
