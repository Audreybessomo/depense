/**
 * Vérifie que la référence de règlement ne peut jamais être dupliquée, même
 * quand plusieurs règlements sont enregistrés exactement en même temps —
 * le cas qui casse les numérotations naïves du type « max + 1 ».
 *
 * Le test crée ses propres dépenses jetables et les supprime à la fin.
 *
 *   npx tsx scripts/test-reference-reglement.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const NOMBRE = 12;

/** Reproduit la transaction de `marquerPayee` (src/server/requests.ts). */
async function regler(requestId: string) {
  return prisma.$transaction(async (tx) => {
    const annee = new Date().getFullYear();
    const compteur = await tx.paymentCounter.upsert({
      where: { annee },
      create: { annee, dernier: 1 },
      update: { dernier: { increment: 1 } },
      select: { dernier: true },
    });
    const reference = `REG-${annee}-${String(compteur.dernier).padStart(5, "0")}`;

    const verrouillee = await tx.expenseRequest.updateMany({
      where: { id: requestId, statut: "APPROUVEE" },
      data: { statut: "PAYEE", paidAt: new Date(), paymentRef: reference },
    });
    if (verrouillee.count === 0) throw new Error("déjà réglée");
    return reference;
  });
}

async function main() {
  const demandeur = await prisma.user.findFirstOrThrow({ where: { role: "DEMANDEUR" } });
  const devise = await prisma.currency.findFirstOrThrow({ where: { actif: true } });

  const depenses = await Promise.all(
    Array.from({ length: NOMBRE }, (_, i) =>
      prisma.expenseRequest.create({
        data: {
          numero: `TEST-REF-${Date.now()}-${i}`,
          demandeurId: demandeur.id,
          objet: "Dépense jetable — test de référence",
          devise: devise.code,
          montant: new Prisma.Decimal(1000),
          montantBase: new Prisma.Decimal(1000),
          statut: "APPROUVEE",
          submittedAt: new Date(),
          decidedAt: new Date(),
        },
      }),
    ),
  );

  console.log(`${NOMBRE} dépenses approuvées créées.`);
  console.log(`Règlement des ${NOMBRE} exactement en même temps…\n`);

  const references = await Promise.all(depenses.map((d) => regler(d.id)));
  const distinctes = new Set(references);

  console.log(`  Références obtenues : ${references.sort().join(", ")}`);
  console.log(`  Distinctes          : ${distinctes.size} / ${NOMBRE}`);

  const enBase = await prisma.expenseRequest.findMany({
    where: { id: { in: depenses.map((d) => d.id) } },
    select: { paymentRef: true, paidAt: true },
  });
  const datesOk = enBase.every(
    (d) => d.paidAt && Math.abs(Date.now() - d.paidAt.getTime()) < 60_000,
  );

  const succes = distinctes.size === NOMBRE && datesOk;
  console.log(`  Dates du jour       : ${datesOk ? "oui" : "NON"}`);
  console.log(succes ? "\n✅ Aucune redondance." : "\n❌ ÉCHEC : références dupliquées.");

  await prisma.expenseRequest.deleteMany({ where: { id: { in: depenses.map((d) => d.id) } } });
  await prisma.$disconnect();
  process.exit(succes ? 0 : 1);
}

main();
