import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, voitTout } from "@/server/auth";
import { construireWhere, type ParamsRecherche } from "@/server/filtres";
import { exportCsv, exportExcel, nomFichierSur } from "@/server/export";
import { filtresEtat, libelleEtat } from "@/server/etat";
import { resolvePeriod, type PeriodKey } from "@/lib/dates";
import { audit } from "@/server/audit";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });
  if (!voitTout(user.role)) return new NextResponse("Accès refusé", { status: 403 });

  const sp = req.nextUrl.searchParams;
  const params: ParamsRecherche = Object.fromEntries(sp.entries());
  const format = params.format === "xlsx" ? "xlsx" : "csv";

  // Deux points d'entrée : l'état daté d'une période (bouton « État »), ou le
  // registre filtré librement à l'écran (bouton « Export » du tableau).
  const modeEtat = sp.has("periode");
  const periode = modeEtat
    ? resolvePeriod((sp.get("periode") ?? "mois") as PeriodKey, sp.get("du"), sp.get("au"))
    : null;

  const where = modeEtat
    ? filtresEtat({
        debut: periode!.debut,
        fin: periode!.fin,
        departmentId: sp.get("departmentId"),
        categoryId: sp.get("categoryId"),
        portee: sp.get("portee"),
      })
    : construireWhere(params);

  const titre = modeEtat ? `État des dépenses — ${periode!.label}` : "Registre des dépenses";
  const sousTitre = modeEtat
    ? `${periode!.label} · ${libelleEtat(sp.get("portee"))}`
    : "Filtres appliqués à l'écran";
  const nomBase = modeEtat
    ? `Etat des depenses ${periode!.label}`
    : `Depenses ${new Date().toISOString().slice(0, 10)}`;

  await audit({
    actorId: user.id, action: "EXPORT_DEMANDES", entity: "ExpenseRequest",
    entityId: "*", diff: { format, etat: modeEtat, filtres: params },
  });

  if (format === "xlsx") {
    const buffer = await exportExcel(where, titre, sousTitre);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomFichierSur(nomBase, "xlsx")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const csv = await exportCsv(where);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomFichierSur(nomBase, "csv")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
