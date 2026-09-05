import "server-only";
import { Prisma, type RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEVISE_BASE } from "@/server/currency";
import { toNumber } from "@/lib/money";

/**
 * Tous les agregats raisonnent sur `montantBase` (montant converti et fige
 * dans la devise de reference) et sur `submittedAt` : une demande compte pour
 * la periode ou elle est entree dans le circuit, pas ou elle a ete saisie.
 */

export type FiltresRapport = {
  debut: Date;
  fin: Date;
  departmentId?: string | null;
  categoryId?: string | null;
  statuts?: RequestStatus[] | null;
};

function where(f: FiltresRapport): Prisma.ExpenseRequestWhereInput {
  return {
    submittedAt: { gte: f.debut, lte: f.fin },
    statut: f.statuts?.length ? { in: f.statuts } : { not: "BROUILLON" },
    ...(f.departmentId ? { departmentId: f.departmentId } : {}),
    ...(f.categoryId ? { categoryId: f.categoryId } : {}),
  };
}

export type Kpis = {
  devise: string;
  nbTotal: number;
  montantTotal: number;
  nbApprouvees: number;
  montantApprouve: number;
  nbPayees: number;
  montantPaye: number;
  /// Reglees mais dont le demandeur n'a pas encore rapporte ses pieces
  nbAConfirmer: number;
  montantAConfirmer: number;
  nbEnAttente: number;
  montantEnAttente: number;
  nbRejetees: number;
  montantRejete: number;
  tauxRejet: number;
  delaiMoyenHeures: number | null;
  delaiMedianHeures: number | null;
};

export async function calculerKpis(f: FiltresRapport): Promise<Kpis> {
  const base = where(f);

  const [parStatut, delais] = await Promise.all([
    prisma.expenseRequest.groupBy({
      by: ["statut"],
      where: base,
      _count: { _all: true },
      _sum: { montantBase: true },
    }),
    prisma.$queryRaw<{ moyenne: number | null; mediane: number | null }[]>`
      SELECT
        AVG(EXTRACT(EPOCH FROM ("decidedAt" - "submittedAt")) / 3600)::float AS moyenne,
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY EXTRACT(EPOCH FROM ("decidedAt" - "submittedAt")) / 3600
        )::float AS mediane
      FROM expense_requests
      WHERE "submittedAt" BETWEEN ${f.debut} AND ${f.fin}
        AND "decidedAt" IS NOT NULL
        AND statut IN ('APPROUVEE', 'REJETEE', 'PAYEE', 'CONFIRMEE')
    `,
  ]);

  const get = (...statuts: RequestStatus[]) => {
    const lignes = parStatut.filter((l) => statuts.includes(l.statut));
    return {
      nb: lignes.reduce((s, l) => s + l._count._all, 0),
      montant: lignes.reduce((s, l) => s + toNumber(l._sum.montantBase), 0),
    };
  };

  const total = get(
    "EN_ATTENTE", "INFO_DEMANDEE", "APPROUVEE", "REJETEE", "PAYEE", "CONFIRMEE", "ANNULEE",
  );
  const approuvees = get("APPROUVEE", "PAYEE", "CONFIRMEE");
  const payees = get("PAYEE", "CONFIRMEE");
  const aConfirmer = get("PAYEE");
  const attente = get("EN_ATTENTE", "INFO_DEMANDEE");
  const rejetees = get("REJETEE");
  const decidees = approuvees.nb + rejetees.nb;

  return {
    devise: DEVISE_BASE,
    nbTotal: total.nb,
    montantTotal: total.montant,
    nbApprouvees: approuvees.nb,
    montantApprouve: approuvees.montant,
    nbPayees: payees.nb,
    montantPaye: payees.montant,
    nbAConfirmer: aConfirmer.nb,
    montantAConfirmer: aConfirmer.montant,
    nbEnAttente: attente.nb,
    montantEnAttente: attente.montant,
    nbRejetees: rejetees.nb,
    montantRejete: rejetees.montant,
    tauxRejet: decidees > 0 ? (rejetees.nb / decidees) * 100 : 0,
    delaiMoyenHeures: delais[0]?.moyenne ?? null,
    delaiMedianHeures: delais[0]?.mediane ?? null,
  };
}

export type PointSerie = {
  periode: string;
  label: string;
  soumis: number;
  approuve: number;
  paye: number;
  rejete: number;
  nb: number;
};

