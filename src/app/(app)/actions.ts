"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { detruireSession, getCurrentUser } from "@/server/auth";
import { audit } from "@/server/audit";
import { marquerToutesLues } from "@/server/notifications";

export async function deconnexion() {
  const user = await getCurrentUser();
  if (user) {
    await audit({ actorId: user.id, action: "DECONNEXION", entity: "User", entityId: user.id });
  }
  await detruireSession();
  redirect("/login?erreur=deconnecte");
}

export async function toutMarquerLu() {
  const user = await getCurrentUser();
  if (!user) return;
  await marquerToutesLues(user.id);
  revalidatePath("/", "layout");
}
