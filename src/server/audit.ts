import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

/**
 * Journal d'audit en ajout seul. Aucune fonction de l'application ne met a
 * jour ni ne supprime une ligne : c'est ce qui lui donne sa valeur probante.
 */
export async function audit(params: {
  actorId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  diff?: unknown;
}) {
  const h = await headers();
  await prisma.auditLog.create({
    data: {
      actorId: params.actorId ?? null,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      diff: params.diff === undefined ? undefined : (params.diff as never),
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
    },
  });
}
