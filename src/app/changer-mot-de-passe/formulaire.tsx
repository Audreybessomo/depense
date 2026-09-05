"use client";

import Link from "next/link";
import { useActionState } from "react";
import { changerMotDePasse, type EtatChangement } from "./actions";
import { Alerte, Champ, Label } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { LONGUEUR_MINIMALE } from "@/lib/mot-de-passe";

export function FormulaireChangement({ obligatoire }: { obligatoire: boolean }) {
  const [etat = {}, action] = useActionState(changerMotDePasse, {} as EtatChangement);

  return (
    <form action={action} className="mt-6 space-y-4">
      {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}

      <div>
        <Label htmlFor="actuel">
          {obligatoire ? "Mot de passe reçu de l'administrateur" : "Mot de passe actuel"}
        </Label>
        <Champ id="actuel" name="actuel" type="password" required autoComplete="current-password" />
      </div>
      <div>
        <Label htmlFor="nouveau">Nouveau mot de passe</Label>
        <Champ id="nouveau" name="nouveau" type="password" required
               autoComplete="new-password" minLength={LONGUEUR_MINIMALE} />
      </div>
      <div>
        <Label htmlFor="confirmation">Confirmation</Label>
        <Champ id="confirmation" name="confirmation" type="password" required
               autoComplete="new-password" minLength={LONGUEUR_MINIMALE} />
      </div>

      <BoutonSoumettre className="w-full">Enregistrer</BoutonSoumettre>

      {!obligatoire ? (
        <Link href="/" className="doux block text-center text-xs hover:underline">
          Annuler
        </Link>
      ) : null}
    </form>
  );
}
