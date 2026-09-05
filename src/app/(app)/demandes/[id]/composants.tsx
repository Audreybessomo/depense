"use client";

import { useActionState, useRef, useState } from "react";
import { commenter, confirmer, decider, payer, soumettre, type EtatAction } from "../actions";
import { Alerte, Champ, Label, Select, Zone } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { Check, Download, FileText, HelpCircle, Send, Upload, X } from "lucide-react";

const vide = {} as EtatAction;

// --- Visionneuse de pieces jointes -----------------------------------------

export function Visionneuse({
  pieces,
}: {
  pieces: { id: string; filename: string; mimeType: string; taille: number }[];
}) {
  const [courante, setCourante] = useState(pieces[0]);
  if (!courante) return null;

  return (
    <div>
      {pieces.length > 1 ? (
        <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5" style={{ borderColor: "var(--bordure)" }}>
          {pieces.map((p) => (
            <button
              key={p.id}
              onClick={() => setCourante(p)}
              className={`max-w-[180px] truncate rounded-md px-2.5 py-1 text-xs transition ${
                p.id === courante.id
                  ? "bg-slate-900 text-white dark:bg-indigo-600"
                  : "doux hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {p.filename}
            </button>
          ))}
        </div>
      ) : null}

      <div className="bg-slate-100 dark:bg-slate-900">
        {courante.mimeType === "application/pdf" ? (
          <iframe
            src={`/api/fichiers/${courante.id}#toolbar=1&view=FitH`}
            title={courante.filename}
            className="h-[70vh] w-full border-0"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/fichiers/${courante.id}`}
            alt={courante.filename}
            className="mx-auto max-h-[70vh] w-auto object-contain"
          />
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2.5 text-xs" >
        <span className="doux truncate">
          {courante.filename} · {(courante.taille / 1024).toFixed(0)} Ko
        </span>
        <a
          href={`/api/fichiers/${courante.id}?dl=1`}
          className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          Télécharger
        </a>
      </div>
    </div>
  );
}

// --- Panneau de decision de l'approbateur ----------------------------------

export function PanneauDecision({ requestId }: { requestId: string }) {
  const [etat = {}, action] = useActionState(decider, vide);
  const [decision, setDecision] = useState<"APPROUVER" | "REJETER" | "DEMANDER_INFO">("APPROUVER");

  const motifObligatoire = decision !== "APPROUVER";

  return (
    <form action={action} className="space-y-3 p-5">
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="decision" value={decision} />

      {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte type="succes">{etat.succes}</Alerte> : null}

      <div className="grid grid-cols-3 gap-1.5">
        {([
          ["APPROUVER", "Approuver", Check, "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"],
          ["DEMANDER_INFO", "Info", HelpCircle, "border-sky-500 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"],
          ["REJETER", "Rejeter", X, "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"],
        ] as const).map(([valeur, label, Icone, actifClass]) => (
          <button
            key={valeur}
            type="button"
            onClick={() => setDecision(valeur)}
            className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition ${
              decision === valeur ? actifClass : "doux hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
            style={decision === valeur ? undefined : { borderColor: "var(--bordure)" }}
          >
            <Icone className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div>
        <Label htmlFor="commentaire">
          {decision === "APPROUVER" ? "Commentaire (facultatif)" : "Motif *"}
        </Label>
        <Zone
          id="commentaire"
          name="commentaire"
          rows={3}
          required={motifObligatoire}
          placeholder={
            decision === "REJETER" ? "Expliquez pourquoi cette dépense est refusée…"
            : decision === "DEMANDER_INFO" ? "Quelle information manque-t-il ?"
            : "Précision éventuelle…"
          }
        />
      </div>

      <BoutonSoumettre
        className="w-full"
        variante={decision === "APPROUVER" ? "succes" : decision === "REJETER" ? "danger" : "primaire"}
        confirmation={
          decision === "APPROUVER" ? "Confirmer l'approbation de cette demande ?" : undefined
        }
      >
        {decision === "APPROUVER" ? "Approuver la demande"
          : decision === "REJETER" ? "Rejeter la demande"
          : "Demander un complément"}
      </BoutonSoumettre>
    </form>
  );
}

// --- Soumission d'un brouillon ---------------------------------------------

export function PanneauSoumission({
  requestId, circuit,
}: {
  requestId: string;
  circuit: { ordre: number; nom: string; email: string; activeSonCompte: boolean }[];
}) {
  const [etat = {}, action] = useActionState(soumettre, vide);

  return (
    <form action={action} className="space-y-3 p-5">
      <input type="hidden" name="requestId" value={requestId} />
      {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}

      {circuit.length === 0 ? (
        <Alerte type="erreur">
          Aucun approbateur n&apos;est assigné à votre compte. Contactez un administrateur.
        </Alerte>
      ) : (
        <ol className="space-y-2">
          {circuit.map((e) => (
            <li key={e.ordre} className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold dark:bg-slate-800">
                {e.nom.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{e.nom}</span>
                <span className="doux block truncate text-[11px]">{e.email}</span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <BoutonSoumettre className="w-full" >
        <Send className="h-4 w-4" />
        Envoyer pour validation
      </BoutonSoumettre>
    </form>
  );
}

// --- Reglement -------------------------------------------------------------

export function PanneauPaiement({ requestId }: { requestId: string }) {
  const [etat = {}, action] = useActionState(payer, vide);

  return (
    <form action={action} className="space-y-3 p-5">
      <input type="hidden" name="requestId" value={requestId} />
      {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte type="succes">{etat.succes}</Alerte> : null}

      <p className="doux text-xs leading-relaxed">
        La date du jour et la référence de règlement (<code>REG-…</code>) sont
        enregistrées automatiquement. Rien à saisir.
      </p>

      <BoutonSoumettre className="w-full" variante="succes"
                       confirmation="Confirmer l'enregistrement du règlement ?">
        Marquer comme réglée
      </BoutonSoumettre>
    </form>
  );
}

// --- Confirmation de reception par le demandeur ----------------------------

export function PanneauConfirmation({ requestId }: { requestId: string }) {
  const [etat = {}, action] = useActionState(confirmer, vide);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const input = useRef<HTMLInputElement>(null);

  const synchroniser = (liste: File[]) => {
    if (!input.current) return;
    const dt = new DataTransfer();
    liste.forEach((f) => dt.items.add(f));
    input.current.files = dt.files;
  };

  const ajouter = (liste: FileList | null) => {
    if (!liste) return;
    const suivants = [...fichiers];
    for (const f of Array.from(liste)) {
      if (!suivants.some((x) => x.name === f.name && x.size === f.size)) suivants.push(f);
    }
    setFichiers(suivants);
  };

  return (
    <form action={action} className="space-y-3 p-5">
      <input type="hidden" name="requestId" value={requestId} />

      {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}
      {etat.succes ? <Alerte type="succes">{etat.succes}</Alerte> : null}

      <div>
        <Label htmlFor="pieces-confirmation">Factures / reçus définitifs *</Label>
        <label
          htmlFor="pieces-confirmation"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            ajouter(e.dataTransfer.files);
            setTimeout(() => synchroniser([...fichiers, ...Array.from(e.dataTransfer.files)]), 0);
          }}
          className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
          style={{ borderColor: "var(--bordure)" }}
        >
          <Upload className="doux h-5 w-5" />
          <span className="text-xs font-medium">Déposez vos pièces ici</span>
          <span className="doux text-[11px]">PDF, JPEG, PNG, WebP</span>
          <input
            ref={input}
            id="pieces-confirmation"
            type="file"
            name="fichiers"
            multiple
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => ajouter(e.target.files)}
          />
        </label>

        {fichiers.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {fichiers.map((f) => (
              <li key={`${f.name}-${f.size}`}
                  className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs"
                  style={{ borderColor: "var(--bordure)" }}>
                <FileText className="doux h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{f.name}</span>
                <button
                  type="button"
                  aria-label={`Retirer ${f.name}`}
                  onClick={() => {
                    const reste = fichiers.filter((x) => x !== f);
                    setFichiers(reste);
                    synchroniser(reste);
                  }}
                  className="doux hover:text-rose-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div>
        <Label htmlFor="message">Votre message *</Label>
        <Zone
          id="message"
          name="message"
          rows={3}
          required
          minLength={5}
          placeholder="Confirmez la réception du règlement et précisez ce que couvrent les pièces jointes…"
        />
      </div>

      <BoutonSoumettre className="w-full" variante="succes">
        <Check className="h-4 w-4" />
        Confirmer la réception
      </BoutonSoumettre>
    </form>
  );
}

// --- Commentaires ----------------------------------------------------------

export function FormulaireCommentaire({ requestId }: { requestId: string }) {
  const [etat = {}, action] = useActionState(commenter, vide);

  return (
    <form action={action} className="space-y-2 border-t p-4" style={{ borderColor: "var(--bordure)" }}>
      <input type="hidden" name="requestId" value={requestId} />
      {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}
      <Zone name="corps" rows={2} required placeholder="Ajouter un commentaire…" />
      <div className="flex justify-end">
        <BoutonSoumettre taille="sm" variante="secondaire">Publier</BoutonSoumettre>
      </div>
    </form>
  );
}
