"use client";

import { useActionState } from "react";
import { connexion, type EtatLogin } from "./actions";
import { Alerte, Champ, Label } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";

export function FormulaireConnexion({ messageInitial }: { messageInitial?: string }) {
  const [etat = {}, action] = useActionState(connexion, {} as EtatLogin);
  const message = etat.erreur ?? messageInitial;

  return (
    <form action={action} className="mt-8 space-y-4">
      {message ? <Alerte type="erreur">{message}</Alerte> : null}

      <div>
        <Label htmlFor="email">Adresse email</Label>
        <Champ id="email" name="email" type="email" autoComplete="username" required
               placeholder="vous@entreprise.com" />
      </div>
      <div>
        <Label htmlFor="motDePasse">Mot de passe</Label>
        <Champ id="motDePasse" name="motDePasse" type="password"
               autoComplete="current-password" required placeholder="••••••••" />
      </div>

      <BoutonSoumettre className="w-full">Me connecter</BoutonSoumettre>

      <p className="doux pt-1 text-center text-xs leading-relaxed">
        Mot de passe oublié ? Demandez à un administrateur de le réinitialiser.
      </p>
    </form>
  );
}
