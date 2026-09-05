import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, voitTout } from "@/server/auth";
import { lireFichier } from "@/server/storage";
import { audit } from "@/server/audit";

/**
 * Sert une piece jointe. Le fichier n'est jamais expose publiquement : le
 * stockage reste prive et chaque telechargement est controle puis journalise.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Non authentifié", { status: 401 });

  const { id } = await params;
  const pj = await prisma.attachment.findUnique({
    where: { id },
    include: {
      request: {
        select: { id: true, demandeurId: true, etapes: { select: { approverId: true } } },
      },
    },
  });
  if (!pj) return new NextResponse("Introuvable", { status: 404 });

  const autorise =
    voitTout(user.role) ||
    pj.request.demandeurId === user.id ||
    pj.request.etapes.some((e) => e.approverId === user.id);

  if (!autorise) return new NextResponse("Accès refusé", { status: 403 });
  if (pj.scanStatus === "INFECTE") {
    return new NextResponse("Fichier bloqué par l'analyse antivirus", { status: 403 });
  }

  let contenu: Buffer;
  try {
    contenu = await lireFichier(pj.storageKey);
  } catch {
    return new NextResponse("Fichier absent du stockage", { status: 410 });
  }

  const enPieceJointe = req.nextUrl.searchParams.get("dl") === "1";
  await audit({
    actorId: user.id, action: "FICHIER_CONSULTE", entity: "Attachment", entityId: pj.id,
  });

  return new NextResponse(new Uint8Array(contenu), {
    headers: {
      "Content-Type": pj.mimeType,
      "Content-Length": String(contenu.length),
      "Content-Disposition":
        `${enPieceJointe ? "attachment" : "inline"}; filename="${encodeURIComponent(pj.filename)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
