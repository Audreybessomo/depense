import { NextResponse, type NextRequest } from "next/server";
import { consommerLoginToken, creerSession } from "@/server/auth";
import { audit } from "@/server/audit";
import { env } from "@/lib/env";

/** Point d'entree du lien de connexion recu par email. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/login?erreur=lien_invalide", env.APP_URL));
  }

  const userId = await consommerLoginToken(token, "MAGIC_LINK");
  if (!userId) {
    return NextResponse.redirect(new URL("/login?erreur=lien_expire", env.APP_URL));
  }

  await creerSession(userId);
  await audit({ actorId: userId, action: "CONNEXION_LIEN", entity: "User", entityId: userId });
  return NextResponse.redirect(new URL("/", env.APP_URL));
}
