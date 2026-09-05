/**
 * Portée de l'état de fin de période. Partagé client et serveur : le sélecteur
 * de l'écran et le filtre SQL doivent parler exactement de la même chose.
 *
 *  - `engage` : tout ce qui a été validé, payé ou non — la dépense engagée ;
 *  - `paye`   : uniquement ce qui est sorti de caisse ;
 *  - `tout`   : y compris les rejets et l'en-cours, pour un contrôle complet.
 */
export const PORTEES = [
  { valeur: "engage", label: "Dépenses approuvées (payées ou non)" },
  { valeur: "paye", label: "Dépenses effectivement payées" },
  { valeur: "tout", label: "Tout, y compris rejets et en-cours" },
] as const;

export type Portee = (typeof PORTEES)[number]["valeur"];

export function normaliserPortee(valeur?: string | null): Portee {
  return valeur === "paye" || valeur === "tout" ? valeur : "engage";
}

export const libelleEtat = (valeur?: string | null) =>
  PORTEES.find((p) => p.valeur === normaliserPortee(valeur))!.label;
