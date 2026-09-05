/**
 * Amorce le TOUT PREMIER administrateur d'une instance, et rien d'autre.
 *
 * Passé ce point, la création de comptes appartient à l'administrateur, depuis
 * Administration → Utilisateurs : le script refuse de s'exécuter dès qu'un
 * administrateur actif existe. Sans ce garde-fou, quiconque a un accès shell au
 * serveur pourrait se fabriquer un compte administrateur en dehors de
 * l'application, sans laisser de trace dans le journal d'audit.
 *
 *   npx tsx scripts/creer-admin.ts "Nom Prénom" admin@entreprise.com
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { genererMotDePasse } from "../src/lib/mot-de-passe";

async function main() {
  const [nom, email] = process.argv.slice(2);
  if (!nom || !email) {
    console.error('Usage : npx tsx scripts/creer-admin.ts "Nom Prénom" <email>');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  const administrateurs = await prisma.user.findMany({
    where: { role: "ADMIN", actif: true },
    select: { nom: true, email: true },
    orderBy: { createdAt: "asc" },
  });

  if (administrateurs.length > 0) {
    console.error(
      `\n❌ Cette instance a déjà ${administrateurs.length} administrateur(s) :\n` +
        administrateurs.map((a) => `   • ${a.nom} <${a.email}>`).join("\n") +
        "\n\nLes comptes suivants se créent depuis l'application :" +
        "\n   Administration → Utilisateurs → Inviter un utilisateur" +
        "\n\nC'est volontaire : chaque création laisse ainsi une trace au journal" +
        "\nd'audit, avec le nom de l'administrateur qui en est à l'origine.\n",
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  const motDePasse = genererMotDePasse();
  const user = await prisma.user.create({
    data: {
      nom,
      email: email.toLowerCase(),
      role: "ADMIN",
      passwordHash: await bcrypt.hash(motDePasse, 12),
      doitChangerMotDePasse: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: null,
      action: "ADMIN_AMORCE",
      entity: "User",
      entityId: user.id,
      diff: { email: user.email, source: "scripts/creer-admin.ts" },
    },
  });

  const base = process.env.APP_URL ?? "http://localhost:3000";
  console.log(`\n✅ Premier administrateur créé.\n`);
  console.log(`   Connexion    : ${base}/login`);
  console.log(`   Adresse      : ${user.email}`);
  console.log(`   Mot de passe : ${motDePasse}`);
  console.log(`\n   Ce mot de passe devra être changé à la première connexion.`);
  console.log(`   Les comptes suivants se créent depuis Administration → Utilisateurs.\n`);

  await prisma.$disconnect();
}

main();
