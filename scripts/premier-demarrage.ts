/**
 * Amorçage au premier lancement du conteneur : crée l'administrateur initial
 * s'il n'en existe aucun, et affiche ses identifiants dans les journaux.
 *
 * Relancé à chaque démarrage, il ne fait rien si un administrateur existe
 * déjà — un redémarrage ne doit pas fabriquer de compte supplémentaire.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const ALPHABET = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function motDePasse(longueur = 14) {
  const source = crypto.getRandomValues(new Uint32Array(longueur));
  let mot = "";
  for (let i = 0; i < longueur; i++) mot += ALPHABET[source[i] % ALPHABET.length];
  if (!/[0-9]/.test(mot)) mot = `${mot.slice(0, -1)}${"23456789"[source[0] % 8]}`;
  return mot;
}

async function main() {
  const prisma = new PrismaClient();

  const nom = process.env.ADMIN_NOM ?? "Administrateur";
  const email = (process.env.ADMIN_EMAIL ?? "admin@local").toLowerCase();
  const url = process.env.APP_URL ?? "http://localhost:3000";

  const existants = await prisma.user.count({ where: { role: "ADMIN", actif: true } });
  if (existants > 0) {
    console.log(`[amorçage] ${existants} administrateur(s) déjà en place, rien à faire.`);
    await prisma.$disconnect();
    return;
  }

  // Les devises sont indispensables : une dépense en référence toujours une.
  const devises = [
    { code: process.env.BASE_CURRENCY ?? "XAF", nom: "Franc CFA", symbole: "FCFA", decimals: 0, taux: 1 },
    { code: "EUR", nom: "Euro", symbole: "€", decimals: 2, taux: 655.957 },
    { code: "USD", nom: "Dollar américain", symbole: "$", decimals: 2, taux: 605.4 },
  ];
  for (const d of devises) {
    await prisma.currency.upsert({
      where: { code: d.code },
      create: { code: d.code, nom: d.nom, symbole: d.symbole, decimals: d.decimals },
      update: {},
    });
    const validFrom = new Date("2025-01-01");
    await prisma.exchangeRate.upsert({
      where: { currencyCode_validFrom: { currencyCode: d.code, validFrom } },
      create: { currencyCode: d.code, taux: new (await import("@prisma/client")).Prisma.Decimal(d.taux), validFrom },
      update: {},
    });
  }

  const mot = motDePasse();
  const user = await prisma.user.create({
    data: {
      nom, email, role: "ADMIN",
      passwordHash: await bcrypt.hash(mot, 12),
      doitChangerMotDePasse: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: null, action: "ADMIN_AMORCE", entity: "User", entityId: user.id,
      diff: { email: user.email, source: "premier démarrage du conteneur" },
    },
  });

  const cadre = "─".repeat(58);
  console.log(`\n┌${cadre}┐`);
  console.log(`  PREMIER DÉMARRAGE — compte administrateur créé`);
  console.log(`${" ".repeat(2)}`);
  console.log(`  Connexion    : ${url}/login`);
  console.log(`  Adresse      : ${user.email}`);
  console.log(`  Mot de passe : ${mot}`);
  console.log(`${" ".repeat(2)}`);
  console.log(`  Ce mot de passe devra être changé à la première connexion.`);
  console.log(`└${cadre}┘\n`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error("[amorçage] échec :", e); process.exit(1); });
