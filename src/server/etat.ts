import "server-only";
import type { Prisma, RequestStatus } from "@prisma/client";
import { normaliserPortee, type Portee } from "@/lib/portees";

export { PORTEES, normaliserPortee, libelleEtat, type Portee } from "@/lib/portees";

const STATUTS: Record<Portee, RequestStatus[]> = {
  engage: ["APPROUVEE", "PAYEE", "CONFIRMEE"],
  paye: ["PAYEE", "CONFIRMEE"],
  tout: [
    "EN_ATTENTE", "INFO_DEMANDEE", "APPROUVEE", "REJETEE", "PAYEE", "CONFIRMEE", "ANNULEE",
  ],
};

export function filtresEtat(params: {
  debut: Date;
  fin: Date;
  departmentId?: string | null;
  categoryId?: string | null;
  portee?: string | null;
}): Prisma.ExpenseRequestWhereInput {
  const portee = normaliserPortee(params.portee);

  // On date l'etat sur `submittedAt` : une depense appartient a la periode ou
  // elle est entree dans le circuit, pas a celle ou on l'a saisie.
  return {
    submittedAt: { gte: params.debut, lte: params.fin },
    statut: { in: STATUTS[portee] },
    ...(params.departmentId ? { departmentId: params.departmentId } : {}),
    ...(params.categoryId ? { categoryId: params.categoryId } : {}),
  };
}
