"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/server/auth";
import { audit } from "@/server/audit";
import { genererMotDePasse, verifierMotDePasse } from "@/lib/mot-de-passe";
import { CIRCUIT_MAX, definirCircuit } from "@/server/circuit";

export type EtatUtilisateur = {
  erreur?: string;
  succes?: string;
  /**
   * Identifiants a remettre en main propre. Affiches une seule fois, juste
   * apres la creation ou la reinitialisation : le mot de passe n'est stocke
   * qu'en empreinte, il ne pourra plus jamais etre relu.
   */
  identifiants?: { nom: string; email: string; motDePasse: string };
};

const ROLES: Role[] = ["DEMANDEUR", "APPROBATEUR", "ADMIN"];

const schema = z.object({
  nom: z.string().min(2, "Nom trop court").max(120),
  email: z.string().email("Adresse email invalide"),
  role: z.enum(["DEMANDEUR", "APPROBATEUR", "ADMIN"]),
  departmentId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
});

export async function creerUtilisateur(
  _: EtatUtilisateur,
  formData: FormData,
): Promise<EtatUtilisateur> {
  const admin = await requireRole("ADMIN");

  const parsed = schema.safeParse({
    nom: String(formData.get("nom") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: String(formData.get("role") ?? "DEMANDEUR"),
    departmentId: String(formData.get("departmentId") ?? "").trim() || null,
    managerId: String(formData.get("managerId") ?? "").trim() || null,
  });
  if (!parsed.success) return { erreur: parsed.error.issues[0].message };

  const existant = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (existant) return { erreur: "Un compte existe déjà avec cette adresse." };

  // Le mot de passe saisi par l'administrateur, ou un mot de passe genere
  // s'il a laisse le champ vide.
  const saisi = String(formData.get("motDePasse") ?? "").trim();
  const motDePasse = saisi || genererMotDePasse();
  const faiblesse = verifierMotDePasse(motDePasse);
  if (faiblesse) return { erreur: faiblesse };

  const user = await prisma.user.create({
    data: {
      nom: parsed.data.nom,
      email: parsed.data.email,
      role: parsed.data.role,
      departmentId: parsed.data.departmentId,
      managerId: parsed.data.managerId,
      passwordHash: await hashPassword(motDePasse),
      // L'administrateur connait ce mot de passe : il ne doit pas rester.
      doitChangerMotDePasse: true,
    },
  });

  // Le circuit de validation est attribue des la creation : le titulaire
  // n'aura aucun approbateur a choisir au moment de soumettre.
  const circuit = await definirCircuit(user.id, lireCircuit(formData));

  await audit({
    actorId: admin.id, action: "UTILISATEUR_CREE", entity: "User", entityId: user.id,
    diff: { email: user.email, role: user.role, circuit: circuit.length },
  });
  revalidatePath("/admin/utilisateurs");

  return {
    succes:
      circuit.length > 0
        ? `Compte créé pour ${user.nom}, circuit à ${circuit.length} niveau(x).`
        : `Compte créé pour ${user.nom} — aucun approbateur assigné, il ne pourra pas soumettre.`,
    identifiants: { nom: user.nom, email: user.email, motDePasse },
  };
}

/**
 * Redonne un acces a quelqu'un qui a perdu son mot de passe, sans passer par
 * l'email. Les sessions ouvertes sont revoquees et le changement est impose
 * a la connexion suivante.
 */
export async function reinitialiserMotDePasse(
  _: EtatUtilisateur,
  formData: FormData,
): Promise<EtatUtilisateur> {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { erreur: "Compte introuvable." };
  if (!user.actif) return { erreur: "Ce compte est désactivé — réactivez-le d'abord." };

  const motDePasse = genererMotDePasse();
  await prisma.user.update({
    where: { id },
    data: { passwordHash: await hashPassword(motDePasse), doitChangerMotDePasse: true },
  });
  await prisma.session.updateMany({
    where: { userId: id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await audit({
    actorId: admin.id, action: "MOT_DE_PASSE_REINITIALISE", entity: "User", entityId: id,
    diff: { email: user.email },
  });
  revalidatePath("/admin/utilisateurs");

  return {
    succes: `Nouveau mot de passe pour ${user.nom}.`,
    identifiants: { nom: user.nom, email: user.email, motDePasse },
  };
}

/** Les rangs sont portes par des champs approbateur1, approbateur2, ... */
function lireCircuit(formData: FormData): string[] {
  return Array.from({ length: CIRCUIT_MAX }, (_, i) =>
    String(formData.get(`approbateur${i + 1}`) ?? "").trim(),
  ).filter(Boolean);
}

/** Modifie le circuit d'un compte existant. */
export async function modifierCircuit(
  _: EtatUtilisateur,
  formData: FormData,
): Promise<EtatUtilisateur> {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");

  const user = await prisma.user.findUnique({ where: { id }, select: { nom: true } });
  if (!user) return { erreur: "Compte introuvable." };

  // Un enregistrement vide effacerait tous les approbateurs sans le dire, et
  // le compte ne pourrait plus rien soumettre. On l'exige explicitement.
  const demandes = lireCircuit(formData);
  if (demandes.length === 0) {
    return {
      erreur:
        "Désignez au moins un approbateur — sans cela, ce compte ne pourrait plus soumettre de dépense.",
    };
  }

  const circuit = await definirCircuit(id, demandes);

  await audit({
    actorId: admin.id, action: "CIRCUIT_MODIFIE", entity: "User", entityId: id,
    diff: { niveaux: circuit.length },
  });
  revalidatePath("/admin/utilisateurs");

  return {
    succes: `${user.nom} : ${circuit.length} approbateur(s) enregistré(s).`,
  };
}

export async function modifierUtilisateur(formData: FormData): Promise<void> {
  const admin = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const role = String(formData.get("role") ?? "") as Role;
  const actif = formData.get("actif") === "true";

  if (!ROLES.includes(role)) return;

  // Garde-fou : on ne se retire pas soi-meme les droits d'administration.
  if (id === admin.id && (role !== "ADMIN" || !actif)) return;

  const avant = await prisma.user.findUnique({ where: { id }, select: { role: true, actif: true } });
  await prisma.user.update({ where: { id }, data: { role, actif } });

  if (!actif) {
    await prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  await audit({
    actorId: admin.id, action: "UTILISATEUR_MODIFIE", entity: "User", entityId: id,
    diff: { avant, apres: { role, actif } },
  });
  revalidatePath("/admin/utilisateurs");
}