/** Serie temporelle agregee par jour, mois ou annee. */
export async function serieTemporelle(
  f: FiltresRapport,
  granularite: "day" | "month" | "year" = "month",
): Promise<PointSerie[]> {
  const rows = await prisma.$queryRaw<
    { bucket: Date; soumis: number; approuve: number; paye: number; rejete: number; nb: bigint }[]
  >`
    SELECT
      date_trunc(${granularite}, "submittedAt") AS bucket,
      SUM("montantBase")::float AS soumis,
      SUM(CASE WHEN statut IN ('APPROUVEE','PAYEE','CONFIRMEE') THEN "montantBase" ELSE 0 END)::float AS approuve,
      SUM(CASE WHEN statut IN ('PAYEE','CONFIRMEE') THEN "montantBase" ELSE 0 END)::float AS paye,
      SUM(CASE WHEN statut = 'REJETEE' THEN "montantBase" ELSE 0 END)::float AS rejete,
      COUNT(*) AS nb
    FROM expense_requests
    WHERE "submittedAt" BETWEEN ${f.debut} AND ${f.fin}
      AND statut <> 'BROUILLON'
      AND (${f.departmentId ?? null}::text IS NULL OR "departmentId" = ${f.departmentId ?? null})
      AND (${f.categoryId ?? null}::text IS NULL OR "categoryId" = ${f.categoryId ?? null})
    GROUP BY 1
    ORDER BY 1
  `;

  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: granularite === "day" ? "2-digit" : undefined,
    month: granularite === "year" ? undefined : "short",
    year: "numeric",
  });

  return rows.map((r) => ({
    periode: r.bucket.toISOString(),
    label: fmt.format(r.bucket),
    soumis: r.soumis ?? 0,
    approuve: r.approuve ?? 0,
    paye: r.paye ?? 0,
    rejete: r.rejete ?? 0,
    nb: Number(r.nb),
  }));
}

export type Repartition = { id: string; nom: string; montant: number; nb: number };

export async function repartitionPar(
  f: FiltresRapport,
  axe: "categoryId" | "departmentId" | "demandeurId",
): Promise<Repartition[]> {
  const rows = await prisma.expenseRequest.groupBy({
    by: [axe],
    where: { ...where(f), statut: { in: ["APPROUVEE", "PAYEE", "CONFIRMEE"] } },
    _sum: { montantBase: true },
    _count: { _all: true },
    orderBy: { _sum: { montantBase: "desc" } },
    take: 50,
  });

  const ids = rows.map((r) => r[axe]).filter((v): v is string => Boolean(v));
  const noms = new Map<string, string>();

  if (ids.length) {
    if (axe === "categoryId") {
      (await prisma.category.findMany({ where: { id: { in: ids } } })).forEach((x) =>
        noms.set(x.id, x.nom));
    } else if (axe === "departmentId") {
      (await prisma.department.findMany({ where: { id: { in: ids } } })).forEach((x) =>
        noms.set(x.id, x.nom));
    } else {
      (await prisma.user.findMany({ where: { id: { in: ids } } })).forEach((x) =>
        noms.set(x.id, x.nom));
    }
  }

  return rows.map((r) => {
    const id = r[axe];
    return {
      id: id ?? "—",
      nom: id ? (noms.get(id) ?? "Inconnu") : "Non renseigné",
      montant: toNumber(r._sum.montantBase),
      nb: r._count._all,
    };
  });
}

export type PerfApprobateur = {
  id: string;
  nom: string;
  traitees: number;
  approuvees: number;
  rejetees: number;
  enAttente: number;
  delaiMedianHeures: number | null;
};

export async function performanceApprobateurs(f: FiltresRapport): Promise<PerfApprobateur[]> {
  const rows = await prisma.$queryRaw<
    {
      id: string; nom: string; traitees: bigint; approuvees: bigint;
      rejetees: bigint; en_attente: bigint; mediane: number | null;
    }[]
  >`
    SELECT u.id, u.nom,
      COUNT(*) FILTER (WHERE s.statut <> 'EN_ATTENTE')                       AS traitees,
      COUNT(*) FILTER (WHERE s.statut = 'APPROUVEE')                          AS approuvees,
      COUNT(*) FILTER (WHERE s.statut = 'REJETEE')                            AS rejetees,
      COUNT(*) FILTER (WHERE s.statut = 'EN_ATTENTE')                         AS en_attente,
      PERCENTILE_CONT(0.5) WITHIN GROUP (
        ORDER BY EXTRACT(EPOCH FROM (s."decidedAt" - s."createdAt")) / 3600
      )::float AS mediane
    FROM approval_steps s
    JOIN users u ON u.id = s."approverId"
    WHERE s."createdAt" BETWEEN ${f.debut} AND ${f.fin}
    GROUP BY u.id, u.nom
    ORDER BY traitees DESC
  `;

  return rows.map((r) => ({
    id: r.id,
    nom: r.nom,
    traitees: Number(r.traitees),
    approuvees: Number(r.approuvees),
    rejetees: Number(r.rejetees),
    enAttente: Number(r.en_attente),
    delaiMedianHeures: r.mediane,
  }));
}

/** Tableau croise service x mois, pour l'export et l'affichage. */
export async function croiseServiceMois(f: FiltresRapport) {
  const rows = await prisma.$queryRaw<
    { service: string; mois: Date; montant: number }[]
  >`
    SELECT COALESCE(d.nom, 'Non renseigné') AS service,
           date_trunc('month', r."submittedAt") AS mois,
           SUM(r."montantBase")::float AS montant
    FROM expense_requests r
    LEFT JOIN departments d ON d.id = r."departmentId"
    WHERE r."submittedAt" BETWEEN ${f.debut} AND ${f.fin}
      AND r.statut IN ('APPROUVEE','PAYEE','CONFIRMEE')
    GROUP BY 1, 2
    ORDER BY 1, 2
  `;
  return rows;
}
