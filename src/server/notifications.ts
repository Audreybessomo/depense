import "server-only";
import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { envoyerEmail, type Email } from "@/server/mail/send";

/**
 * Une notification = une ligne en base (cloche in-app) + un email.
 * L'email est tente en arriere-plan : son echec n'annule jamais l'action.
 */
export async function notifier(params: {
  userId: string;
  requestId?: string | null;
  type: NotificationType;
  titre: string;
  corps: string;
  email?: Omit<Email, "to">;
}) {
  const notif = await prisma.notification.create({
    data: {
      userId: params.userId,
      requestId: params.requestId ?? null,
      type: params.type,
      titre: params.titre,
      corps: params.corps,
    },
  });

  if (params.email) {
    const destinataire = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true },
    });
    const envoye = destinataire
      ? await envoyerEmail({ ...params.email, to: destinataire.email })
      : false;
    if (envoye) {
      await prisma.notification.update({
        where: { id: notif.id },
        data: { sentAt: new Date() },
      });
    }
  }
  return notif;
}

export async function compterNonLues(userId: string) {
  return prisma.notification.count({ where: { userId, luAt: null } });
}

export async function marquerToutesLues(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, luAt: null },
    data: { luAt: new Date() },
  });
}
