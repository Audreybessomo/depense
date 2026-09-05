/**
 * Produit les captures du manuel avec le Chrome installé sur la machine.
 * La connexion se fait par jeton à usage unique — aucun mot de passe n'est
 * saisi. Cible la base de démonstration du manuel, pas la base de travail.
 */
import { PrismaClient } from "@prisma/client";
import puppeteer from "puppeteer-core";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const BASE = "http://localhost:3002";
const SORTIE = path.resolve("docs/manuel/captures");

const prisma = new PrismaClient();

async function jeton(email: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const u = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.loginToken.create({
    data: {
      userId: u.id, purpose: "MAGIC_LINK",
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  return `${BASE}/login/verify?token=${token}`;
}

type Vue = { fichier: string; url: string; hauteur?: number; avant?: string };

async function main() {
  await fs.mkdir(SORTIE, { recursive: true });

  const navigateur = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--force-color-profile=srgb"],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
  });

  const capture = async (page: import("puppeteer-core").Page, v: Vue) => {
    await page.goto(`${BASE}${v.url}`, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1200));
    if (v.avant) await page.evaluate(v.avant);
    await new Promise((r) => setTimeout(r, 700));
    if (v.hauteur) await page.setViewport({ width: 1440, height: v.hauteur, deviceScaleFactor: 2 });
    await new Promise((r) => setTimeout(r, 400));
    const chemin = path.join(SORTIE, `${v.fichier}.png`);
    await page.screenshot({ path: chemin as `${string}.png` });
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    const { size } = await fs.stat(chemin);
    console.log(`  ${v.fichier.padEnd(28)} ${(size / 1024).toFixed(0)} Ko`);
  };

  // --- page publique -------------------------------------------------------
  const publique = await navigateur.newPage();
  await capture(publique, { fichier: "01-connexion", url: "/login", hauteur: 760 });
  await publique.close();

  // --- espace administrateur ----------------------------------------------
  const admin = await navigateur.newPage();
  await admin.goto(await jeton("direction@entreprise.cm"), { waitUntil: "networkidle0" });
  for (const v of [
    { fichier: "02-tableau-de-bord", url: "/admin", hauteur: 1500 },
    { fichier: "03-referentiels", url: "/admin/referentiels", hauteur: 1250 },
    { fichier: "04-utilisateurs", url: "/admin/utilisateurs", hauteur: 1000 },
    { fichier: "05-creer-compte", url: "/admin/utilisateurs", hauteur: 1250,
      avant: `[...document.querySelectorAll('button')].find(b => b.textContent.includes('Créer un compte'))?.click()` },
    { fichier: "09-toutes-les-depenses", url: "/admin/demandes", hauteur: 1150 },
    { fichier: "10-rapports", url: "/admin/rapports?periode=annee", hauteur: 1700 },
    { fichier: "11-etat-justificatifs", url: "/admin/etat?periode=annee&portee=engage", hauteur: 1500 },
    { fichier: "12-journal-audit", url: "/admin/audit", hauteur: 1100 },
  ] as Vue[]) await capture(admin, v);
  await admin.close();

  // --- espace demandeur ----------------------------------------------------
  const demandeur = await navigateur.newPage();
  await demandeur.goto(await jeton("y.belinga@entreprise.cm"), { waitUntil: "networkidle0" });
  for (const v of [
    { fichier: "06-mes-depenses", url: "/demandes", hauteur: 1000 },
    { fichier: "07-nouvelle-depense", url: "/demandes/nouvelle", hauteur: 1500 },
  ] as Vue[]) await capture(demandeur, v);
  await demandeur.close();

  // --- espace approbateur --------------------------------------------------
  const approbateur = await navigateur.newPage();
  await approbateur.goto(await jeton("m.etoundi@entreprise.cm"), { waitUntil: "networkidle0" });
  await capture(approbateur, { fichier: "08-a-valider", url: "/validations", hauteur: 1000 });

  const aValider = await prisma.expenseRequest.findFirstOrThrow({ where: { statut: "EN_ATTENTE" } });
  await capture(approbateur, {
    fichier: "08b-decision", url: `/demandes/${aValider.id}`, hauteur: 1400,
  });

  const aRegler = await prisma.expenseRequest.findFirstOrThrow({ where: { statut: "APPROUVEE" } });
  await capture(approbateur, {
    fichier: "13-reglement", url: `/demandes/${aRegler.id}`, hauteur: 1400,
  });
  await capture(approbateur, { fichier: "14-a-regler", url: "/tresorerie", hauteur: 1100 });
  await approbateur.close();

  // --- confirmation par le demandeur --------------------------------------
  const aConfirmer = await prisma.expenseRequest.findFirstOrThrow({
    where: { statut: "PAYEE" }, include: { demandeur: true },
  });
  const titulaire = await navigateur.newPage();
  await titulaire.goto(await jeton(aConfirmer.demandeur.email), { waitUntil: "networkidle0" });
  await capture(titulaire, {
    fichier: "15-confirmation", url: `/demandes/${aConfirmer.id}`, hauteur: 1500,
  });
  await titulaire.close();

  await navigateur.close();
  await prisma.$disconnect();
}
main();
