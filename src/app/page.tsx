import { redirect } from "next/navigation";
import { getCurrentUser, voitTout } from "@/server/auth";

export default async function Accueil() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Les approbateurs et administrateurs arrivent sur le pilotage, les
  // demandeurs sur leurs propres depenses.
  if (voitTout(user.role)) redirect("/admin");
  redirect("/demandes");
}
