import "server-only";
import type { Prisma, RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ParamsRecherche = Record<string, string | string[] | undefined>;

const STATUTS: RequestStatus[] = [
  "BROUILLON", "EN_ATTENTE", "INFO_DEMANDEE", "APPROUVEE", "REJETEE", "PAYEE",
  "CONFIRMEE", "ANNULEE",
];

const lire = (p: ParamsRecherche, cle: string) => {
  const v = p[cle];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
};

export function construireWhere(
  p: ParamsRecherche,
  extra?: Prisma.ExpenseRequestWhereInput,
): Prisma.ExpenseRequestWhereInput {
  const q = lire(p, "q");
  const statut = lire(p, "statut");
  const categoryId = lire(p, "categoryId");
  const departmentId = lire(p, "departmentId");
  const du = lire(p, "du");
  const au = lire(p, "au");

  const where: Prisma.ExpenseRequestWhereInput = { ...extra };

  if (q) {
    where.OR = [
      { numero: { contains: q, mode: "insensitive" } },
      { objet: { contains: q, mode: "insensitive" } },
      { numeroPiece: { contains: q, mode: "insensitive" } },
      { demandeur: { nom: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (statut && STATUTS.includes(statut as RequestStatus)) {
    where.statut = statut as RequestStatus;
  }
  if (categoryId) where.categoryId = categoryId;
  if (departmentId) where.departmentId = departmentId;

  if (du || au) {
    where.createdAt = {
      ...(du ? { gte: new Date(du) } : {}),
      ...(au ? { lte: new Date(`${au}T23:59:59`) } : {}),
    };
  }
  return where;
}

export function pagination(p: ParamsRecherche, parPage = 25) {
  const page = Math.max(1, Number(lire(p, "page") ?? 1) || 1);
  return { page, parPage, skip: (page - 1) * parPage, take: parPage };
}

/** Options des listes deroulantes de filtre, chargees une seule fois. */
export async function optionsReferentiels() {
  const [categories, departements] = await Promise.all([
    prisma.category.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    prisma.department.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
  ]);
  return { categories, departements };
}

export const OPTIONS_STATUT = [
  { valeur: "BROUILLON", label: "Brouillon" },
  { valeur: "EN_ATTENTE", label: "En attente" },
  { valeur: "INFO_DEMANDEE", label: "Info demandée" },
  { valeur: "APPROUVEE", label: "Approuvée" },
  { valeur: "REJETEE", label: "Rejetée" },
  { valeur: "PAYEE", label: "Réglée, à confirmer" },
  { valeur: "CONFIRMEE", label: "Confirmée" },
  { valeur: "ANNULEE", label: "Annulée" },
];
