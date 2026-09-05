import "server-only";
import { prisma } from "@/lib/prisma";
import { devisesActives } from "@/server/currency";
import { circuitApplicable } from "@/server/circuit";

/** Referentiels necessaires au formulaire de demande. */
export async function donneesFormulaire(userId: string) {
  const [devises, categories, departements, circuit] = await Promise.all([
    devisesActives(),  // Currency n'a aucun champ Decimal : serialisable tel quel
    prisma.category.findMany({
      where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" },
    }),
    prisma.department.findMany({
      where: { actif: true }, select: { id: true, nom: true }, orderBy: { nom: "asc" },
    }),
    // Le circuit est attribue par l'administrateur : on l'affiche, on ne le
    // propose pas au choix.
    circuitApplicable(userId),
  ]);
  return { devises, categories, departements, circuit };
}
