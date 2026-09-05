"use client";

import { useActionState, useState } from "react";
import { creerUtilisateur, type EtatUtilisateur } from "./actions";
import { Alerte, Bouton, Card, CardHeader, Champ, Label, Select } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { RefreshCw, UserPlus } from "lucide-react";
import { CarteIdentifiants } from "./identifiants";
import { ChampsCircuit, type Approbateur } from "./circuit";
import { genererMotDePasse } from "@/lib/mot-de-passe";

const ROLES = [
  { valeur: "DEMANDEUR", label: "Demandeur — engage une dépense et suit ses demandes" },
  { valeur: "APPROBATEUR", label: "Approbateur — approuve, rejette et marque payé" },
  { valeur: "ADMIN", label: "Administrateur — accès complet et gestion des comptes" },
];

export function FormulaireUtilisateur({
  departements, utilisateurs, approbateurs,
}: {
  departements: { id: string; nom: string }[];
  utilisateurs: { id: string; nom: string }[];
  approbateurs: Approbateur[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [motDePasse, setMotDePasse] = useState("");
  const [etat = {}, action] = useActionState(creerUtilisateur, {} as EtatUtilisateur);

  const ouvrir = () => {
    // Un mot de passe solide est proposé d'emblée : l'administrateur n'a rien
    // à inventer, et n'est pas tenté de réutiliser toujours le même.
    setMotDePasse(genererMotDePasse());
    setOuvert(true);
  };

  if (!ouvert) {
    return (
      <div className="space-y-3">
        {etat.succes ? <Alerte type="succes">{etat.succes}</Alerte> : null}
        {etat.identifiants ? <CarteIdentifiants identifiants={etat.identifiants} /> : null}
        <Bouton onClick={ouvrir}>
          <UserPlus className="h-4 w-4" />Créer un compte
        </Bouton>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader
        titre="Créer un compte"
        description="Vous lui remettrez ses identifiants directement — aucun email n'est envoyé."
        action={
          <Bouton variante="fantome" taille="sm" onClick={() => setOuvert(false)}>Fermer</Bouton>
        }
      />
      <form action={action} className="grid gap-4 p-5 sm:grid-cols-2">
        {etat.erreur ? <div className="sm:col-span-2"><Alerte type="erreur">{etat.erreur}</Alerte></div> : null}
        {etat.succes ? <div className="sm:col-span-2"><Alerte type="succes">{etat.succes}</Alerte></div> : null}
        {etat.identifiants ? (
          <div className="sm:col-span-2">
            <CarteIdentifiants identifiants={etat.identifiants} />
          </div>
        ) : null}

        <div>
          <Label htmlFor="nom">Nom complet *</Label>
          <Champ id="nom" name="nom" required placeholder="Awa Ndiaye" />
        </div>
        <div>
          <Label htmlFor="email">Adresse email *</Label>
          <Champ id="email" name="email" type="email" required placeholder="awa@entreprise.com" />
        </div>
        <div>
          <Label htmlFor="role">Rôle *</Label>
          <Select id="role" name="role" defaultValue="DEMANDEUR">
            {ROLES.map((r) => <option key={r.valeur} value={r.valeur}>{r.label}</option>)}
          </Select>
        </div>
        <div>
          <Label htmlFor="departmentId">Service</Label>
          <Select id="departmentId" name="departmentId" defaultValue="">
            <option value="">Aucun</option>
            {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Approbateurs *</Label>
          <ChampsCircuit approbateurs={approbateurs} />
          <p className="doux mt-1.5 text-xs">
            Qui pourra valider ses dépenses. Le titulaire n&apos;a aucun choix à faire :
            ses dépenses partent vers <strong>tous</strong> les approbateurs désignés, et
            il suffit que <strong>l&apos;un d&apos;eux</strong> statue — les autres verront
            simplement si c&apos;est validé ou non.
          </p>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="motDePasse">Mot de passe provisoire</Label>
          <div className="flex gap-2">
            <Champ
              id="motDePasse"
              name="motDePasse"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              className="font-mono"
              placeholder="Laissez vide pour en générer un"
            />
            <Bouton
              type="button"
              variante="secondaire"
              onClick={() => setMotDePasse(genererMotDePasse())}
            >
              <RefreshCw className="h-4 w-4" />
              Générer
            </Bouton>
          </div>
          <p className="doux mt-1.5 text-xs">
            Au moins 10 caractères, avec une lettre et un chiffre. La personne devra le
            changer à sa première connexion.
          </p>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="managerId">Responsable hiérarchique</Label>
          <Select id="managerId" name="managerId" defaultValue="">
            <option value="">Aucun</option>
            {utilisateurs.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <BoutonSoumettre>Créer le compte</BoutonSoumettre>
        </div>
      </form>
    </Card>
  );
}
