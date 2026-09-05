import "server-only";
import { Prisma, type RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { formatMoney } from "@/lib/money";
import { audit } from "@/server/audit";
import { notifier } from "@/server/notifications";
import { convertirEnBase, DEVISE_BASE } from "@/server/currency";
import { circuitApplicable } from "@/server/circuit";
import type { SessionUser } from "@/server/auth";
import { voitTout } from "@/server/auth";
import {
  mailConfirmation, mailDecision, mailDemandeAValider, mailInfoDemandee, mailPaiement,
  mailResoumise,
} from "@/server/mail/templates";

const lien = (id: string) => `${env.APP_URL}/demandes/${id}`;

// ---------------------------------------------------------------------------
// Numerotation : DEM-2026-00042, sequence garantie par la base
// ---------------------------------------------------------------------------

export async function prochainNumero(tx: Prisma.TransactionClient): Promise<string> {
  const annee = new Date().getFullYear();
  const counter = await tx.counter.upsert({
    where: { annee },
    create: { annee, dernier: 1 },
    update: { dernier: { increment: 1 } },
    select: { dernier: true },
  });
  return `DEM-${annee}-${String(counter.dernier).padStart(5, "0")}`;
}

/**
 * Reference de reglement : REG-2026-00042.
 *
 * L'increment se fait dans la transaction du paiement : deux reglements
 * simultanes obtiennent deux numeros differents, PostgreSQL serialisant les
 * ecritures sur la ligne du compteur. Un index unique sur `paymentRef` sert
 * de dernier filet.
 */
export async function prochaineReferenceReglement(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const annee = new Date().getFullYear();
  const compteur = await tx.paymentCounter.upsert({
    where: { annee },
    create: { annee, dernier: 1 },
    update: { dernier: { increment: 1 } },
    select: { dernier: true },
  });
  return `REG-${annee}-${String(compteur.dernier).padStart(5, "0")}`;
}

// ---------------------------------------------------------------------------
// Droits
// ---------------------------------------------------------------------------

export type DemandeAvecRelations = Prisma.ExpenseRequestGetPayload<{
  include: {
    demandeur: true; department: true; category: true;
    attachments: true;
    etapes: { include: { approver: true } };
    commentaires: { include: { user: true } };
  };
}>;

export function peutVoirDemande(user: SessionUser, d: DemandeAvecRelations) {
  if (voitTout(user.role)) return true;
  if (d.demandeurId === user.id) return true;
  return d.etapes.some((e) => e.approverId === user.id);
}

export function peutModifierDemande(user: SessionUser, d: DemandeAvecRelations) {
  if (d.demandeurId !== user.id) return false;
  return d.statut === "BROUILLON" || d.statut === "INFO_DEMANDEE";
}

/** Etape en attente qui concerne cet utilisateur, s'il y en a une. */
export function etapeEnAttentePour(user: SessionUser, d: DemandeAvecRelations) {
  return d.etapes.find((e) => e.approverId === user.id && e.statut === "EN_ATTENTE") ?? null;
}

export const INCLUDE_COMPLET = {
  demandeur: true,
  department: true,
  category: true,
  attachments: { orderBy: { createdAt: "asc" } },
  etapes: { include: { approver: true }, orderBy: { ordre: "asc" } },
  commentaires: { include: { user: true }, orderBy: { createdAt: "asc" } },
} satisfies Prisma.ExpenseRequestInclude;

export async function getDemande(id: string) {
  return prisma.expenseRequest.findUnique({ where: { id }, include: INCLUDE_COMPLET });
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export type DonneesDemande = {
  objet: string;
  description?: string | null;
  devise: string;
  montant: number;
  categoryId?: string | null;
  departmentId?: string | null;
  numeroPiece?: string | null;
  datePiece?: Date | null;
  dateEcheance?: Date | null;
};

export async function creerDemande(user: SessionUser, data: DonneesDemande) {
  return prisma.$transaction(async (tx) => {
    const numero = await prochainNumero(tx);
    return tx.expenseRequest.create({
      data: {
        numero,
        demandeurId: user.id,
        departmentId: data.departmentId ?? user.departmentId ?? null,
        categoryId: data.categoryId ?? null,
        objet: data.objet,
        description: data.description ?? null,
        devise: data.devise,
        montant: new Prisma.Decimal(data.montant),
        deviseBase: DEVISE_BASE,
        numeroPiece: data.numeroPiece ?? null,
        datePiece: data.datePiece ?? null,
        dateEcheance: data.dateEcheance ?? null,
        statut: "BROUILLON",
      },
    });
  });
}

export async function majDemande(id: string, data: DonneesDemande) {
  return prisma.expenseRequest.update({
    where: { id },
    data: {
      objet: data.objet,
      description: data.description ?? null,
      devise: data.devise,
      montant: new Prisma.Decimal(data.montant),
      categoryId: data.categoryId ?? null,
      departmentId: data.departmentId ?? null,
      numeroPiece: data.numeroPiece ?? null,
      datePiece: data.datePiece ?? null,
      dateEcheance: data.dateEcheance ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Soumission
// ---------------------------------------------------------------------------

export class ErreurMetier extends Error {}

/**
 * Soumet la demande a un approbateur. Le taux de change et le montant
 * converti sont figes ici : un rapport sur 2024 ne doit pas bouger parce
 * qu'on a mis a jour un taux en 2026.
 */
export async function soumettreDemande(user: SessionUser, requestId: string) {
  const d = await prisma.expenseRequest.findUnique({
    where: { id: requestId },
    include: { attachments: true, category: true, etapes: true },
  });
  if (!d) throw new ErreurMetier("Dépense introuvable.");
  if (d.demandeurId !== user.id) throw new ErreurMetier("Cette dépense ne vous appartient pas.");
  if (d.statut !== "BROUILLON" && d.statut !== "INFO_DEMANDEE") {
    throw new ErreurMetier("Cette dépense a déjà été soumise.");
  }
  if (d.attachments.length === 0) {
    throw new ErreurMetier("Joignez au moins le justificatif (PDF ou image) avant de soumettre.");
  }

  // Le circuit vient du compte, pas d'un choix du demandeur.
  const circuit = await circuitApplicable(user.id);
  if (circuit.length === 0) {
    throw new ErreurMetier(
      "Aucun approbateur n'est assigné à votre compte. Contactez un administrateur.",
    );
  }

  const reprise = d.statut === "INFO_DEMANDEE";
  const { taux, montantBase } = await convertirEnBase(
    d.montant,
    d.devise,
    d.datePiece ?? new Date(),
  );

  const maj = await prisma.$transaction(async (tx) => {
    // Verrou atomique : seule la premiere soumission voit count === 1, donc
    // un double-clic ne cree jamais deux circuits pour la meme depense.
    const verrouillee = await tx.expenseRequest.updateMany({
      where: { id: requestId, statut: { in: ["BROUILLON", "INFO_DEMANDEE"] } },
      data: {
        statut: "EN_ATTENTE",
        niveauCourant: 1,
        submittedAt: d.submittedAt ?? new Date(),
        tauxChange: taux,
        montantBase,
        deviseBase: DEVISE_BASE,
      },
    });
    if (verrouillee.count === 0) {
      throw new ErreurMetier("Cette dépense a déjà été soumise.");
    }

    // Sur une resoumission, on repart d'une liste propre.
    await tx.approvalStep.deleteMany({ where: { requestId } });
    // Tous les approbateurs sont saisis en meme temps : le premier qui
    // tranche decide pour tous, les autres constatent.
    for (const etape of circuit) {
      await tx.approvalStep.create({
        data: {
          requestId,
          ordre: etape.ordre,
          approverId: etape.approverId,
          statut: "EN_ATTENTE",
        },
      });
    }
    return tx.expenseRequest.findUniqueOrThrow({ where: { id: requestId } });
  });

  await audit({
    actorId: user.id,
    action: reprise ? "DEMANDE_RESOUMISE" : "DEMANDE_SOUMISE",
    entity: "ExpenseRequest",
    entityId: requestId,
    diff: {
      circuit: circuit.map((e) => `${e.ordre}. ${e.nom}`),
      montant: d.montant.toString(),
      devise: d.devise,
    },
  });

  const montant = formatMoney(d.montant, d.devise);

  // Chacun des approbateurs designes est prevenu : le premier disponible
  // pourra trancher.
  await Promise.all(
    circuit.map((approbateur) =>
      notifier({
        userId: approbateur.approverId,
        requestId,
        type: reprise ? "DEMANDE_RESOUMISE" : "DEMANDE_A_VALIDER",
        titre: `${d.numero} — ${reprise ? "dépense complétée" : "à valider"}`,
        corps: `${user.nom} · ${d.objet} · ${montant}`,
        email: reprise
          ? mailResoumise({
              approbateur: approbateur.nom, demandeur: user.nom,
              numero: d.numero, url: lien(requestId),
            })
          : mailDemandeAValider({
              approbateur: approbateur.nom, demandeur: user.nom, numero: d.numero,
              objet: d.objet, montant, categorie: d.category?.nom ?? "Non catégorisé",
              url: lien(requestId),
            }),
      }),
    ),
  );

  return maj;
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export type Decision = "APPROUVER" | "REJETER" | "DEMANDER_INFO";

export async function deciderDemande(
  user: SessionUser,
  requestId: string,
  decision: Decision,
  commentaire?: string | null,
) {
  const d = await prisma.expenseRequest.findUnique({
    where: { id: requestId },
    include: { ...INCLUDE_COMPLET },
  });
  if (!d) throw new ErreurMetier("Demande introuvable.");
  if (d.statut !== "EN_ATTENTE") throw new ErreurMetier("Cette demande n'est plus en attente.");
  if (d.demandeurId === user.id) {
    throw new ErreurMetier("Vous ne pouvez pas statuer sur votre propre demande.");
  }

  const etape = etapeEnAttentePour(user, d);
  if (!etape) throw new ErreurMetier("Cette demande ne vous est pas assignée.");
  if (decision !== "APPROUVER" && !commentaire?.trim()) {
    throw new ErreurMetier("Un motif est obligatoire pour rejeter ou demander une information.");
  }

  const now = new Date();
  const statutEtape =
    decision === "APPROUVER" ? "APPROUVEE" : decision === "REJETER" ? "REJETEE" : "INFO_DEMANDEE";

  // Le premier qui tranche decide pour tous : il n'y a pas de niveau suivant.
  const statutDemande: RequestStatus =
    decision === "REJETER" ? "REJETEE"
    : decision === "DEMANDER_INFO" ? "INFO_DEMANDEE"
    : "APPROUVEE";

  // Les autres approbateurs designes n'ont plus a se prononcer.
  const autresApprobateurs = d.etapes.filter(
    (e) => e.id !== etape.id && e.statut === "EN_ATTENTE",
  );

  const maj = await prisma.$transaction(async (tx) => {
    // Verrou atomique : l'etape ne bascule que si elle est ENCORE en attente.
    // Les controles plus haut sont faits sur une lecture ; entre cette lecture
    // et l'ecriture, un double-clic ou un second onglet a pu decider. Seule la
    // premiere des deux transactions voit count === 1.
    const etapeVerrouillee = await tx.approvalStep.updateMany({
      where: { id: etape.id, statut: "EN_ATTENTE" },
      data: { statut: statutEtape, commentaire: commentaire ?? null, decidedAt: now },
    });
    if (etapeVerrouillee.count === 0) {
      throw new ErreurMetier("Cette demande vient d'être traitée. Rafraîchissez la page.");
    }

    // Meme verrou sur la demande : elle doit toujours etre EN_ATTENTE.
    const demandeVerrouillee = await tx.expenseRequest.updateMany({
      where: { id: requestId, statut: "EN_ATTENTE" },
      data: { statut: statutDemande, niveauCourant: etape.ordre, decidedAt: now },
    });
    if (demandeVerrouillee.count === 0) {
      throw new ErreurMetier("Cette demande vient d'être traitée. Rafraîchissez la page.");
    }

    // La décision d'un seul clôt le tour : les autres passent en « sans objet ».
    await tx.approvalStep.updateMany({
      where: { requestId, id: { not: etape.id }, statut: { in: ["A_VENIR", "EN_ATTENTE"] } },
      data: { statut: "IGNOREE" },
    });
    if (commentaire?.trim()) {
      await tx.comment.create({
        data: { requestId, userId: user.id, corps: commentaire.trim() },
      });
    }
    return tx.expenseRequest.findUniqueOrThrow({ where: { id: requestId } });
  });

  await audit({
    actorId: user.id,
    action: `DEMANDE_${decision}`,
    entity: "ExpenseRequest",
    entityId: requestId,
    diff: { avant: d.statut, apres: statutDemande, commentaire },
  });

  const montant = formatMoney(d.montant, d.devise);

  if (decision === "DEMANDER_INFO") {
    await notifier({
      userId: d.demandeurId, requestId, type: "INFO_DEMANDEE",
      titre: `${d.numero} — complément demandé`,
      corps: commentaire ?? "",
      email: mailInfoDemandee({
        demandeur: d.demandeur.nom, numero: d.numero, approbateur: user.nom,
        question: commentaire ?? "", url: lien(requestId),
      }),
    });
  } else {
    const approuve = statutDemande === "APPROUVEE";
    await notifier({
      userId: d.demandeurId, requestId,
      type: approuve ? "DEMANDE_APPROUVEE" : "DEMANDE_REJETEE",
      titre: `${d.numero} — ${approuve ? "approuvée" : "rejetée"}`,
      corps: `${montant} · ${user.nom}`,
      email: mailDecision({
        demandeur: d.demandeur.nom, numero: d.numero, objet: d.objet, montant,
        approbateur: user.nom, approuve, commentaire, url: lien(requestId),
      }),
    });

    // Les administrateurs sont prevenus de tout ce qui devient payable.
    if (approuve) {
      const gestionnaires = await prisma.user.findMany({
        where: { actif: true, role: "ADMIN", id: { not: user.id } },
        select: { id: true },
      });
      await Promise.all(
        gestionnaires.map((g) =>
          notifier({
            userId: g.id, requestId, type: "DEMANDE_APPROUVEE",
            titre: `${d.numero} approuvée — à régler`,
            corps: `${d.objet} · ${montant} · approuvée par ${user.nom}`,
          }),
        ),
      );
    }
  }

  // Les autres approbateurs constatent la décision sans avoir à agir.
  const libelleDecision =
    decision === "APPROUVER" ? "approuvée"
    : decision === "REJETER" ? "rejetée"
    : "renvoyée au demandeur";

  await Promise.all(
    autresApprobateurs.map((autre) =>
      notifier({
        userId: autre.approverId, requestId, type: "DEMANDE_APPROUVEE",
        titre: `${d.numero} — ${libelleDecision} par ${user.nom}`,
        corps: `${d.objet} · ${montant} · plus rien à faire de votre côté`,
      }),
    ),
  );

  return maj;
}

// ---------------------------------------------------------------------------
// Paiement
// ---------------------------------------------------------------------------

/**
 * Enregistre le reglement. La date est celle du jour et la reference est
 * generee : rien n'est saisi, donc rien ne peut etre mal saisi ni duplique.
 */
export async function marquerPayee(user: SessionUser, requestId: string) {
  const d = await prisma.expenseRequest.findUnique({
    where: { id: requestId },
    include: { demandeur: true },
  });
  if (!d) throw new ErreurMetier("Dépense introuvable.");
  if (d.statut !== "APPROUVEE") {
    throw new ErreurMetier("Seule une dépense approuvée peut être marquée réglée.");
  }

  const { reference } = await prisma.$transaction(async (tx) => {
    const reference = await prochaineReferenceReglement(tx);

    // Verrou atomique : deux clics simultanes n'enregistrent qu'un reglement.
    const verrouillee = await tx.expenseRequest.updateMany({
      where: { id: requestId, statut: "APPROUVEE" },
      data: { statut: "PAYEE", paidAt: new Date(), paymentRef: reference, paidById: user.id },
    });
    if (verrouillee.count === 0) {
      throw new ErreurMetier("Cette dépense vient d'être réglée. Rafraîchissez la page.");
    }
    return { reference };
  });

  const maj = await prisma.expenseRequest.findUniqueOrThrow({ where: { id: requestId } });

  await audit({
    actorId: user.id, action: "DEMANDE_PAYEE", entity: "ExpenseRequest",
    entityId: requestId, diff: { reference },
  });

  await notifier({
    userId: d.demandeurId, requestId, type: "CONFIRMATION_ATTENDUE",
    titre: `${d.numero} — réglée, à confirmer`,
    corps: `Référence ${reference} · joignez vos justificatifs définitifs`,
    email: mailPaiement({
      demandeur: d.demandeur.nom, numero: d.numero,
      montant: formatMoney(d.montant, d.devise), reference, url: lien(requestId),
    }),
  });

  return maj;
}

/**
 * Derniere etape du circuit : le demandeur accuse reception du reglement,
 * rapporte les pieces definitives et laisse un message. Tant que ce n'est pas
 * fait, la depense reste ouverte et signalee dans l'etat de la periode.
 */
export async function confirmerReception(
  user: SessionUser,
  requestId: string,
  message: string,
) {
  const d = await prisma.expenseRequest.findUnique({
    where: { id: requestId },
    include: {
      demandeur: true,
      etapes: { include: { approver: true }, orderBy: { ordre: "asc" } },
      attachments: { where: { nature: "CONFIRMATION" }, select: { id: true } },
    },
  });
  if (!d) throw new ErreurMetier("Dépense introuvable.");
  if (d.demandeurId !== user.id) {
    throw new ErreurMetier("Seul le demandeur peut confirmer la réception.");
  }
  if (d.statut !== "PAYEE") {
    throw new ErreurMetier(
      d.statut === "CONFIRMEE"
        ? "Cette dépense a déjà été confirmée."
        : "La confirmation n'est possible qu'une fois la dépense réglée.",
    );
  }
  if (!message.trim()) throw new ErreurMetier("Le message est obligatoire.");
  if (d.attachments.length === 0) {
    throw new ErreurMetier(
      "Joignez au moins une facture ou un reçu définitif avant de confirmer.",
    );
  }

  // Verrou atomique : la confirmation n'a lieu qu'une fois.
  const verrouillee = await prisma.expenseRequest.updateMany({
    where: { id: requestId, statut: "PAYEE" },
    data: {
      statut: "CONFIRMEE",
      confirmedAt: new Date(),
      confirmationNote: message.trim(),
    },
  });
  if (verrouillee.count === 0) {
    throw new ErreurMetier("Cette dépense vient d'être confirmée. Rafraîchissez la page.");
  }

  await prisma.comment.create({
    data: { requestId, userId: user.id, corps: message.trim() },
  });

  await audit({
    actorId: user.id, action: "DEMANDE_CONFIRMEE", entity: "ExpenseRequest",
    entityId: requestId, diff: { pieces: d.attachments.length },
  });

  // On previent celui qui a reglé, celui qui a validé, et les administrateurs.
  const montant = formatMoney(d.montant, d.devise);
  const decideurs = new Set<string>();
  if (d.paidById) decideurs.add(d.paidById);
  d.etapes.filter((e) => e.statut === "APPROUVEE").forEach((e) => decideurs.add(e.approverId));

  const admins = await prisma.user.findMany({
    where: { actif: true, role: "ADMIN" },
    select: { id: true },
  });
  admins.forEach((a) => decideurs.add(a.id));
  decideurs.delete(user.id);

  const destinataires = await prisma.user.findMany({
    where: { id: { in: [...decideurs] } },
    select: { id: true, nom: true },
  });

  await Promise.all(
    destinataires.map((dest) =>
      notifier({
        userId: dest.id, requestId, type: "DEMANDE_CONFIRMEE",
        titre: `${d.numero} — réception confirmée`,
        corps: `${d.demandeur.nom} · ${d.attachments.length} pièce(s) · ${montant}`,
        email: mailConfirmation({
          destinataire: dest.nom, demandeur: d.demandeur.nom, numero: d.numero,
          objet: d.objet, montant, message: message.trim(),
          nbPieces: d.attachments.length, url: lien(requestId),
        }),
      }),
    ),
  );

  return prisma.expenseRequest.findUniqueOrThrow({ where: { id: requestId } });
}

export async function annulerDemande(user: SessionUser, requestId: string) {
  const d = await prisma.expenseRequest.findUnique({ where: { id: requestId } });
  if (!d) throw new ErreurMetier("Demande introuvable.");
  if (d.demandeurId !== user.id && user.role !== "ADMIN") {
    throw new ErreurMetier("Action non autorisée.");
  }
  if (d.statut === "PAYEE" || d.statut === "CONFIRMEE") {
    throw new ErreurMetier("Une dépense réglée ne peut pas être annulée.");
  }

  const verrouillee = await prisma.expenseRequest.updateMany({
    where: { id: requestId, statut: { in: ["BROUILLON", "EN_ATTENTE", "INFO_DEMANDEE"] } },
    data: { statut: "ANNULEE", decidedAt: new Date() },
  });
  if (verrouillee.count === 0) {
    throw new ErreurMetier("Cette demande a déjà changé d'état. Rafraîchissez la page.");
  }
  await prisma.approvalStep.updateMany({
    where: { requestId, statut: { in: ["A_VENIR", "EN_ATTENTE"] } },
    data: { statut: "IGNOREE" },
  });
  const maj = await prisma.expenseRequest.findUniqueOrThrow({ where: { id: requestId } });
  await audit({
    actorId: user.id, action: "DEMANDE_ANNULEE", entity: "ExpenseRequest",
    entityId: requestId, diff: { avant: d.statut },
  });
  return maj;
}
