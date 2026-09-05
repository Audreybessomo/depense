/**
 * Regle unique de robustesse, partagee par tous les points d'entree :
 * creation par l'administrateur, definition par lien, changement volontaire.
 * Une seule source de verite evite qu'un chemin soit plus laxiste qu'un autre.
 */
export const LONGUEUR_MINIMALE = 10;

export function verifierMotDePasse(valeur: string): string | null {
  if (valeur.length < LONGUEUR_MINIMALE) {
    return `Le mot de passe doit faire au moins ${LONGUEUR_MINIMALE} caractères.`;
  }
  if (!/[A-Za-z]/.test(valeur)) return "Le mot de passe doit contenir au moins une lettre.";
  if (!/[0-9]/.test(valeur)) return "Le mot de passe doit contenir au moins un chiffre.";
  return null;
}

// Alphabet sans les caracteres qu'on confond a l'oral ou a la lecture
// (0/O, 1/l/I) : ce mot de passe est destine a etre dicte ou recopie.
const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Mot de passe initial lisible, genere dans le navigateur ou sur le serveur. */
export function genererMotDePasse(longueur = 14): string {
  const source =
    typeof globalThis.crypto !== "undefined" && globalThis.crypto.getRandomValues
      ? globalThis.crypto.getRandomValues(new Uint32Array(longueur))
      : Array.from({ length: longueur }, () => Math.floor(Math.random() * 2 ** 32));

  let mot = "";
  for (let i = 0; i < longueur; i++) mot += ALPHABET[source[i] % ALPHABET.length];

  // On garantit la presence d'une lettre et d'un chiffre plutot que de tirer
  // au sort jusqu'a satisfaire la regle.
  if (!/[0-9]/.test(mot)) mot = `${mot.slice(0, -1)}${"23456789"[source[0] % 8]}`;
  if (!/[a-zA-Z]/.test(mot)) mot = `${"abcdefghijk"[source[1] % 11]}${mot.slice(1)}`;
  return mot;
}
