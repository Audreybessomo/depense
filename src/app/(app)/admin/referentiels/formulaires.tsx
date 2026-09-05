"use client";

import { useActionState } from "react";
import {
  creerCategorie, creerService, enregistrerDevise, type EtatReferentiel,
} from "./actions";
import { Alerte, Champ, Label } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";

const vide = {} as EtatReferentiel;

function Messages({ etat }: { etat: EtatReferentiel }) {
  if (etat.erreur) return <Alerte type="erreur">{etat.erreur}</Alerte>;
  if (etat.succes) return <Alerte type="succes">{etat.succes}</Alerte>;
  return null;
}

export function AjoutCategorie() {
  const [etat = {}, action] = useActionState(creerCategorie, vide);
  return (
    <form action={action} className="space-y-3 border-t p-5" style={{ borderColor: "var(--bordure)" }}>
      <Messages etat={etat} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="cat-nom">Nom *</Label>
          <Champ id="cat-nom" name="nom" required placeholder="Prestations informatiques" />
        </div>
        <div>
          <Label htmlFor="cat-compte">Compte comptable</Label>
          <Champ id="cat-compte" name="compteComptable" placeholder="6226" />
        </div>
      </div>
      <BoutonSoumettre taille="sm" variante="secondaire">Ajouter la catégorie</BoutonSoumettre>
    </form>
  );
}

export function AjoutService() {
  const [etat = {}, action] = useActionState(creerService, vide);
  return (
    <form action={action} className="space-y-3 border-t p-5" style={{ borderColor: "var(--bordure)" }}>
      <Messages etat={etat} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label htmlFor="svc-nom">Nom *</Label>
          <Champ id="svc-nom" name="nom" required placeholder="Direction technique" />
        </div>
        <div>
          <Label htmlFor="svc-cc">Centre de coût</Label>
          <Champ id="svc-cc" name="costCenter" placeholder="CC-410" />
        </div>
        <div>
          <Label htmlFor="svc-budget">Budget annuel</Label>
          <Champ id="svc-budget" name="budgetAnnuel" inputMode="decimal" placeholder="25000000" />
        </div>
      </div>
      <BoutonSoumettre taille="sm" variante="secondaire">Ajouter le service</BoutonSoumettre>
    </form>
  );
}

export function AjoutDevise({ deviseBase }: { deviseBase: string }) {
  const [etat = {}, action] = useActionState(enregistrerDevise, vide);
  return (
    <form action={action} className="space-y-3 border-t p-5" style={{ borderColor: "var(--bordure)" }}>
      <Messages etat={etat} />
      <p className="doux text-xs">
        Le taux exprime la contre-valeur d&apos;<strong>1 unité</strong> de la devise en{" "}
        <strong>{deviseBase}</strong>. Chaque enregistrement crée une nouvelle validité datée :
        l&apos;historique des rapports reste intact.
      </p>
      <div className="grid gap-3 sm:grid-cols-5">
        <div>
          <Label htmlFor="dev-code">Code ISO *</Label>
          <Champ id="dev-code" name="code" required maxLength={3} placeholder="EUR" className="uppercase" />
        </div>
        <div>
          <Label htmlFor="dev-nom">Nom</Label>
          <Champ id="dev-nom" name="nom" placeholder="Euro" />
        </div>
        <div>
          <Label htmlFor="dev-sym">Symbole</Label>
          <Champ id="dev-sym" name="symbole" placeholder="€" />
        </div>
        <div>
          <Label htmlFor="dev-taux">Taux → {deviseBase} *</Label>
          <Champ id="dev-taux" name="taux" required inputMode="decimal" placeholder="655.957" />
        </div>
        <div>
          <Label htmlFor="dev-date">Valable à partir du</Label>
          <Champ id="dev-date" name="validFrom" type="date" />
        </div>
      </div>
      <BoutonSoumettre taille="sm" variante="secondaire">Enregistrer la devise / le taux</BoutonSoumettre>
    </form>
  );
}
