"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/server/rate-limit";
import { audit } from "@/server/audit";
import { creerSession, verifyPassword } from "@/server/auth";

export type EtatLogin = { erreur?: string };

const schemaConnexion = z.object({
  email: z.string().email("Adresse email invalide"),
  motDePasse: z.string().min(1, "Mot de passe requis"),
});

async function cleIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function connexion(_: EtatLogin, formData: FormData): Promise<EtatLogin> {
  const parsed = schemaConnexion.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    motDePasse: String(formData.get("motDePasse") ?? ""),
  });
  if (!parsed.success) return { erreur: parsed.error.issues[0].message };

  // 10 tentatives / 10 min par IP, 5 par compte : freine le bourrage
  // d'identifiants sans bloquer un bureau derriere une IP partagee.
  const ip = await cleIp();
  if (!rateLimit(`login:ip:${ip}`, 10, 600_000).ok) {
    return { erreur: "Trop de tentatives. Réessayez dans quelques minutes." };
  }
  if (!rateLimit(`login:mail:${parsed.data.email}`, 5, 600_000).ok) {
    return { erreur: "Trop de tentatives sur ce compte. Réessayez dans quelques minutes." };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const messageGenerique = { erreur: "Identifiants incorrects." };

  if (!user?.passwordHash || !user.actif) return messageGenerique;
  if (!(await verifyPassword(parsed.data.motDePasse, user.passwordHash))) {
    await audit({ actorId: user.id, action: "CONNEXION_ECHEC", entity: "User", entityId: user.id });
    return messageGenerique;
  }

  await creerSession(user.id);
  await audit({ actorId: user.id, action: "CONNEXION", entity: "User", entityId: user.id });
  redirect("/");
}

