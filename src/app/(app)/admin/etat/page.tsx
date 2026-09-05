import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser, voitTout } from "@/server/auth";
import { optionsReferentiels, type ParamsRecherche } from "@/server/filtres";
import { filtresEtat, libelleEtat, normaliserPortee } from "@/server/etat";
import { DEVISE_BASE } from "@/server/currency";
import { resolvePeriod, formatDate, type PeriodKey } from "@/lib/dates";
import { formatMoney, toNumber } from "@/lib/money";
import { Alerte, Card, CardHeader, Vide } from "@/components/ui/primitives";
import { Kpi } from "@/components/ui/kpi";
import { BadgeStatut } from "@/components/ui/statut";
import { ControlesEtat } from "./controles";
import { FileWarning, Paperclip, Printer } from "lucide-react";

export const metadata = { title: "État & justificatifs" };

const lire = (p: ParamsRecherche, c: string) => {
  const v = p[c];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
};

export default async function EtatDepenses({
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
  const portee = normaliserPortee(lire(params, "portee"));

  const where = filtresEtat({
    debut: periode.debut,
    fin: periode.fin,
    departmentId: lire(params, "departmentId") ?? null,
    categoryId: lire(params, "categoryId") ?? null,
    portee,
  });

  const { categories, departements } = await optionsReferentiels();

  const depenses = await prisma.expenseRequest.findMany({
    where,
    include: {
      demandeur: { select: { nom: true } },
      category: { select: { nom: true } },
      department: { select: { nom: true } },
      attachments: { select: { id: true, nature: true } },
      etapes: {
        where: { statut: { in: ["APPROUVEE", "REJETEE"] } },
        include: { approver: { select: { nom: true } } },
        orderBy: { ordre: "asc" },
      },
    },
    orderBy: [{ submittedAt: "asc" }],
    take: 2000,
  });

  const total = depenses.reduce((s, d) => s + toNumber(d.montantBase), 0);
  const totalPaye = depenses
    .filter((d) => d.statut === "PAYEE" || d.statut === "CONFIRMEE")
    .reduce((s, d) => s + toNumber(d.montantBase), 0);
  const aConfirmer = depenses.filter((d) => d.statut === "PAYEE");
  const sansPreuve = depenses.filter((d) => d.attachments.length === 0);
  const nbPieces = depenses.reduce((s, d) => s + d.attachments.length, 0);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">État des dépenses</h1>
        <p className="doux text-sm">
          {periode.label} — {libelleEtat(portee).toLowerCase()}. Le dossier ZIP contient
          l&apos;état et <strong>toutes les pièces justificatives</strong>, chacune nommée
          d&apos;après la référence de sa dépense.
        </p>
      </header>

      <Card className="no-print px-4 py-4">
        <Suspense fallback={null}>
          <ControlesEtat
            departements={departements.map((d) => ({ id: d.id, nom: d.nom }))}
            categories={categories.map((c) => ({ id: c.id, nom: c.nom }))}
          />
        </Suspense>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Dépenses retenues" valeur={String(depenses.length)}
             secondaire={`${nbPieces} justificatif(s)`} />
        <Kpi label={`Total (${DEVISE_BASE})`} valeur={formatMoney(total, DEVISE_BASE)} />
        <Kpi label={`Effectivement payé (${DEVISE_BASE})`}
             valeur={formatMoney(totalPaye, DEVISE_BASE)}
             secondaire={`${depenses.filter((d) => d.statut === "PAYEE" || d.statut === "CONFIRMEE").length} dépense(s)`} />
        <Kpi label="En attente de confirmation" valeur={String(aConfirmer.length)}
             secondaire={aConfirmer.length === 0 ? "toutes confirmées" : "pièces définitives attendues"} />
      </div>

      {aConfirmer.length > 0 ? (
        <Alerte type="info">
          <strong>{aConfirmer.length} dépense(s) réglée(s) non confirmée(s)</strong> :{" "}
          {aConfirmer.slice(0, 6).map((d) => d.numero).join(", ")}
          {aConfirmer.length > 6 ? `, et ${aConfirmer.length - 6} autre(s)` : ""}. Leur demandeur
          n&apos;a pas encore rapporté ses factures définitives ; elles sont listées dans
          <code className="mx-1 rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">
            CONFIRMATIONS-EN-ATTENTE.txt
          </code>
          du dossier ZIP.
        </Alerte>
      ) : null}

      {sansPreuve.length > 0 ? (
        <Alerte type="erreur">
          <span className="flex items-start gap-2">
            <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong>{sansPreuve.length} dépense(s) sans pièce justificative</strong> sur la
              période : {sansPreuve.slice(0, 6).map((d) => d.numero).join(", ")}
              {sansPreuve.length > 6 ? `, et ${sansPreuve.length - 6} autre(s)` : ""}. Elles
              apparaissent en rouge dans l&apos;état et sont listées dans le fichier
              <code className="mx-1 rounded bg-black/5 px-1 py-0.5 text-xs dark:bg-white/10">
                PIECES-MANQUANTES.txt
              </code>
              du dossier ZIP.
            </span>
          </span>
        </Alerte>
      ) : null}

      <Card>
        <CardHeader
          titre="Aperçu de l'état"
          description={`${depenses.length} ligne(s) — c'est exactement ce que contiendra le fichier`}
        />
        {depenses.length === 0 ? (
          <Vide titre="Aucune dépense sur cette période"
                description="Élargissez la période ou changez le contenu de l'état." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="doux border-b text-left text-xs" style={{ borderColor: "var(--bordure)" }}>
                  <th className="px-5 py-2.5 font-medium">Référence</th>
                  <th className="px-3 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Objet</th>
                  <th className="px-3 py-2.5 font-medium">Demandeur</th>
                  <th className="px-3 py-2.5 font-medium">Approuvée par</th>
                  <th className="px-3 py-2.5 text-right font-medium">Montant</th>
                  <th className="px-3 py-2.5 text-right font-medium">{DEVISE_BASE}</th>
                  <th className="px-3 py-2.5 text-center font-medium">Preuve</th>
                  <th className="px-5 py-2.5 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {depenses.map((d) => (
                  <tr key={d.id} className="border-b last:border-0" style={{ borderColor: "var(--bordure)" }}>
                    <td className="whitespace-nowrap px-5 py-2.5">
                      <Link href={`/demandes/${d.id}`} className="font-medium hover:underline">
                        {d.numero}
                      </Link>
                    </td>
                    <td className="doux whitespace-nowrap px-3 py-2.5 text-xs">
                      {formatDate(d.datePiece ?? d.submittedAt)}
                    </td>
                    <td className="max-w-xs px-3 py-2.5">
                      <span className="block truncate">{d.objet}</span>
                      <span className="doux text-xs">
                        {d.category?.nom ?? "Non catégorisé"} · {d.department?.nom ?? "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">{d.demandeur.nom}</td>
                    <td className="doux whitespace-nowrap px-3 py-2.5">
                      {d.etapes[0]?.approver.nom ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(d.montant, d.devise)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                      {formatMoney(d.montantBase, DEVISE_BASE)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {d.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600">
                          <Paperclip className="h-3.5 w-3.5" />
                          {d.attachments.length}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-rose-600">aucune</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5"><BadgeStatut statut={d.statut} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2" style={{ borderColor: "var(--bordure)" }}>
                  <td colSpan={6} className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    Total
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums">
                    {formatMoney(total, DEVISE_BASE)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      <p className="doux no-print flex items-center gap-1.5 text-xs">
        <Printer className="h-3.5 w-3.5" />
        Cette page s&apos;imprime telle quelle (Cmd/Ctrl + P) si vous voulez un PDF de l&apos;état
        seul, sans les pièces.
      </p>
    </div>
  );
}
