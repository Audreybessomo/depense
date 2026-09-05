import Link from "next/link";
import { notFound } from "next/navigation";
import { circuitApplicable } from "@/server/circuit";
import { requireUser, peutRegler } from "@/server/auth";
import {
  etapeEnAttentePour, getDemande, peutModifierDemande, peutVoirDemande,
} from "@/server/requests";
import { Alerte, Bouton, Card, CardHeader, Vide } from "@/components/ui/primitives";
import { BadgeStatut, LIBELLE_ETAPE } from "@/components/ui/statut";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { formatDate, formatDateHeure } from "@/lib/dates";
import { formatMoney, toNumber } from "@/lib/money";
import { annuler, supprimerPieceJointe } from "../actions";
import {
  FormulaireCommentaire, PanneauConfirmation, PanneauDecision, PanneauPaiement,
  PanneauSoumission, Visionneuse,
} from "./composants";
import {
  Check, ChevronLeft, Clock, FileText, HelpCircle, Pencil, Trash2, X,
} from "lucide-react";

export const metadata = { title: "Détail de la dépense" };

const MESSAGES: Record<string, string> = {
  soumise: "Dépense envoyée pour validation. L'approbateur a reçu un email.",
  enregistree: "Brouillon enregistré.",
};

export default async function DetailDemande({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; probleme?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { ok, probleme } = await searchParams;

  const d = await getDemande(id);
  if (!d || !peutVoirDemande(user, d)) notFound();

  const monEtape = etapeEnAttentePour(user, d);
  const peutDecider = Boolean(monEtape) && d.statut === "EN_ATTENTE";
  const peutModifier = peutModifierDemande(user, d);
  const reglementPossible = d.statut === "APPROUVEE" && peutRegler(user.role);
  const confirmationAttendue = d.statut === "PAYEE" && d.demandeurId === user.id;

  // Les pièces de la demande et celles rapportées après le règlement sont
  // deux moments de preuve distincts : on ne les mélange pas à l'écran.
  const piecesDemande = d.attachments.filter((pj) => pj.nature === "DEMANDE");
  const piecesConfirmation = d.attachments.filter((pj) => pj.nature === "CONFIRMATION");
  const peutAnnuler =
    (d.demandeurId === user.id || user.role === "ADMIN") &&
    ["BROUILLON", "EN_ATTENTE", "INFO_DEMANDEE"].includes(d.statut);

  // Le circuit du demandeur, pour l'afficher avant soumission.
  const circuit =
    d.statut === "BROUILLON" || d.statut === "INFO_DEMANDEE"
      ? await circuitApplicable(d.demandeurId)
      : [];

  const infos: [string, React.ReactNode][] = [
    ["Demandeur", d.demandeur.nom],
    ["Service", d.department?.nom ?? "—"],
    ["Catégorie", d.category?.nom ?? "—"],
    ["N° de la pièce", d.numeroPiece ?? "—"],
    ["Date de la dépense", formatDate(d.datePiece)],
    ["Échéance", formatDate(d.dateEcheance)],
    ["Montant", formatMoney(d.montant, d.devise)],
  ];

  if (d.devise !== d.deviseBase && toNumber(d.montantBase) > 0) {
    infos.push([
      `Contre-valeur ${d.deviseBase}`,
      <span key="cv" title={`Taux figé : 1 ${d.devise} = ${toNumber(d.tauxChange)} ${d.deviseBase}`}>
        {formatMoney(d.montantBase, d.deviseBase)}
      </span>,
    ]);
  }
  if (d.confirmedAt) {
    infos.push(["Confirmée le", formatDateHeure(d.confirmedAt)]);
  }
  if (d.paidAt) {
    infos.push(["Payée le", formatDateHeure(d.paidAt)], ["Référence de règlement", d.paymentRef ?? "—"]);
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/demandes" className="doux mb-2 inline-flex items-center gap-1 text-xs hover:underline">
            <ChevronLeft className="h-3.5 w-3.5" />
            Retour
          </Link>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg font-semibold tracking-tight">{d.numero}</h1>
            <BadgeStatut statut={d.statut} />
          </div>
          <p className="doux mt-0.5 truncate text-sm">{d.objet}</p>
        </div>

        <div className="flex items-center gap-2">
          {peutModifier ? (
            <Link href={`/demandes/${d.id}/modifier`}>
              <Bouton variante="secondaire" taille="sm">
                <Pencil className="h-3.5 w-3.5" />Modifier
              </Bouton>
            </Link>
          ) : null}
          {peutAnnuler ? (
            <form action={annuler}>
              <input type="hidden" name="requestId" value={d.id} />
              <BoutonSoumettre variante="secondaire" taille="sm"
                               confirmation="Annuler définitivement cette demande ?">
                Annuler
              </BoutonSoumettre>
            </form>
          ) : null}
          <div className="text-right">
            <p className="doux text-[11px]">Montant</p>
            <p className="text-xl font-semibold tabular-nums">
              {formatMoney(d.montant, d.devise)}
            </p>
          </div>
        </div>
      </header>

      {probleme ? (
        <Alerte type="erreur">
          <strong>Votre saisie et vos justificatifs sont enregistrés</strong> — mais la
          dépense n&apos;a pas pu partir en validation : {probleme}
        </Alerte>
      ) : null}
      {ok && MESSAGES[ok] ? <Alerte type="succes">{MESSAGES[ok]}</Alerte> : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="overflow-hidden">
            <CardHeader
              titre="Justificatif de la dépense"
              description={`${piecesDemande.length} fichier${piecesDemande.length > 1 ? "s" : ""} joint(s) à la demande`}
            />
            {piecesDemande.length > 0 ? (
              <Visionneuse pieces={piecesDemande} />
            ) : (
              <Vide titre="Aucun justificatif"
                    description="Aucune preuve n'a encore été chargée sur cette dépense." />
            )}
          </Card>

          {piecesConfirmation.length > 0 ? (
            <Card className="overflow-hidden border-teal-300 dark:border-teal-800">
              <CardHeader
                titre="Pièces rapportées après le règlement"
                description={
                  d.confirmedAt
                    ? `Confirmées par ${d.demandeur.nom} le ${formatDateHeure(d.confirmedAt)}`
                    : undefined
                }
              />
              {d.confirmationNote ? (
                <p className="border-b px-5 py-3 text-sm leading-relaxed"
                   style={{ borderColor: "var(--bordure)" }}>
                  <span className="doux text-xs">Message du demandeur — </span>
                  {d.confirmationNote}
                </p>
              ) : null}
              <Visionneuse pieces={piecesConfirmation} />
            </Card>
          ) : null}

          {peutModifier && piecesDemande.length > 0 ? (
            <Card>
              <CardHeader titre="Gérer les justificatifs" />
              <ul className="divide-y" style={{ borderColor: "var(--bordure)" }}>
                {piecesDemande.map((pj) => (
                  <li key={pj.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <FileText className="doux h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{pj.filename}</span>
                    <span className="doux text-xs tabular-nums">{(pj.taille / 1024).toFixed(0)} Ko</span>
                    <form action={supprimerPieceJointe}>
                      <input type="hidden" name="attachmentId" value={pj.id} />
                      <BoutonSoumettre variante="fantome" taille="sm"
                                       confirmation={`Supprimer « ${pj.filename} » ?`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </BoutonSoumettre>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {d.description ? (
            <Card>
              <CardHeader titre="Note du demandeur" />
              <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed">{d.description}</p>
            </Card>
          ) : null}

          <Card>
            <CardHeader titre="Échanges" description={`${d.commentaires.length} message(s)`} />
            {d.commentaires.length === 0 ? (
              <p className="doux px-5 py-6 text-center text-sm">Aucun échange pour le moment.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: "var(--bordure)" }}>
                {d.commentaires.map((c) => (
                  <li key={c.id} className="px-5 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{c.user.nom}</span>
                      <span className="doux text-xs">{formatDateHeure(c.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.corps}</p>
                  </li>
                ))}
              </ul>
            )}
            <FormulaireCommentaire requestId={d.id} />
          </Card>
        </div>

        <div className="space-y-5">
          {confirmationAttendue ? (
            <Card className="border-teal-400 dark:border-teal-700">
              <CardHeader
                titre="Confirmez la réception"
                description="La dépense a été réglée. Joignez vos factures définitives et laissez un message pour la clôturer."
              />
              <PanneauConfirmation requestId={d.id} />
            </Card>
          ) : null}

          {d.statut === "PAYEE" && d.demandeurId !== user.id ? (
            <Alerte type="info">
              Réglée le {formatDateHeure(d.paidAt)} — en attente de la confirmation et des
              pièces définitives de {d.demandeur.nom}.
            </Alerte>
          ) : null}

          {peutDecider ? (
            <Card className="border-amber-300 dark:border-amber-800">
              <CardHeader titre="Votre décision"
                          description="Cette demande attend votre validation." />
              <PanneauDecision requestId={d.id} />
            </Card>
          ) : null}

          {(d.statut === "BROUILLON" || d.statut === "INFO_DEMANDEE") && d.demandeurId === user.id ? (
            <Card>
              <CardHeader
                titre={d.statut === "INFO_DEMANDEE" ? "Resoumettre" : "Soumettre"}
                description={
                  d.statut === "INFO_DEMANDEE"
                    ? "Répondez dans les échanges puis renvoyez la dépense."
                    : "Elle partira vers les approbateurs désignés pour votre compte."
                }
              />
              <PanneauSoumission requestId={d.id} circuit={circuit} />
            </Card>
          ) : null}

          {reglementPossible ? (
            <Card>
              <CardHeader titre="Règlement" description="Demande approuvée, prête à être payée." />
              <PanneauPaiement requestId={d.id} />
            </Card>
          ) : null}

          <Card>
            <CardHeader titre="Suivi de la validation" />
            <ol className="space-y-0 px-5 py-4">
              <Etape
                icone={<Check className="h-3.5 w-3.5" />}
                couleur="bg-slate-900 text-white dark:bg-indigo-600"
                titre="Demande créée"
                sousTitre={`${d.demandeur.nom} · ${formatDateHeure(d.createdAt)}`}
                dernier={d.etapes.length === 0}
              />
              {d.submittedAt ? (
                <Etape
                  icone={<Check className="h-3.5 w-3.5" />}
                  couleur="bg-slate-900 text-white dark:bg-indigo-600"
                  titre="Soumise pour validation"
                  sousTitre={formatDateHeure(d.submittedAt)}
                  dernier={d.etapes.length === 0}
                />
              ) : null}
              {d.etapes.map((e, i) => (
                <Etape
                  key={e.id}
                  icone={
                    e.statut === "APPROUVEE" ? <Check className="h-3.5 w-3.5" />
                    : e.statut === "REJETEE" ? <X className="h-3.5 w-3.5" />
                    : e.statut === "INFO_DEMANDEE" ? <HelpCircle className="h-3.5 w-3.5" />
                    : <Clock className="h-3.5 w-3.5" />
                  }
                  couleur={
                    e.statut === "APPROUVEE" ? "bg-emerald-600 text-white"
                    : e.statut === "REJETEE" ? "bg-rose-600 text-white"
                    : e.statut === "INFO_DEMANDEE" ? "bg-sky-600 text-white"
                    : e.statut === "IGNOREE" ? "bg-slate-200 text-slate-500 dark:bg-slate-700"
                    : e.statut === "A_VENIR" ? "bg-slate-200 text-slate-500 dark:bg-slate-700"
                    : "bg-amber-500 text-white"
                  }
                  titre={`${LIBELLE_ETAPE[e.statut]} — ${e.approver.nom}`}
                  sousTitre={
                    e.decidedAt
                      ? formatDateHeure(e.decidedAt)
                      : e.statut === "IGNOREE"
                        ? "Aucune action requise de sa part"
                        : "En attente de décision"
                  }
                  commentaire={e.commentaire}
                  dernier={i === d.etapes.length - 1 && !d.paidAt}
                />
              ))}
              {d.paidAt ? (
                <Etape
                  icone={<Check className="h-3.5 w-3.5" />}
                  couleur="bg-violet-600 text-white"
                  titre="Réglée"
                  sousTitre={`${formatDateHeure(d.paidAt)} · ${d.paymentRef ?? ""}`}
                  dernier={!d.paidAt}
                />
              ) : null}
              {d.paidAt ? (
                <Etape
                  icone={
                    d.confirmedAt ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />
                  }
                  couleur={d.confirmedAt ? "bg-teal-600 text-white" : "bg-amber-500 text-white"}
                  titre={
                    d.confirmedAt
                      ? `Réception confirmée — ${d.demandeur.nom}`
                      : "En attente de confirmation du demandeur"
                  }
                  sousTitre={
                    d.confirmedAt
                      ? `${formatDateHeure(d.confirmedAt)} · ${piecesConfirmation.length} pièce(s)`
                      : "Factures définitives et message attendus"
                  }
                  commentaire={d.confirmationNote}
                  dernier
                />
              ) : null}
            </ol>
          </Card>

          <Card>
            <CardHeader titre="Informations" />
            <dl className="divide-y text-sm" style={{ borderColor: "var(--bordure)" }}>
              {infos.map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 px-5 py-2.5">
                  <dt className="doux text-xs">{k}</dt>
                  <dd className="text-right font-medium tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Etape({
  icone, couleur, titre, sousTitre, commentaire, dernier,
}: {
  icone: React.ReactNode;
  couleur: string;
  titre: string;
  sousTitre?: string;
  commentaire?: string | null;
  dernier?: boolean;
}) {
  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!dernier ? (
        <span className="absolute left-[11px] top-6 h-full w-px bg-slate-200 dark:bg-slate-700" />
      ) : null}
      <span className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${couleur}`}>
        {icone}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{titre}</p>
        {sousTitre ? <p className="doux mt-0.5 text-xs">{sousTitre}</p> : null}
        {commentaire ? (
          <p className="mt-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed dark:bg-slate-800">
            {commentaire}
          </p>
        ) : null}
      </div>
    </li>
  );
}
