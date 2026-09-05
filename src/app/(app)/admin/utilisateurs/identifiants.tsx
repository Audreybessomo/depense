"use client";

import { useActionState, useState } from "react";
import { reinitialiserMotDePasse, type EtatUtilisateur } from "./actions";
import { Alerte } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { Check, Copy, Eye, EyeOff, KeyRound } from "lucide-react";

/**
 * Les identifiants ne sont montrés qu'ici, une seule fois. Le mot de passe
 * n'est stocké qu'en empreinte : ni l'application ni l'administrateur ne
 * pourront le relire plus tard — d'où le bouton de copie.
 */
export function CarteIdentifiants({
  identifiants,
}: {
  identifiants: { nom: string; email: string; motDePasse: string };
}) {
  const [visible, setVisible] = useState(true);
  const [copie, setCopie] = useState<"" | "mdp" | "tout">("");

  const copier = (texte: string, quoi: "mdp" | "tout") => {
    navigator.clipboard?.writeText(texte).then(
      () => {
        setCopie(quoi);
        setTimeout(() => setCopie(""), 2000);
      },
      () => {},
    );
  };

  const tout =
    `Accès à Gestion des Finances\n` +
    `Adresse : ${identifiants.email}\n` +
    `Mot de passe provisoire : ${identifiants.motDePasse}\n` +
    `Il vous sera demandé de le changer à la première connexion.`;

  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
        <KeyRound className="h-3.5 w-3.5" />
        Identifiants de {identifiants.nom} — à remettre maintenant
      </p>

      <dl className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <dt className="w-28 shrink-0 text-xs text-emerald-800 dark:text-emerald-300">Adresse</dt>
          <dd className="surface flex-1 truncate rounded-md border px-2.5 py-1.5 font-mono text-xs">
            {identifiants.email}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="w-28 shrink-0 text-xs text-emerald-800 dark:text-emerald-300">
            Mot de passe
          </dt>
          <dd className="surface flex-1 rounded-md border px-2.5 py-1.5 font-mono text-sm tracking-wide">
            {visible ? identifiants.motDePasse : "•".repeat(identifiants.motDePasse.length)}
          </dd>
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Masquer" : "Afficher"}
            className="surface rounded-md border p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => copier(identifiants.motDePasse, "mdp")}
            className="surface inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {copie === "mdp" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copie === "mdp" ? "Copié" : "Copier"}
          </button>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => copier(tout, "tout")}
          className="surface inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          {copie === "tout" ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copie === "tout" ? "Message copié" : "Copier le message complet"}
        </button>
        <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
          Ce mot de passe ne sera plus affiché. Il devra être changé à la première connexion.
        </p>
      </div>
    </div>
  );
}

export function BoutonReinitialiser({ id, nom }: { id: string; nom: string }) {
  const [etat = {}, action] = useActionState(reinitialiserMotDePasse, {} as EtatUtilisateur);

  return (
    <div className="space-y-2">
      <form action={action}>
        <input type="hidden" name="id" value={id} />
        <BoutonSoumettre
          variante="fantome"
          taille="sm"
          confirmation={`Générer un nouveau mot de passe pour ${nom} ? Ses sessions ouvertes seront fermées.`}
        >
          <KeyRound className="h-3.5 w-3.5" />
          Réinitialiser
        </BoutonSoumettre>
      </form>
      {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}
      {etat.identifiants ? <CarteIdentifiants identifiants={etat.identifiants} /> : null}
    </div>
  );
}
