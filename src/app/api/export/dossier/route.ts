import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, voitTout } from "@/server/auth";
import { dossierJustificatifs } from "@/server/export";
import { resolvePeriod, type PeriodKey } from "@/lib/dates";
import { filtresEtat, libelleEtat } from "@/server/etat";
import { audit } from "@/server/audit";
import { nomFichierSur } from "@/server/export";

/**
 * Le dossier complet d'une période : l'état Excel + toutes les pièces
 * justificatives, dans une seule archive ZIP. C'est le livrable de fin de
 * période, celui que l'on remet à un comptable ou à un auditeur.
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  if (!voitTout(user.role)) return new NextResponse("Accès refusé", { status: 403 });

  const p = req.nextUrl.searchParams;
  const periode = resolvePeriod(
    (p.get("periode") ?? "mois") as PeriodKey,
    p.get("du"),
    p.get("au"),
  );
  const where = filtresEtat({
    debut: periode.debut,
    fin: periode.fin,
    departmentId: p.get("departmentId"),
    categoryId: p.get("categoryId"),
    portee: p.get("portee"),
  });

  const titre = `État des dépenses — ${periode.label}`;
  const sousTitre = `${periode.label} · ${libelleEtat(p.get("portee"))}`;

  await audit({
    actorId: user.id, action: "EXPORT_DOSSIER", entity: "ExpenseRequest",
    entityId: "*", diff: { periode: periode.label, portee: p.get("portee") },
  });

  const { flux } = await dossierJustificatifs(where, titre, sousTitre);

  return new NextResponse(flux, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition":
        `attachment; filename="${nomFichierSur(`Dossier depenses ${periode.label}`, "zip")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
