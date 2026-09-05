"use client";

import { useActionState, useEffect, useState } from "react";
import { modifierCircuit, type EtatUtilisateur } from "./actions";
import { Alerte, Bouton, Select } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { AlertTriangle, ArrowRight, Pencil } from "lucide-react";

export type Approbateur = {
  id: string;
  nom: string;
  email: string;
  activeSonCompte: boolean;
};

/**
 * Jusqu'à trois approbateurs. Ils sont sollicités **en même temps** : il
 * suffit que l'un d'eux statue. Les emplacements ne sont donc pas des rangs
 * mais de simples places, d'où l'absence de numérotation.
 */
export function ChampsCircuit({
  approbateurs, valeurs, exclureId,
}: {
  approbateurs: Approbateur[];
  valeurs?: string[];
  exclureId?: string;
}) {
  const [choix, setChoix] = useState<string[]>([
    valeurs?.[0] ?? "",
    valeurs?.[1] ?? "",
    valeurs?.[2] ?? "",
  ]);

  const disponibles = approbateurs.filter((a) => a.id !== exclureId);

  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="doux w-24 shrink-0 text-xs">
            {i === 0 ? "Principal *" : "Également"}
          </span>
          <Select
            name={`approbateur${i + 1}`}
            value={choix[i]}
            onChange={(e) => {
              const suivant = [...choix];
              suivant[i] = e.target.value;
              setChoix(suivant);
            }}
          >
            <option value="">{i === 0 ? "Choisir un approbateur…" : "Aucun"}</option>
            {disponibles
              // Un même approbateur ne peut pas être désigné deux fois.
              .filter((a) => !choix.some((c, j) => c === a.id && j !== i))
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nom} — {a.email}
                  {a.activeSonCompte ? "" : "  ⚠ compte jamais activé"}
                </option>
              ))}
          </Select>
        </div>
      ))}
    </div>
  );
}

export function CircuitUtilisateur({
  id, nom, circuit, approbateurs,
}: {
  id: string;
  nom: string;
  circuit: {
    ordre: number;
    approverId: string;
    nom: string;
    actif: boolean;
    activeSonCompte: boolean;
  }[];
  approbateurs: Approbateur[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat = {}, action] = useActionState(modifierCircuit, {} as EtatUtilisateur);

  // Dès que l'enregistrement aboutit, le formulaire se referme sur la liste
  // à jour. Sans cela on reste devant des champs dont on ne sait plus s'ils
  // reflètent ce qui est enregistré — et un second clic écrase le premier.
  useEffect(() => {
    if (etat?.succes) setOuvert(false);
  }, [etat]);

  if (!ouvert) {
    return (
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 text-xs">
          {circuit.length === 0 ? (
            <span className="font-medium text-rose-600">Aucun — ne peut pas soumettre</span>
          ) : (
            <>
              <span className="flex flex-wrap items-center gap-1">
                {circuit.map((e, i) => (
                  <span key={e.ordre} className="flex items-center gap-1">
                    {i > 0 ? <ArrowRight className="doux h-3 w-3" /> : null}
                    <span className={e.actif ? "" : "text-rose-600 line-through"}>{e.nom}</span>
                    {e.actif && !e.activeSonCompte ? (
                      <AlertTriangle className="h-3 w-3 text-amber-600" />
                    ) : null}
                  </span>
                ))}
              </span>
              {/* Un approbateur qui ne s'est jamais connecté bloque le circuit
                  à son niveau : la dépense y reste indéfiniment. */}
              {circuit.some((e) => e.actif && !e.activeSonCompte) ? (
                <span className="mt-0.5 block text-[11px] font-medium text-amber-600">
                  {circuit.filter((e) => e.actif && !e.activeSonCompte).map((e) => e.nom).join(", ")}{" "}
                  n&apos;a jamais activé son compte — les dépenses resteront bloquées à ce niveau.
                </span>
              ) : null}
            </>
          )}
          {etat.succes ? (
            <span className="mt-0.5 block text-emerald-600">{etat.succes}</span>
          ) : null}
        </div>
        <Bouton variante="fantome" taille="sm" onClick={() => setOuvert(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </Bouton>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}
      <p className="doux text-[11px]">
        Qui peut valider les dépenses de {nom}. Ils sont prévenus tous ensemble ; le
        premier qui statue décide, les autres voient sa décision.
      </p>
      <ChampsCircuit
        // La clé force la reprise des valeurs enregistrées à chaque
        // réouverture : les champs ne peuvent pas garder un état périmé.
        key={circuit.map((e) => e.approverId).join("-")}
        approbateurs={approbateurs}
        exclureId={id}
        valeurs={circuit.map((e) => e.approverId)}
      />
      <div className="flex gap-2">
        <BoutonSoumettre taille="sm">Enregistrer</BoutonSoumettre>
        <Bouton variante="fantome" taille="sm" type="button" onClick={() => setOuvert(false)}>
          Annuler
        </Bouton>
      </div>
    </form>
  );
}
