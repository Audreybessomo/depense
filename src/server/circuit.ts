import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Les approbateurs d'une personne sont attribues par l'administrateur, pas
 * choisis par le demandeur. Ils sont saisis **tous en meme temps** : la
 * depense apparait dans la file de chacun, et le premier qui tranche decide
 * pour tous — les autres constatent la decision, sans rien avoir a faire.
 *
 * `ordre` ne sert donc qu'a garder un affichage stable, pas a sequencer.
 */
export const CIRCUIT_MAX = 3;

export type EtapeCircuit = {
  ordre: number;
  approverId: string;
  nom: string;
  email: string;
  actif: boolean;
  /// Faux tant que la personne n'a jamais defini son mot de passe : elle ne
  /// peut donc pas se connecter, et bloquerait le circuit a son niveau.
  activeSonCompte: boolean;
};

/** Circuit tel qu'il est enregistre, y compris les approbateurs desactives. */
export async function circuitDe(userId: string): Promise<EtapeCircuit[]> {
  const lignes = await prisma.approverAssignment.findMany({
    where: { userId },
    include: {
      approver: { select: { id: true, nom: true, email: true, actif: true, passwordHash: true } },
    },
    orderBy: { ordre: "asc" },
  });

  return lignes.map((l) => ({
    ordre: l.ordre,
    approverId: l.approverId,
    nom: l.approver.nom,
    email: l.approver.email,
    actif: l.approver.actif,
    activeSonCompte: l.approver.passwordHash !== null,
  }));
}

/**
 * Circuit reellement applicable a une soumission : les approbateurs
 * desactives sont ecartes et les rangs renumerotes, sinon une demande
 * resterait bloquee sur quelqu'un qui a quitte l'entreprise.
 */
export async function circuitApplicable(userId: string): Promise<EtapeCircuit[]> {
  const complet = await circuitDe(userId);
  return complet
    .filter((e) => e.actif && e.approverId !== userId)
    .map((e, i) => ({ ...e, ordre: i + 1 }));
}

/** Personnes pouvant figurer dans un circuit. */
export async function approbateursDisponibles(exclureUserId?: string) {
  return prisma.user.findMany({
    where: {
      actif: true,
      role: { in: ["APPROBATEUR", "ADMIN"] },
      ...(exclureUserId ? { id: { not: exclureUserId } } : {}),
    },
    select: { id: true, nom: true, email: true, passwordHash: true },
    orderBy: { nom: "asc" },
  }).then((liste) =>
    liste.map(({ passwordHash, ...reste }) => ({
      ...reste,
      activeSonCompte: passwordHash !== null,
    })),
  );
}

/**
 * Remplace le circuit d'une personne. Les identifiants sont donnes dans
 * l'ordre de validation ; les doublons et les vides sont ignores.
 */
export async function definirCircuit(userId: string, approbateurIds: string[]) {
  const propres = [...new Set(approbateurIds.filter(Boolean))]
    .filter((id) => id !== userId)
    .slice(0, CIRCUIT_MAX);

  await prisma.$transaction(async (tx) => {
    await tx.approverAssignment.deleteMany({ where: { userId } });
    for (const [i, approverId] of propres.entries()) {
      await tx.approverAssignment.create({
        data: { userId, approverId, ordre: i + 1 },
      });
    }
  });

  return propres;
}
