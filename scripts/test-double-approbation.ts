/**
 * Vérifie l'invariant central du circuit : une demande ne peut être approuvée
 * qu'une seule fois, même si deux décisions arrivent exactement en même temps
 * (double-clic, deux onglets ouverts, requête rejouée par le réseau).
 *
 * Le test crée sa propre demande jetable, lance deux transactions concurrentes
 * et la supprime à la fin — la base de démonstration n'est pas touchée.
 *
 *   npx tsx scripts/test-double-approbation.ts
 */
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();

/** Reproduit exactement le verrou de `deciderDemande` (src/server/requests.ts). */
async function approuver(requestId: string, etapeId: string, etiquette: string) {
  try {
    await prisma.$transaction(async (tx) => {
      const etape = await tx.approvalStep.updateMany({
        where: { id: etapeId, statut: "EN_ATTENTE" },
        data: { statut: "APPROUVEE", decidedAt: new Date() },
      });
      if (etape.count === 0) throw new Error("étape déjà traitée");

      const demande = await tx.expenseRequest.updateMany({
        where: { id: requestId, statut: "EN_ATTENTE" },
        data: { statut: "APPROUVEE", decidedAt: new Date() },
      });
      if (demande.count === 0) throw new Error("demande déjà traitée");
    });
    return { etiquette, resultat: "APPROUVÉE" as const };
  } catch (e) {
    return { etiquette, resultat: "REFUSÉE" as const, motif: (e as Error).message };
  }
}

async function main() {
  const demandeur = await prisma.user.findFirstOrThrow({ where: { role: "DEMANDEUR" } });
  const valideur = await prisma.user.findFirstOrThrow({ where: { role: "APPROBATEUR" } });
  const devise = await prisma.currency.findFirstOrThrow({ where: { actif: true } });

  const demande = await prisma.expenseRequest.create({
    data: {
      numero: `TEST-CONCURRENCE-${Date.now()}`,
      demandeurId: demandeur.id,
      objet: "Demande jetable — test de double approbation",
      devise: devise.code,
      montant: new Prisma.Decimal(119250),
      montantBase: new Prisma.Decimal(119250),
      statut: "EN_ATTENTE",
      niveauCourant: 1,
      submittedAt: new Date(),
      etapes: { create: { ordre: 1, approverId: valideur.id, statut: "EN_ATTENTE" } },
    },
    include: { etapes: true },
  });

  console.log(`Demande ${demande.numero} créée, statut EN_ATTENTE.`);
  console.log(`Deux approbations lancées simultanément par ${valideur.nom}…\n`);

  const [a, b] = await Promise.all([
    approuver(demande.id, demande.etapes[0].id, "Clic n°1"),
    approuver(demande.id, demande.etapes[0].id, "Clic n°2"),
  ]);

  for (const r of [a, b]) {
    console.log(`  ${r.etiquette} : ${r.resultat}${"motif" in r ? ` (${r.motif})` : ""}`);
  }

  const finale = await prisma.expenseRequest.findUniqueOrThrow({
    where: { id: demande.id },
    include: { etapes: true },
  });
  const etapeFinale = finale.etapes[0];

  const approuvees = [a, b].filter((r) => r.resultat === "APPROUVÉE").length;
  const succes =
    approuvees === 1 && finale.statut === "APPROUVEE" && etapeFinale.statut === "APPROUVEE";

  console.log(`\n  Statut final de la demande : ${finale.statut}`);
  console.log(`  Approbations acceptées     : ${approuvees} (attendu : 1)`);
  console.log(succes ? "\n✅ Invariant respecté." : "\n❌ ÉCHEC : double approbation possible.");

  await prisma.expenseRequest.delete({ where: { id: demande.id } });
  await prisma.$disconnect();
  process.exit(succes ? 0 : 1);
}

main();
