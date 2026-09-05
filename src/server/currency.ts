import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { round } from "@/lib/money";

export const DEVISE_BASE = env.BASE_CURRENCY;

/**
 * Taux applicable a une date : le plus recent dont `validFrom` <= date.
 * La devise de reference vaut toujours 1.
 */
export async function tauxA(devise: string, date = new Date()): Promise<Prisma.Decimal> {
  if (devise === DEVISE_BASE) return new Prisma.Decimal(1);

  const row = await prisma.exchangeRate.findFirst({
    where: { currencyCode: devise, validFrom: { lte: date } },
    orderBy: { validFrom: "desc" },
    select: { taux: true },
  });

  if (!row) {
    throw new Error(
      `Aucun taux de change défini pour ${devise} au ${date.toLocaleDateString("fr-FR")}. ` +
        `Ajoutez-le dans Administration → Référentiels → Devises.`,
    );
  }
  return row.taux;
}

/** Convertit un montant vers la devise de reference et l'arrondit. */
export async function convertirEnBase(
  montant: Prisma.Decimal | number | string,
  devise: string,
  date = new Date(),
) {
  const taux = await tauxA(devise, date);
  const brut = new Prisma.Decimal(montant.toString()).mul(taux);
  return { taux, montantBase: round(brut, 2) };
}

export async function devisesActives() {
  const devises = await prisma.currency.findMany({
    where: { actif: true },
    orderBy: [{ code: "asc" }],
  });
  // La devise de reference en tete : c'est le choix par defaut attendu.
  return devises.sort((a, b) =>
    a.code === DEVISE_BASE ? -1 : b.code === DEVISE_BASE ? 1 : a.code.localeCompare(b.code),
  );
}
