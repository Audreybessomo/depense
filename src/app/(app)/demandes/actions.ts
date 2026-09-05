"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { requireUser, peutRegler } from "@/server/auth";
import { audit } from "@/server/audit";
import {
  ErreurMetier, annulerDemande, confirmerReception, creerDemande, deciderDemande,
  getDemande, majDemande, marquerPayee, peutModifierDemande, peutVoirDemande,
  soumettreDemande,
} from "@/server/requests";
import { MIMES_AUTORISES, detecterMime, stockerFichier, supprimerFichier } from "@/server/storage";

export type EtatAction = { erreur?: string; succes?: string };

const dateOuNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s ? new Date(s) : null;
};
const idOuNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s || null;
};

const schemaDemande = z.object({
  objet: z.string().min(3, "L'objet doit faire au moins 3 caractères").max(200),
  description: z.string().max(4000).optional().nullable(),
  devise: z.string().length(3, "Devise invalide"),
  montant: z.number().positive("Le montant doit être supérieur à zéro"),
  numeroPiece: z.string().max(80).optional().nullable(),
});

function lireFormulaire(formData: FormData) {
  return {
    objet: String(formData.get("objet") ?? "").trim(),
    description: String(formData.get("description") ?? "").trim() || null,
    devise: String(formData.get("devise") ?? "").trim().toUpperCase(),
    montant: Number(String(formData.get("montant") ?? "0").replace(/\s/g, "").replace(",", ".")) || 0,
    categoryId: idOuNull(formData.get("categoryId")),
    departmentId: idOuNull(formData.get("departmentId")),
    numeroPiece: String(formData.get("numeroPiece") ?? "").trim() || null,
    datePiece: dateOuNull(formData.get("datePiece")),
    dateEcheance: dateOuNull(formData.get("dateEcheance")),
  };
}

// ---------------------------------------------------------------------------
// Pieces jointes
// ---------------------------------------------------------------------------

async function enregistrerPiecesJointes(
  requestId: string,
  userId: string,
  fichiers: File[],
  nature: "DEMANDE" | "CONFIRMATION" = "DEMANDE",
): Promise<string | null> {
  const maxOctets = env.MAX_UPLOAD_MB * 1024 * 1024;

  for (const fichier of fichiers) {
    if (!fichier || fichier.size === 0) continue;
    if (fichier.size > maxOctets) {
      return `« ${fichier.name} » dépasse la taille maximale de ${env.MAX_UPLOAD_MB} Mo.`;
    }

    const buffer = Buffer.from(await fichier.arrayBuffer());
    // On lit la signature binaire : une extension .pdf ne prouve rien.
    const mime = detecterMime(buffer);
    if (!mime || !MIMES_AUTORISES.has(mime)) {
      return `« ${fichier.name} » n'est pas un PDF ni une image valide (PDF, JPEG, PNG, WebP).`;
    }

    const stocke = await stockerFichier(buffer, mime, "factures");

    const doublon = await prisma.attachment.findFirst({
      where: { sha256: stocke.sha256, requestId: { not: requestId } },
      select: { request: { select: { numero: true } } },
    });

    await prisma.attachment.create({
      data: {
        requestId,
        filename: fichier.name.slice(0, 200),
        mimeType: mime,
        taille: stocke.taille,
        storageKey: stocke.storageKey,
        sha256: stocke.sha256,
        nature,
        // Sans antivirus branche, on marque « propre » par defaut ; brancher
        // ClamAV ici en production (cf. README, section Securite).
        scanStatus: "PROPRE",
        uploadedById: userId,
      },
    });

    if (doublon) {
      await prisma.comment.create({
        data: {
          requestId,
          userId,
          corps: `⚠️ Ce fichier est identique à une pièce déjà présente sur la demande ${doublon.request.numero}.`,
          interne: true,
        },
      });
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Creation / edition
// ---------------------------------------------------------------------------

export async function enregistrerDemande(
  _: EtatAction,
  formData: FormData,
): Promise<EtatAction> {
  const user = await requireUser();

  const brut = lireFormulaire(formData);
  const parsed = schemaDemande.safeParse(brut);
  if (!parsed.success) return { erreur: parsed.error.issues[0].message };

  const requestId = idOuNull(formData.get("requestId"));
  const soumettre = formData.get("intention") === "soumettre";

  let id = requestId;
  // Ce qui a bloqué la soumission, une fois le brouillon déjà enregistré.
  let probleme: string | null = null;

  try {
    if (id) {
      const existante = await getDemande(id);
      if (!existante || !peutModifierDemande(user, existante)) {
        return { erreur: "Cette dépense n'est plus modifiable." };
      }
      await majDemande(id, brut);
      await audit({ actorId: user.id, action: "DEMANDE_MODIFIEE", entity: "ExpenseRequest", entityId: id });
    } else {
      const creee = await creerDemande(user, brut);
      id = creee.id;
      await audit({
        actorId: user.id, action: "DEMANDE_CREEE", entity: "ExpenseRequest", entityId: id,
        diff: { numero: creee.numero },
      });
    }

    const fichiers = formData.getAll("fichiers").filter((f): f is File => f instanceof File);
    probleme = await enregistrerPiecesJointes(id, user.id, fichiers);

    if (!probleme && soumettre) await soumettreDemande(user, id);
  } catch (e) {
    if (e instanceof ErreurMetier) probleme = e.message;
    else throw e;
  }

  revalidatePath("/demandes");

  // Quoi qu'il arrive, on emmène l'utilisateur sur sa dépense : saisie et
  // justificatifs sont enregistrés, et un nouveau clic ne créera pas un
  // second brouillon. Le motif du blocage est affiché à l'arrivée.
  redirect(
    probleme
      ? `/demandes/${id}?probleme=${encodeURIComponent(probleme)}`
      : `/demandes/${id}?ok=${soumettre ? "soumise" : "enregistree"}`,
  );
}

export async function supprimerPieceJointe(formData: FormData): Promise<void> {
  const user = await requireUser();
  const attachmentId = String(formData.get("attachmentId") ?? "");

  const pj = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { request: { select: { id: true, statut: true, demandeurId: true } } },
  });
  if (!pj) return;
  if (pj.request.demandeurId !== user.id && user.role !== "ADMIN") return;
  if (pj.request.statut !== "BROUILLON" && pj.request.statut !== "INFO_DEMANDEE") return;

  // Le fichier physique n'est efface que si aucune autre demande ne le reference
  // (le stockage est adresse par empreinte, donc mutualise).
  const autres = await prisma.attachment.count({
    where: { storageKey: pj.storageKey, id: { not: pj.id } },
  });
  await prisma.attachment.delete({ where: { id: pj.id } });
  if (autres === 0) await supprimerFichier(pj.storageKey).catch(() => {});

  await audit({
    actorId: user.id, action: "PIECE_SUPPRIMEE", entity: "Attachment", entityId: pj.id,
    diff: { filename: pj.filename },
  });
  revalidatePath(`/demandes/${pj.request.id}`);
}

// ---------------------------------------------------------------------------
// Circuit
// ---------------------------------------------------------------------------

export async function soumettre(_: EtatAction, formData: FormData): Promise<EtatAction> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");

  try {
    await soumettreDemande(user, requestId);
  } catch (e) {
    if (e instanceof ErreurMetier) return { erreur: e.message };
    throw e;
  }
  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/validations");
  return { succes: "Demande envoyée pour validation." };
}

