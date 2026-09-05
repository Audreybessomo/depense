/**
 * Valeurs du formulaire de demande. Ce module n'est volontairement PAS
 * marque "use client" : les exports non-fonction d'un module client ne sont
 * pas lisibles depuis un composant serveur (ils y deviennent des references
 * opaques), et le formulaire est justement initialise cote serveur.
 */
export type ValeursDemande = {
  id?: string;
  objet: string;
  description: string;
  devise: string;
  montant: string;
  categoryId: string;
  departmentId: string;
  numeroPiece: string;
  datePiece: string;
  dateEcheance: string;
};

export const VALEURS_VIDES: ValeursDemande = {
  objet: "", description: "", devise: "", montant: "",
  categoryId: "", departmentId: "", numeroPiece: "",
  datePiece: "", dateEcheance: "",
};
