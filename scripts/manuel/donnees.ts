/**
 * Jeu de données dédié aux captures du manuel : une petite entreprise
 * crédible, avec des dépenses à tous les stades du circuit. Cette base est
 * séparée de la base de travail — voir DATABASE_URL.
 */
import { PrismaClient, Prisma, type RequestStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const STORAGE = path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");
const MDP = "Manuel2026x";

function pdf(titre: string): Buffer {
  const texte = titre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[()\\]/g, "");
  const flux = `BT /F1 15 Tf 60 770 Td (${texte}) Tj ET`;
  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${flux.length} >>\nstream\n${flux}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const pos: number[] = [];
  objets.forEach((o, i) => { pos.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  pos.forEach((o) => { out += `${String(o).padStart(10, "0")} 00000 n \n`; });
  out += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}

async function stocker(buf: Buffer) {
  const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
  const key = `factures/${sha256.slice(0, 2)}/${sha256}.pdf`;
  const full = path.join(STORAGE, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buf);
  return { storageKey: key, sha256, taille: buf.length };
}

async function main() {
  for (const t of [
    () => prisma.notification.deleteMany(), () => prisma.comment.deleteMany(),
    () => prisma.approvalStep.deleteMany(), () => prisma.attachment.deleteMany(),
    () => prisma.expenseRequest.deleteMany(), () => prisma.approverAssignment.deleteMany(),
    () => prisma.auditLog.deleteMany(), () => prisma.session.deleteMany(),
    () => prisma.loginToken.deleteMany(), () => prisma.user.deleteMany(),
    () => prisma.category.deleteMany(), () => prisma.department.deleteMany(),
    () => prisma.counter.deleteMany(), () => prisma.paymentCounter.deleteMany(),
  ]) await t();

  for (const d of [
    { code: "XAF", nom: "Franc CFA", symbole: "FCFA", decimals: 0, taux: 1 },
    { code: "EUR", nom: "Euro", symbole: "€", decimals: 2, taux: 655.957 },
    { code: "USD", nom: "Dollar américain", symbole: "$", decimals: 2, taux: 605.4 },
  ]) {
    await prisma.currency.upsert({
      where: { code: d.code },
      create: { code: d.code, nom: d.nom, symbole: d.symbole, decimals: d.decimals },
      update: {},
    });
    const validFrom = new Date("2025-01-01");
    await prisma.exchangeRate.upsert({
      where: { currencyCode_validFrom: { currencyCode: d.code, validFrom } },
      create: { currencyCode: d.code, taux: new Prisma.Decimal(d.taux), validFrom },
      update: {},
    });
  }

  const services = await Promise.all(
    [["Direction", "CC-100"], ["Technique", "CC-200"], ["Commercial", "CC-300"], ["Logistique", "CC-400"]]
      .map(([nom, cc]) => prisma.department.create({ data: { nom, costCenter: cc } })),
  );
  const categories = await Promise.all(
    ["Fournitures de bureau", "Transport & carburant", "Télécommunications",
     "Maintenance & entretien", "Prestations informatiques", "Énergie & eau"]
      .map((nom) => prisma.category.create({ data: { nom } })),
  );

  const hash = await bcrypt.hash(MDP, 12);
  const faire = (nom: string, email: string, role: "ADMIN" | "APPROBATEUR" | "DEMANDEUR", svc: number) =>
    prisma.user.create({
      data: { nom, email, role, passwordHash: hash, departmentId: services[svc].id, lastLoginAt: new Date() },
    });

  const admin = await faire("Awa Ndiaye", "direction@entreprise.cm", "ADMIN", 0);
  const marc = await faire("Marc Etoundi", "m.etoundi@entreprise.cm", "APPROBATEUR", 1);
  const clarisse = await faire("Clarisse Fotso", "c.fotso@entreprise.cm", "APPROBATEUR", 0);
  const yann = await faire("Yann Belinga", "y.belinga@entreprise.cm", "DEMANDEUR", 1);
  const sandra = await faire("Sandra Mbala", "s.mbala@entreprise.cm", "DEMANDEUR", 2);
  const olivier = await faire("Olivier Tchana", "o.tchana@entreprise.cm", "DEMANDEUR", 3);

  for (const [u, appros] of [[yann, [marc]], [sandra, [marc, clarisse]], [olivier, [marc]]] as const) {
    for (const [i, a] of appros.entries()) {
      await prisma.approverAssignment.create({ data: { userId: u.id, approverId: a.id, ordre: i + 1 } });
    }
  }

  const jours = (n: number) => new Date(Date.now() - n * 86_400_000);
  let seqD = 0, seqR = 0;
  const annee = new Date().getFullYear();

  const lot: [string, number, typeof yann, typeof marc, RequestStatus, number, number][] = [
    ["Cartouches et ramettes A4", 145_000, yann, marc, "CONFIRMEE", 0, 41],
    ["Carburant tournée Douala", 260_000, olivier, marc, "CONFIRMEE", 1, 34],
    ["Abonnement fibre — trimestre", 890_000, sandra, marc, "PAYEE", 2, 22],
    ["Entretien groupe électrogène", 415_000, olivier, marc, "PAYEE", 3, 18],
    ["Licences antivirus 20 postes", 1_250_000, yann, marc, "APPROUVEE", 4, 12],
    ["Facture d'électricité août", 730_000, sandra, clarisse, "APPROUVEE", 5, 9],
    ["Réparation véhicule de service", 385_000, olivier, marc, "REJETEE", 3, 15],
    ["Frais de mission Yaoundé", 520_000, yann, marc, "EN_ATTENTE", 1, 4],
    ["Recharge crédit téléphonique", 90_000, sandra, marc, "EN_ATTENTE", 2, 2],
    ["Petit outillage atelier", 178_000, olivier, marc, "INFO_DEMANDEE", 0, 6],
  ];

  for (const [objet, montant, dem, appro, statut, cat, ilya] of lot) {
    const creeLe = jours(ilya);
    const soumisLe = new Date(creeLe.getTime() + 3_600_000);
    const decide = ["APPROUVEE", "REJETEE", "PAYEE", "CONFIRMEE"].includes(statut);
    const decideLe = decide ? new Date(soumisLe.getTime() + 20 * 3_600_000) : null;
    const regle = ["PAYEE", "CONFIRMEE"].includes(statut);
    const regleLe = regle && decideLe ? new Date(decideLe.getTime() + 40 * 3_600_000) : null;
    const confirme = statut === "CONFIRMEE";
    const confirmeLe = confirme && regleLe ? new Date(regleLe.getTime() + 30 * 3_600_000) : null;

    const d = await prisma.expenseRequest.create({
      data: {
        numero: `DEM-${annee}-${String(++seqD).padStart(5, "0")}`,
        demandeurId: dem.id, departmentId: dem.departmentId, categoryId: categories[cat].id,
        objet, description: "Dépense engagée conformément au budget du service.",
        devise: "XAF", montant: new Prisma.Decimal(montant),
        montantBase: new Prisma.Decimal(montant), deviseBase: "XAF",
        numeroPiece: `RECU-${String(1000 + seqD)}`, datePiece: creeLe,
        dateEcheance: new Date(creeLe.getTime() + 30 * 86_400_000),
        statut, niveauCourant: 1, submittedAt: soumisLe, decidedAt: decideLe,
        paidAt: regleLe, paymentRef: regle ? `REG-${annee}-${String(++seqR).padStart(5, "0")}` : null,
        paidById: regle ? appro.id : null,
        confirmedAt: confirmeLe,
        confirmationNote: confirme ? "Règlement bien reçu, facture définitive jointe." : null,
        createdAt: creeLe,
      },
    });

    const designes = await prisma.approverAssignment.findMany({
      where: { userId: dem.id }, orderBy: { ordre: "asc" },
    });
    for (const [i, a] of designes.entries()) {
      const decideur = a.approverId === appro.id;
      await prisma.approvalStep.create({
        data: {
          requestId: d.id, ordre: i + 1, approverId: a.approverId,
          statut: decideur
            ? (statut === "REJETEE" ? "REJETEE"
              : statut === "INFO_DEMANDEE" ? "INFO_DEMANDEE"
              : statut === "EN_ATTENTE" ? "EN_ATTENTE" : "APPROUVEE")
            : (statut === "EN_ATTENTE" ? "EN_ATTENTE" : "IGNOREE"),
          commentaire: decideur && statut === "REJETEE"
            ? "Réparation non prévue au budget, à reporter au trimestre prochain."
            : decideur && statut === "INFO_DEMANDEE"
              ? "Merci de joindre le bon de livraison signé." : null,
          decidedAt: decideur ? decideLe : null, createdAt: soumisLe,
        },
      });
    }

    const f = await stocker(pdf(`${d.numero} — ${objet}`));
    await prisma.attachment.create({
      data: {
        requestId: d.id, filename: `${d.numeroPiece}.pdf`, mimeType: "application/pdf",
        taille: f.taille, storageKey: f.storageKey, sha256: f.sha256,
        nature: "DEMANDE", scanStatus: "PROPRE", uploadedById: dem.id, createdAt: creeLe,
      },
    });
    if (confirmeLe) {
      const g = await stocker(pdf(`${d.numero} — facture definitive`));
      await prisma.attachment.create({
        data: {
          requestId: d.id, filename: `Facture definitive ${d.numeroPiece}.pdf`,
          mimeType: "application/pdf", taille: g.taille, storageKey: g.storageKey,
          sha256: g.sha256, nature: "CONFIRMATION", scanStatus: "PROPRE",
          uploadedById: dem.id, createdAt: confirmeLe,
        },
      });
      await prisma.comment.create({
        data: { requestId: d.id, userId: dem.id, corps: "Règlement bien reçu, facture définitive jointe.", createdAt: confirmeLe },
      });
    }
    if (statut === "EN_ATTENTE") {
      await prisma.notification.create({
        data: { userId: appro.id, requestId: d.id, type: "DEMANDE_A_VALIDER",
          titre: `${d.numero} — à valider`, corps: `${dem.nom} · ${objet}`, createdAt: soumisLe },
      });
    }
  }

  await prisma.counter.create({ data: { annee, dernier: seqD } });
  await prisma.paymentCounter.create({ data: { annee, dernier: seqR } });

  console.log(`  ${seqD} dépenses · 6 comptes · ${categories.length} catégories · ${services.length} services`);
  console.log(`  mot de passe commun : ${MDP}`);
  await prisma.$disconnect();
}
main();
