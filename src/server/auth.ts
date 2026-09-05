import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import type { Role, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

export const SESSION_COOKIE = "gdf_session";

/**
 * Le cookie ne contient qu'un jeton opaque aleatoire ; seule son empreinte
 * SHA-256 est stockee en base. Une session peut donc etre revoquee cote
 * serveur, et une fuite de base ne permet pas de rejouer un cookie.
 */
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function genererToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function creerSession(userId: string) {
  const token = genererToken();
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_DAYS * 86_400_000);
  const h = await headers();

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
    },
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export async function detruireSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
  store.delete(SESSION_COOKIE);
}

export type SessionUser = Pick<
  User,
  "id" | "email" | "nom" | "role" | "actif" | "departmentId" | "doitChangerMotDePasse"
>;

/**
 * Resout l'utilisateur courant. `cache()` garantit une seule requete SQL
 * par rendu, meme si dix composants appellent la fonction.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
        id: true, email: true, nom: true, role: true, actif: true,
        departmentId: true, doitChangerMotDePasse: true,
      },
      },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (!session.user.actif) return null;
  return session.user;
});

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/acces-refuse");
  return user;
}

export const estAdmin = (r: Role) => r === "ADMIN";

/// Approbateurs et administrateurs voient l'ensemble des depenses : c'est eux
/// qui produisent l'etat de fin de periode.
export const voitTout = (r: Role) => r === "ADMIN" || r === "APPROBATEUR";

/// Approuver, rejeter, demander un complement ET marquer paye : un seul role.
export const peutApprouver = (r: Role) => r === "APPROBATEUR" || r === "ADMIN";
export const peutRegler = (r: Role) => r === "APPROBATEUR" || r === "ADMIN";

// --- Jetons a usage unique (lien de connexion / mot de passe oublie) --------

export async function creerLoginToken(
  userId: string,
  purpose: "MAGIC_LINK" | "SET_PASSWORD",
  ttlMinutes = 30,
) {
  const token = genererToken();
  await prisma.loginToken.create({
    data: {
      userId,
      purpose,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
    },
  });
  return token;
}

export async function consommerLoginToken(token: string, purpose?: string) {
  const row = await prisma.loginToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, actif: true } } },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  if (purpose && row.purpose !== purpose) return null;
  if (!row.user.actif) return null;

  await prisma.loginToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.user.id;
}
