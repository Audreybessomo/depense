"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, hashPassword, verifyPassword } from "@/server/auth";
import { audit } from "@/server/audit";
import { verifierMotDePasse } from "@/lib/mot-de-passe";

export type EtatChangement = { erreur?: string };

export async function changerMotDePasse(
  _: EtatChangement,
  formData: FormData,
): Promise<EtatChangement> {
  const user = await requireUser();

  const actuel = String(formData.get("actuel") ?? "");
  const nouveau = String(formData.get("nouveau") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");

  const complet = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  // On redemande le mot de passe courant : sans cela, une session laissée
  // ouverte sur un poste suffirait à voler le compte.
  if (!complet.passwordHash || !(await verifyPassword(actuel, complet.passwordHash))) {
    return { erreur: "Mot de passe actuel incorrect." };
  }
  if (nouveau !== confirmation) {
    return { erreur: "Les deux nouveaux mots de passe ne correspondent pas." };
  }
  if (await verifyPassword(nouveau, complet.passwordHash)) {
    return { erreur: "Choisissez un mot de passe différent de l'actuel." };
  }
  const faiblesse = verifierMotDePasse(nouveau);
  if (faiblesse) return { erreur: faiblesse };

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(nouveau), doitChangerMotDePasse: false },
  });

  await audit({
    actorId: user.id, action: "MOT_DE_PASSE_CHANGE", entity: "User", entityId: user.id,
  });

  redirect("/");
}
