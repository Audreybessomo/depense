"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { audit } from "@/server/audit";
import { consommerLoginToken, creerSession, hashPassword } from "@/server/auth";

export type EtatMdp = { erreur?: string };

const schema = z
  .object({
    token: z.string().min(1),
    motDePasse: z
      .string()
      .min(10, "Le mot de passe doit faire au moins 10 caractères")
      .regex(/[A-Za-z]/, "Le mot de passe doit contenir au moins une lettre")
      .regex(/[0-9]/, "Le mot de passe doit contenir au moins un chiffre"),
    confirmation: z.string(),
  })
  .refine((d) => d.motDePasse === d.confirmation, {
    message: "Les deux mots de passe ne correspondent pas",
    path: ["confirmation"],
  });

export async function definirMotDePasse(_: EtatMdp, formData: FormData): Promise<EtatMdp> {
  const parsed = schema.safeParse({
    token: String(formData.get("token") ?? ""),
    motDePasse: String(formData.get("motDePasse") ?? ""),
    confirmation: String(formData.get("confirmation") ?? ""),
  });
  if (!parsed.success) return { erreur: parsed.error.issues[0].message };

  const userId = await consommerLoginToken(parsed.data.token, "SET_PASSWORD");
  if (!userId) return { erreur: "Ce lien a expiré ou a déjà été utilisé." };

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(parsed.data.motDePasse) },
  });

  // Toute session ouverte est revoquee : changer son mot de passe doit
  // deconnecter les appareils deja connectes.
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  await audit({ actorId: userId, action: "MOT_DE_PASSE_DEFINI", entity: "User", entityId: userId });
  await creerSession(userId);
  redirect("/");
}
