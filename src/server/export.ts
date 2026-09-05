import "server-only";
import { ZipArchive } from "archiver";
import { PassThrough, Readable } from "node:stream";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/money";
import { LIBELLE_STATUT } from "@/components/ui/statut";
import { DEVISE_BASE } from "@/server/currency";
import { lireFichier } from "@/server/storage";

/**
 * L'état des dépenses : une ligne par demande, et la colonne « Justificatifs »
 * porte le nom exact des fichiers rangés dans le dossier ZIP. C'est ce qui
 * permet de relier chaque montant à sa preuve, ligne par ligne.
 */
const COLONNES = [
  { cle: "numero", entete: "Référence", largeur: 17 },
  { cle: "statut", entete: "Statut", largeur: 13 },
  { cle: "date", entete: "Date de la dépense", largeur: 16 },
  { cle: "objet", entete: "Objet", largeur: 40 },
  { cle: "categorie", entete: "Catégorie", largeur: 22 },
  { cle: "service", entete: "Service", largeur: 20 },
  { cle: "demandeur", entete: "Demandeur", largeur: 22 },
  { cle: "numeroPiece", entete: "N° de pièce", largeur: 15 },
  { cle: "devise", entete: "Devise", largeur: 8 },
  { cle: "montant", entete: "Montant", largeur: 15 },
  { cle: "taux", entete: `Taux → ${DEVISE_BASE}`, largeur: 12 },
  { cle: "montantBase", entete: `Montant (${DEVISE_BASE})`, largeur: 17 },
  { cle: "approbateur", entete: "Approuvée par", largeur: 22 },
  { cle: "decideeLe", entete: "Décidée le", largeur: 17 },
  { cle: "delaiHeures", entete: "Délai (h)", largeur: 10 },
  { cle: "payeeLe", entete: "Réglée le", largeur: 17 },
  { cle: "referencePaiement", entete: "Réf. règlement", largeur: 18 },
  { cle: "confirmeeLe", entete: "Confirmée le", largeur: 17 },
  { cle: "messageDemandeur", entete: "Message du demandeur", largeur: 42 },
  { cle: "justificatifs", entete: "Justificatif de la dépense", largeur: 40 },
  { cle: "piecesApres", entete: "Pièces après règlement", largeur: 40 },
] as const;

const horodatage = (d: Date | null) =>
  d ? d.toISOString().slice(0, 16).replace("T", " ") : "";
