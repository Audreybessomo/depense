/**
 * Jeu de donnees de demonstration : comptes, referentiels, taux de change et
 * une quinzaine de mois de demandes pour que les rapports aient du relief.
 * Idempotent : relancable sans dupliquer.
 */
import { PrismaClient, Prisma, type RequestStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const BASE = process.env.BASE_CURRENCY ?? "XAF";
const STORAGE = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");
const MOT_DE_PASSE = "Demo1234567";

// Generateur deterministe : le meme seed produit toujours le meme jeu.
let graine = 42;
const alea = () => {
  graine = (graine * 1103515245 + 12345) % 2147483648;
  return graine / 2147483648;
};
const choix = <T,>(liste: T[]): T => liste[Math.floor(alea() * liste.length)];
const entre = (min: number, max: number) => Math.round(min + alea() * (max - min));

/** PDF minimal mais valide, pour que la visionneuse ait quelque chose a afficher. */
function pdfFactice(titre: string): Buffer {
  // Helvetica de base ne connait pas les accents : on les retire pour que le
  // PDF de demonstration reste lisible dans la visionneuse.
  const propre = titre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()\\]/g, "");
  const contenu = `BT /F1 16 Tf 60 760 Td (${propre}) Tj ET`;
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objets.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { pdf += `${String(o).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function stocker(buffer: Buffer) {
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
  const key = `factures/${sha256.slice(0, 2)}/${sha256}.pdf`;
  const full = path.join(STORAGE, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return { storageKey: key, sha256, taille: buffer.length };
}

async function main() {
  console.log("→ Devises et taux de change");
  const devises = [
    { code: BASE, nom: "Franc CFA", symbole: "FCFA", decimals: 0, taux: 1 },
    { code: "EUR", nom: "Euro", symbole: "€", decimals: 2, taux: 655.957 },
    { code: "USD", nom: "Dollar américain", symbole: "$", decimals: 2, taux: 605.4 },
  ];
  for (const d of devises) {
    await prisma.currency.upsert({
      where: { code: d.code },
      create: { code: d.code, nom: d.nom, symbole: d.symbole, decimals: d.decimals },
      update: { nom: d.nom, symbole: d.symbole, decimals: d.decimals, actif: true },
    });
    const validFrom = new Date("2024-01-01T00:00:00Z");
    await prisma.exchangeRate.upsert({
      where: { currencyCode_validFrom: { currencyCode: d.code, validFrom } },
      create: { currencyCode: d.code, taux: new Prisma.Decimal(d.taux), validFrom },
      update: { taux: new Prisma.Decimal(d.taux) },
    });
  }

  console.log("→ Services et catégories de dépense");
  const services = await Promise.all(
    [
      ["Direction générale", "CC-100", 40_000_000],
      ["Direction technique", "CC-410", 120_000_000],
      ["Commercial & marketing", "CC-220", 65_000_000],
      ["Ressources humaines", "CC-310", 30_000_000],
      ["Logistique", "CC-500", 55_000_000],
    ].map(([nom, cc, budget]) =>
      prisma.department.upsert({
        where: { nom: nom as string },
        create: {
          nom: nom as string,
          costCenter: cc as string,
          budgetAnnuel: new Prisma.Decimal(budget as number),
        },
        update: {},
      }),
    ),
  );

  const categories = await Promise.all(
    [
      ["Prestations informatiques", "6226"],
      ["Fournitures de bureau", "6064"],
      ["Transport & déplacements", "6251"],
      ["Loyers & charges", "6132"],
      ["Télécommunications", "6262"],
      ["Maintenance & entretien", "6152"],
      ["Honoraires & conseil", "6226"],
      ["Énergie & eau", "6061"],
    ].map(([nom, compte]) =>
      prisma.category.upsert({
        where: { nom },
        create: { nom, compteComptable: compte },
        update: {},
      }),
    ),
  );

  console.log("→ Comptes utilisateurs");
  const hash = await bcrypt.hash(MOT_DE_PASSE, 12);
  const comptes = [
    { email: "admin@demo.local", nom: "Awa Ndiaye", role: "ADMIN" as const, service: 0 },
    { email: "valideur@demo.local", nom: "Marc Etoundi", role: "APPROBATEUR" as const, service: 1 },
    { email: "valideur2@demo.local", nom: "Clarisse Fotso", role: "APPROBATEUR" as const, service: 2 },
    { email: "valideur3@demo.local", nom: "Serge Kouam", role: "APPROBATEUR" as const, service: 0 },
    { email: "demandeur@demo.local", nom: "Yann Belinga", role: "DEMANDEUR" as const, service: 1 },
    { email: "demandeur2@demo.local", nom: "Sandra Mbala", role: "DEMANDEUR" as const, service: 2 },
    { email: "demandeur3@demo.local", nom: "Olivier Tchana", role: "DEMANDEUR" as const, service: 4 },
  ];

  const users = await Promise.all(
    comptes.map((c) =>
      prisma.user.upsert({
        where: { email: c.email },
        create: {
          email: c.email, nom: c.nom, role: c.role,
          passwordHash: hash, departmentId: services[c.service].id,
        },
        update: { nom: c.nom, role: c.role, passwordHash: hash },
      }),
    ),
  );

  const parEmail = (e: string) => users.find((u) => u.email === e)!;
  const demandeurs = [parEmail("demandeur@demo.local"), parEmail("demandeur2@demo.local"), parEmail("demandeur3@demo.local")];
  const valideurs = [parEmail("valideur@demo.local"), parEmail("valideur2@demo.local"), parEmail("valideur3@demo.local")];

  console.log("→ Approbateurs désignés");
  // Chaque personne a un ou plusieurs approbateurs, attribues par
  // l'administration. Ils sont sollicites en meme temps : le premier qui
  // statue decide pour tous.
  const circuits: Record<string, string[]> = {
    "demandeur@demo.local": ["valideur@demo.local"],
    "demandeur2@demo.local": ["valideur2@demo.local", "valideur3@demo.local"],
    "demandeur3@demo.local": ["valideur@demo.local"],
    "valideur@demo.local": ["valideur3@demo.local"],
    "valideur2@demo.local": ["valideur3@demo.local"],
    "valideur3@demo.local": ["valideur@demo.local"],
  };
  for (const [email, approbateurs] of Object.entries(circuits)) {
    const cible = users.find((u) => u.email === email);
    if (!cible) continue;
    await prisma.approverAssignment.deleteMany({ where: { userId: cible.id } });
    for (const [i, mail] of approbateurs.entries()) {
      const approbateur = users.find((u) => u.email === mail);
      if (!approbateur) continue;
      await prisma.approverAssignment.create({
        data: { userId: cible.id, approverId: approbateur.id, ordre: i + 1 },
      });
    }
  }

  const dejaSeme = await prisma.expenseRequest.count();
  if (dejaSeme > 0) {
    if (process.env.SEED_FORCE !== "1") {
      console.log(`→ ${dejaSeme} demandes déjà présentes. SEED_FORCE=1 pour régénérer.`);
      return;
    }
    console.log(`→ SEED_FORCE=1 : suppression des ${dejaSeme} demandes existantes`);
    await prisma.expenseRequest.deleteMany();
    await prisma.counter.deleteMany();
  }

  console.log("→ Demandes de démonstration (18 derniers mois)");
  const objets = [
    "Renouvellement des licences antivirus", "Abonnement internet fibre — trimestre",
    "Fournitures de bureau du mois", "Mission commerciale à Douala",
    "Loyer du siège — mensualité", "Maintenance des groupes électrogènes",
    "Honoraires audit comptable", "Facture d'électricité", "Hébergement cloud et sauvegardes",
    "Prestation de gardiennage", "Réparation du parc véhicules", "Impression des supports commerciaux",
    "Formation à la sécurité informatique", "Achat de consommables informatiques",
  ];

  const maintenant = new Date();
  const compteurAnnee: Record<number, number> = {};
  const compteurReglement: Record<number, number> = {};

  // Les references de reglement suivent la meme sequence que l'application.
  const referenceReglement = (annee: number) => {
    compteurReglement[annee] = (compteurReglement[annee] ?? 0) + 1;
    return `REG-${annee}-${String(compteurReglement[annee]).padStart(5, "0")}`;
  };

  for (let i = 0; i < 130; i++) {
    // Concentration recente : la moitie des demandes sur les 3 derniers mois.
    const joursEnArriere = alea() < 0.45 ? entre(0, 90) : entre(90, 540);
    const creeLe = new Date(maintenant.getTime() - joursEnArriere * 86_400_000);
    const annee = creeLe.getFullYear();
    compteurAnnee[annee] = (compteurAnnee[annee] ?? 0) + 1;

    const demandeur = choix(demandeurs);
    // On suit le circuit du demandeur, comme le fait l'application.
    const circuitDemandeur = circuits[demandeur.email] ?? [];
    const valideur =
      users.find((u) => u.email === circuitDemandeur[0]) ??
      choix(valideurs.filter((v) => v.id !== demandeur.id));
    const devise = alea() < 0.78 ? BASE : alea() < 0.6 ? "EUR" : "USD";
    const taux = devises.find((d) => d.code === devise)!.taux;

    const montant = devise === BASE ? entre(25_000, 4_500_000) : entre(80, 6_500);

    // Repartition realiste : la majorite est validee, une minorite traine.
    const tirage = alea();
    const regle = joursEnArriere >= 30 && tirage >= 0.12 && tirage < 0.6;
    // Une partie des dépenses réglées attend encore la confirmation du
    // demandeur : c'est le cas réel qu'il faut voir dans les écrans.
    const confirme = regle && alea() < 0.75;

    const statut: RequestStatus =
      joursEnArriere < 30 && tirage < 0.6 ? "EN_ATTENTE"
      : tirage < 0.07 ? "REJETEE"
      : tirage < 0.12 ? "INFO_DEMANDEE"
      : regle ? (confirme ? "CONFIRMEE" : "PAYEE")
      : "APPROUVEE";

    const soumisLe = new Date(creeLe.getTime() + entre(1, 20) * 3_600_000);
    const decideLe = ["APPROUVEE", "REJETEE", "PAYEE", "CONFIRMEE"].includes(statut)
      ? new Date(soumisLe.getTime() + entre(3, 96) * 3_600_000)
      : null;
    const regleLe = regle && decideLe
      ? new Date(decideLe.getTime() + entre(24, 240) * 3_600_000) : null;
    const confirmeLe = confirme && regleLe
      ? new Date(regleLe.getTime() + entre(12, 200) * 3_600_000) : null;

    const demande = await prisma.expenseRequest.create({
      data: {
        numero: `DEM-${annee}-${String(compteurAnnee[annee]).padStart(5, "0")}`,
        demandeurId: demandeur.id,
        departmentId: demandeur.departmentId,
        categoryId: choix(categories).id,
        objet: choix(objets),
        description: "Dépense engagée conformément au budget du service.",
        devise,
        montant: new Prisma.Decimal(montant),
        tauxChange: new Prisma.Decimal(taux),
        montantBase: new Prisma.Decimal((montant * taux).toFixed(2)),
        deviseBase: BASE,
        numeroPiece: `PC-${annee}-${String(entre(100, 999))}`,
        datePiece: creeLe,
        dateEcheance: new Date(creeLe.getTime() + 30 * 86_400_000),
        statut,
        niveauCourant: 1,
        submittedAt: soumisLe,
        decidedAt: decideLe,
        paidAt: regleLe,
        paymentRef: regle ? referenceReglement(annee) : null,
        paidById: regle ? valideur.id : null,
        confirmedAt: confirmeLe,
        confirmationNote: confirme
          ? "Règlement bien reçu. Facture définitive du prestataire jointe."
          : null,
        createdAt: creeLe,
      },
    });

    const statutDecideur =
      statut === "REJETEE" ? "REJETEE"
      : statut === "INFO_DEMANDEE" ? "INFO_DEMANDEE"
      : statut === "EN_ATTENTE" ? "EN_ATTENTE"
      : "APPROUVEE";

    // Tous les approbateurs designes sont saisis ; celui qui a tranche porte
    // la decision, les autres sont « traites par un autre ».
    const designes = circuitDemandeur
      .map((mail) => users.find((u) => u.email === mail))
      .filter((u): u is (typeof users)[number] => Boolean(u));
    const tous = designes.length > 0 ? designes : [valideur];

    for (const [i, approbateur] of tous.entries()) {
      const estLeDecideur = approbateur.id === valideur.id;
      await prisma.approvalStep.create({
        data: {
          requestId: demande.id,
          ordre: i + 1,
          approverId: approbateur.id,
          statut: estLeDecideur
            ? statutDecideur
            : statut === "EN_ATTENTE"
              ? "EN_ATTENTE"
              : "IGNOREE",
          commentaire:
            estLeDecideur && statut === "REJETEE"
              ? "Dépense non prévue au budget du service."
              : estLeDecideur && statut === "INFO_DEMANDEE"
                ? "Merci de joindre le bon de commande signé."
                : null,
          decidedAt: estLeDecideur ? decideLe : null,
          createdAt: soumisLe,
        },
      });
    }

    const fichier = await stocker(pdfFactice(`${demande.numero} — ${demande.objet}`));
    await prisma.attachment.create({
      data: {
        requestId: demande.id,
        filename: `${demande.numeroPiece}.pdf`,
        mimeType: "application/pdf",
        taille: fichier.taille,
        storageKey: fichier.storageKey,
        sha256: fichier.sha256,
        nature: "DEMANDE",
        scanStatus: "PROPRE",
        uploadedById: demandeur.id,
        createdAt: creeLe,
      },
    });

    if (confirmeLe) {
      const definitif = await stocker(
        pdfFactice(`${demande.numero} — facture définitive — ${demande.objet}`),
      );
      await prisma.attachment.create({
        data: {
          requestId: demande.id,
          filename: `Facture definitive ${demande.numeroPiece}.pdf`,
          mimeType: "application/pdf",
          taille: definitif.taille,
          storageKey: definitif.storageKey,
          sha256: definitif.sha256,
          nature: "CONFIRMATION",
          scanStatus: "PROPRE",
          uploadedById: demandeur.id,
          createdAt: confirmeLe,
        },
      });
      await prisma.comment.create({
        data: {
          requestId: demande.id,
          userId: demandeur.id,
          corps: "Règlement bien reçu. Facture définitive du prestataire jointe.",
          createdAt: confirmeLe,
        },
      });
    }
  }

  // Les compteurs doivent repartir apres les donnees semees, sinon la
  // premiere demande reelle reprendrait un numero deja pris.
  for (const [annee, dernier] of Object.entries(compteurAnnee)) {
    await prisma.counter.upsert({
      where: { annee: Number(annee) },
      create: { annee: Number(annee), dernier },
      update: { dernier },
    });
  }
  for (const [annee, dernier] of Object.entries(compteurReglement)) {
    await prisma.paymentCounter.upsert({
      where: { annee: Number(annee) },
      create: { annee: Number(annee), dernier },
      update: { dernier },
    });
  }

  console.log(`\n✅ Jeu de démonstration prêt.\n`);
  console.log(`   Mot de passe commun : ${MOT_DE_PASSE}`);
  comptes.forEach((c) => console.log(`   ${c.role.padEnd(12)} ${c.email}`));
  console.log("");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
