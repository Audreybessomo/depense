"use client";

import { useActionState } from "react";
import { definirMotDePasse, type EtatMdp } from "./actions";
import { Alerte, Label } from "@/components/ui/primitives";
import { ChampMotDePasse } from "@/components/ui/mot-de-passe";
import { BoutonSoumettre } from "@/components/ui/soumission";

export function FormulaireMotDePasse({ token }: { token: string }) {
  const [etat = {}, action] = useActionState(definirMotDePasse, {} as EtatMdp);

  if (!token) {
    return (
      <div className="mt-6">
        <Alerte type="erreur">Lien invalide : jeton manquant.</Alerte>
      </div>
    );
  }

  return (
    <form action={action} className="mt-6 space-y-4">
      <input type="hidden" name="token" value={token} />
      {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}
      <div>
        <Label htmlFor="motDePasse">Nouveau mot de passe</Label>
        <ChampMotDePasse id="motDePasse" name="motDePasse" required
                         autoComplete="new-password" minLength={10} />
      </div>
      <div>
        <Label htmlFor="confirmation">Confirmation</Label>
        <ChampMotDePasse id="confirmation" name="confirmation" required
                         autoComplete="new-password" minLength={10} />
      </div>
      <BoutonSoumettre className="w-full">Enregistrer et me connecter</BoutonSoumettre>
    </form>
  );
}