export async function decider(_: EtatAction, formData: FormData): Promise<EtatAction> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const decision = String(formData.get("decision") ?? "") as
    "APPROUVER" | "REJETER" | "DEMANDER_INFO";
  const commentaire = String(formData.get("commentaire") ?? "").trim() || null;

  try {
    await deciderDemande(user, requestId, decision, commentaire);
  } catch (e) {
    if (e instanceof ErreurMetier) return { erreur: e.message };
    throw e;
  }
  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/validations");
  revalidatePath("/admin");
  return {
    succes:
      decision === "APPROUVER" ? "Demande approuvée."
      : decision === "REJETER" ? "Demande rejetée."
      : "Complément demandé au demandeur.",
  };
}

export async function payer(_: EtatAction, formData: FormData): Promise<EtatAction> {
  const user = await requireUser();
  if (!peutRegler(user.role)) {
    return { erreur: "Seul un approbateur ou un administrateur peut enregistrer un règlement." };
  }
  const requestId = String(formData.get("requestId") ?? "");

  try {
    // Ni date ni référence à saisir : l'application les produit elle-même.
    await marquerPayee(user, requestId);
  } catch (e) {
    if (e instanceof ErreurMetier) return { erreur: e.message };
    throw e;
  }
  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/tresorerie");
  return { succes: "Règlement enregistré." };
}

export async function annuler(formData: FormData): Promise<void> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  await annulerDemande(user, requestId);
  revalidatePath(`/demandes/${requestId}`);
  redirect(`/demandes/${requestId}`);
}

export async function confirmer(_: EtatAction, formData: FormData): Promise<EtatAction> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  if (message.length < 5) {
    return { erreur: "Laissez un message d'au moins 5 caractères." };
  }

  const fichiers = formData.getAll("fichiers").filter((f): f is File => f instanceof File);
  if (fichiers.every((f) => !f || f.size === 0)) {
    return { erreur: "Joignez au moins une facture ou un reçu définitif." };
  }

  // Les pièces sont enregistrées d'abord, la confirmation ensuite : elle
  // vérifie qu'au moins une pièce de confirmation existe avant de clôturer.
  const erreurFichier = await enregistrerPiecesJointes(
    requestId, user.id, fichiers, "CONFIRMATION",
  );
  if (erreurFichier) return { erreur: erreurFichier };

  try {
    await confirmerReception(user, requestId, message);
  } catch (e) {
    if (e instanceof ErreurMetier) return { erreur: e.message };
    throw e;
  }

  revalidatePath(`/demandes/${requestId}`);
  revalidatePath("/tresorerie");
  revalidatePath("/admin/etat");
  return { succes: "Réception confirmée, vos pièces ont été enregistrées." };
}

export async function commenter(_: EtatAction, formData: FormData): Promise<EtatAction> {
  const user = await requireUser();
  const requestId = String(formData.get("requestId") ?? "");
  const corps = String(formData.get("corps") ?? "").trim();
  if (!corps) return { erreur: "Le commentaire est vide." };

  const d = await getDemande(requestId);
  if (!d || !peutVoirDemande(user, d)) return { erreur: "Demande introuvable." };
  await prisma.comment.create({ data: { requestId, userId: user.id, corps } });
  await audit({ actorId: user.id, action: "COMMENTAIRE", entity: "ExpenseRequest", entityId: requestId });
  revalidatePath(`/demandes/${requestId}`);
  return { succes: "Commentaire ajouté." };
}
