import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { notifier } from "@/server/notifications";
import {
  mailEscalade, mailRelanceApprobateur, mailRelanceConfirmation,
} from "@/server/mail/templates";

/**
 * Relances des dossiers qui dorment. Deux situations distinctes :
 *
 *  1. une depense attend une decision depuis trop longtemps — on rappelle les
 *     approbateurs, puis on alerte les administrateurs si rien ne bouge ;
 *  2. une depense a ete reglee mais le demandeur n'a pas rapporte ses pieces
 *     definitives — on le relance.
 *
 * Chaque envoi horodate ce qu'il vient de relancer, si bien qu'une execution
 * quotidienne ne renvoie pas le meme rappel tous les jours : le compteur
 * repart de la date du dernier rappel.
 */

const JOUR = 86_400_000;
const lien = (id: string) => `${env.APP_URL}/demandes/${id}`;
const joursDepuis = (d: Date) => Math.floor((Date.now() - d.getTime()) / JOUR);

export type BilanRelances = {
  approbateursRelances: number;
  escalades: number;
  confirmationsRelancees: number;
};

export async function envoyerLesRelances(maintenant = new Date()): Promise<BilanRelances> {
  const bilan: BilanRelances = {
    approbateursRelances: 0,
    escalades: 0,
    confirmationsRelancees: 0,
  };

  // --- 1. Decisions en souffrance ------------------------------------------
  const seuilRelance = new Date(maintenant.getTime() - env.RELANCE_JOURS * JOUR);
  const seuilEscalade = new Date(maintenant.getTime() - env.ESCALADE_JOURS * JOUR);

  const etapes = await prisma.approvalStep.findMany({
    where: {
      statut: "EN_ATTENTE",
      request: { statut: "EN_ATTENTE" },
      // Jamais relancee et assez ancienne, ou relancee il y a assez longtemps.
      OR: [
        { relanceAt: null, createdAt: { lte: seuilRelance } },
        { relanceAt: { lte: seuilRelance } },
      ],
    },
    include: {
      approver: { select: { id: true, nom: true, email: true, actif: true } },
      request: {
        include: {
          demandeur: { select: { nom: true } },
          category: { select: { nom: true } },
        },
      },
    },
  });

  const aEscalader = new Map<string, (typeof etapes)[number]>();

  for (const etape of etapes) {
    if (!etape.approver.actif) continue;
    const d = etape.request;
    const attente = joursDepuis(d.submittedAt ?? etape.createdAt);
    const montant = formatMoney(d.montant, d.devise);

    await notifier({
      userId: etape.approverId,
      requestId: d.id,
      type: "RELANCE",
      titre: `${d.numero} — en attente depuis ${attente} jours`,
      corps: `${d.demandeur.nom} · ${d.objet} · ${montant}`,
      email: mailRelanceApprobateur({
        approbateur: etape.approver.nom,
        demandeur: d.demandeur.nom,
        numero: d.numero,
        objet: d.objet,
        montant,
        jours: attente,
        url: lien(d.id),
      }),
    });

    await prisma.approvalStep.update({
      where: { id: etape.id },
      data: { relanceAt: maintenant },
    });
    bilan.approbateursRelances += 1;

    // Une seule escalade par depense, meme si plusieurs approbateurs trainent.
    const assezVieille = (d.submittedAt ?? etape.createdAt) <= seuilEscalade;
    if (assezVieille && !aEscalader.has(d.id)) aEscalader.set(d.id, etape);
  }

  if (aEscalader.size > 0) {
    const admins = await prisma.user.findMany({
      where: { actif: true, role: "ADMIN" },
      select: { id: true, nom: true },
    });

    for (const etape of aEscalader.values()) {
      const d = etape.request;
      const attente = joursDepuis(d.submittedAt ?? etape.createdAt);
      const montant = formatMoney(d.montant, d.devise);
      const enAttenteDe = etapes
        .filter((e) => e.requestId === d.id && e.approver.actif)
        .map((e) => e.approver.nom)
        .join(", ");

      for (const admin of admins) {
        await notifier({
          userId: admin.id,
          requestId: d.id,
          type: "RELANCE",
          titre: `${d.numero} — bloquée depuis ${attente} jours`,
          corps: `En attente de ${enAttenteDe} · ${montant}`,
          email: mailEscalade({
            destinataire: admin.nom,
            numero: d.numero,
            objet: d.objet,
            montant,
            jours: attente,
            approbateurs: enAttenteDe,
            url: lien(d.id),
          }),
        });
      }
      bilan.escalades += 1;
    }
  }

  // --- 2. Confirmations qui ne viennent pas --------------------------------
  const seuilConfirmation = new Date(
    maintenant.getTime() - env.RELANCE_CONFIRMATION_JOURS * JOUR,
  );

  const aConfirmer = await prisma.expenseRequest.findMany({
    where: {
      statut: "PAYEE",
      paidAt: { lte: seuilConfirmation },
      OR: [
        { relanceConfirmationAt: null },
        { relanceConfirmationAt: { lte: seuilConfirmation } },
      ],
    },
    include: { demandeur: { select: { id: true, nom: true, actif: true } } },
  });

  for (const d of aConfirmer) {
    if (!d.demandeur.actif) continue;
    const depuis = joursDepuis(d.paidAt ?? d.updatedAt);
    const montant = formatMoney(d.montant, d.devise);

    await notifier({
      userId: d.demandeurId,
      requestId: d.id,
      type: "RELANCE",
      titre: `${d.numero} — vos justificatifs sont attendus`,
      corps: `Réglée il y a ${depuis} jours · ${montant}`,
      email: mailRelanceConfirmation({
        demandeur: d.demandeur.nom,
        numero: d.numero,
        objet: d.objet,
        montant,
        jours: depuis,
        url: lien(d.id),
      }),
    });

    await prisma.expenseRequest.update({
      where: { id: d.id },
      data: { relanceConfirmationAt: maintenant },
    });
    bilan.confirmationsRelancees += 1;
  }

  return bilan;
}