const jour = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Nom de fichier sûr sur tous les systèmes, et lisible dans le ZIP. */
export function nomFichierSur(base: string, extension: string) {
  const propre = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 _-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${propre}.${extension}`;
}

const INCLUDE_EXPORT = {
  demandeur: { select: { nom: true } },
  department: { select: { nom: true } },
  category: { select: { nom: true } },
  attachments: {
    select: { id: true, filename: true, mimeType: true, storageKey: true, nature: true },
    orderBy: { createdAt: "asc" },
  },
  etapes: {
    include: { approver: { select: { nom: true } } },
    orderBy: { ordre: "asc" },
  },
} satisfies Prisma.ExpenseRequestInclude;

async function lignes(where: Prisma.ExpenseRequestWhereInput) {
  const demandes = await prisma.expenseRequest.findMany({
    where,
    include: INCLUDE_EXPORT,
    orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
    take: 20_000,
  });

  return demandes.map((d) => {
    const decideur = d.etapes.find((e) => e.statut === "APPROUVEE" || e.statut === "REJETEE");

    const nommer = (
      pieces: typeof d.attachments,
      dossier: string,
      suffixe: string,
    ) =>
      pieces.map((pj, i) => ({
        pj,
        chemin: `${dossier}/${nomFichierSur(
          `${d.numero}${suffixe}${pieces.length > 1 ? ` (${i + 1})` : ""} - ${d.objet}`,
          pj.mimeType === "application/pdf" ? "pdf" : pj.mimeType.split("/")[1],
        )}`,
      }));

    const demande = nommer(
      d.attachments.filter((a) => a.nature === "DEMANDE"), "Justificatifs", "",
    );
    const confirmation = nommer(
      d.attachments.filter((a) => a.nature === "CONFIRMATION"),
      "Pieces apres reglement", " apres reglement",
    );
    const fichiers = [...demande, ...confirmation];

    return {
      brut: d,
      fichiers,
      ligne: {
        numero: d.numero,
        statut: LIBELLE_STATUT[d.statut],
        date: jour(d.datePiece ?? d.submittedAt ?? d.createdAt),
        objet: d.objet,
        categorie: d.category?.nom ?? "",
        service: d.department?.nom ?? "",
        demandeur: d.demandeur.nom,
        numeroPiece: d.numeroPiece ?? "",
        devise: d.devise,
        montant: toNumber(d.montant),
        taux: toNumber(d.tauxChange),
        montantBase: toNumber(d.montantBase),
        approbateur: decideur?.approver.nom ?? "",
        decideeLe: horodatage(d.decidedAt),
        delaiHeures:
          d.submittedAt && d.decidedAt
            ? Number(((d.decidedAt.getTime() - d.submittedAt.getTime()) / 3_600_000).toFixed(1))
            : "",
        payeeLe: horodatage(d.paidAt),
        referencePaiement: d.paymentRef ?? "",
        confirmeeLe: d.confirmedAt
          ? horodatage(d.confirmedAt)
          : d.statut === "PAYEE" ? "EN ATTENTE DE CONFIRMATION" : "",
        messageDemandeur: d.confirmationNote ?? "",
        justificatifs:
          demande.map((f) => f.chemin.split("/").pop()).join(" | ") || "AUCUN JUSTIFICATIF",
        piecesApres:
          confirmation.map((f) => f.chemin.split("/").pop()).join(" | ") ||
          (d.statut === "PAYEE" ? "EN ATTENTE" : ""),
      },
    };
  });
}

/** CSV avec BOM UTF-8 et séparateur `;` : Excel français l'ouvre directement. */
export async function exportCsv(where: Prisma.ExpenseRequestWhereInput): Promise<string> {
  const donnees = await lignes(where);
  const echappe = (v: unknown) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const entetes = COLONNES.map((c) => c.entete).join(";");
  const corps = donnees
    .map((d) => COLONNES.map((c) => echappe((d.ligne as Record<string, unknown>)[c.cle])).join(";"))
    .join("\n");
  return `﻿${entetes}\n${corps}`;
}

export async function exportExcel(
  where: Prisma.ExpenseRequestWhereInput,
  titre: string,
  sousTitre?: string,
): Promise<Buffer> {
  const ExcelJS = (await import("exceljs")).default;
  const donnees = await lignes(where);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Gestion des Finances";
  const ws = wb.addWorksheet("État des dépenses", { views: [{ state: "frozen", ySplit: 3 }] });

  ws.mergeCells(1, 1, 1, COLONNES.length);
  ws.getCell(1, 1).value = titre;
  ws.getCell(1, 1).font = { bold: true, size: 13 };
  ws.getRow(1).height = 22;

  ws.mergeCells(2, 1, 2, COLONNES.length);
  ws.getCell(2, 1).value =
    `${sousTitre ? `${sousTitre} — ` : ""}${donnees.length} dépense(s) — édité le ${new Date().toLocaleString("fr-FR")}`;
  ws.getCell(2, 1).font = { size: 10, color: { argb: "FF64748B" } };

  ws.columns = COLONNES.map((c) => ({ key: c.cle, width: c.largeur }));

  const entete = ws.getRow(3);
  COLONNES.forEach((c, i) => {
    const cell = entete.getCell(i + 1);
    cell.value = c.entete;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { vertical: "middle" };
  });
  entete.height = 20;

  donnees.forEach((d) => {
    const row = ws.addRow(d.ligne);
    // Ce qui manque doit sauter aux yeux de celui qui relit l'état.
    if (d.fichiers.length === 0) {
      row.getCell("justificatifs").font = { color: { argb: "FFB91C1C" }, bold: true };
    }
    if (d.brut.statut === "PAYEE") {
      row.getCell("confirmeeLe").font = { color: { argb: "FFB45309" }, bold: true };
      row.getCell("piecesApres").font = { color: { argb: "FFB45309" }, bold: true };
    }
  });

  ["montant", "montantBase"].forEach((cle) => {
    const col = ws.getColumn(cle);
    col.numFmt = "# ##0.00";
    col.alignment = { horizontal: "right" };
  });
  ws.getColumn("taux").numFmt = "0.0000";

  const derniere = ws.rowCount;
  const total = ws.addRow({
    numero: "TOTAL",
    montantBase: donnees.reduce((s, d) => s + d.ligne.montantBase, 0),
  });
  total.font = { bold: true };
  total.getCell("montantBase").numFmt = "# ##0.00";
  ws.getCell(total.number, 1).border = { top: { style: "double" } };

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: derniere, column: COLONNES.length } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * Le dossier complet : l'état Excel plus toutes les pièces justificatives,
 * chacune renommée d'après la référence de sa demande. C'est le livrable que
 * l'on remet à un comptable, à un bailleur ou à un commissaire aux comptes.
 *
 * Le ZIP est produit en flux : les fichiers sont ajoutés un par un, jamais
 * tous chargés en mémoire d'un coup.
 */
export async function dossierJustificatifs(
  where: Prisma.ExpenseRequestWhereInput,
  titre: string,
  sousTitre: string,
) {
  const donnees = await lignes(where);
  const excel = await exportExcel(where, titre, sousTitre);

  const archive = new ZipArchive({ zlib: { level: 6 } });
  const sortie = new PassThrough();
  archive.pipe(sortie);

  archive.append(excel, { name: nomFichierSur(`Etat des depenses - ${sousTitre}`, "xlsx") });

  const manquants: string[] = [];
  const attentes: string[] = [];
  void (async () => {
    try {
      for (const d of donnees) {
        for (const { pj, chemin } of d.fichiers) {
          try {
            const contenu = await lireFichier(pj.storageKey);
            archive.append(contenu, { name: chemin });
          } catch {
            manquants.push(`${d.ligne.numero} — ${pj.filename}`);
          }
        }
        if (d.fichiers.length === 0) manquants.push(`${d.ligne.numero} — aucune pièce`);
        if (d.brut.statut === "PAYEE") {
          attentes.push(`${d.ligne.numero} — ${d.ligne.objet}`);
        }
      }

      if (manquants.length > 0) {
        archive.append(
          `Dépenses sans justificatif exploitable au moment de l'édition :\n\n${manquants.join("\n")}\n`,
          { name: "PIECES-MANQUANTES.txt" },
        );
      }
      if (attentes.length > 0) {
        archive.append(
          "Dépenses réglées dont le demandeur n'a pas encore confirmé la réception\n" +
            "ni rapporté ses pièces définitives :\n\n" +
            `${attentes.join("\n")}\n`,
          { name: "CONFIRMATIONS-EN-ATTENTE.txt" },
        );
      }
      await archive.finalize();
    } catch {
      archive.abort();
    }
  })();

  return {
    flux: Readable.toWeb(sortie) as ReadableStream<Uint8Array>,
    nombreDemandes: donnees.length,
  };
}
