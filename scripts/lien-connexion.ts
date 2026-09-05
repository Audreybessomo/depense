/**
 * Fabrique un lien de connexion pour un compte, sans passer par l'email.
 * Utile en developpement et pour depanner un utilisateur bloque.
 *
 *   npx tsx scripts/lien-connexion.ts valideur@demo.local
 */
import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage : npx tsx scripts/lien-connexion.ts <email>");
    process.exit(1);
  }

  const prisma = new PrismaClient();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Aucun compte pour ${email}`);
    process.exit(1);
  }

  await prisma.loginToken.create({
    data: {
      userId: user.id,
      purpose: "MAGIC_LINK",
      tokenHash,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  console.log(`${base}/login/verify?token=${token}`);
  await prisma.$disconnect();
}

main();
