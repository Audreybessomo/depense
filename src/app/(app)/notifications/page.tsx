import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/server/auth";
import { Card, CardHeader, Vide } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { formatDateHeure } from "@/lib/dates";
import { toutMarquerLu } from "../actions";
import { cn } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const user = await requireUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { request: { select: { id: true, numero: true } } },
  });

  const nonLues = notifications.filter((n) => !n.luAt).length;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Notifications</h1>
          <p className="doux text-sm">
            {nonLues > 0 ? `${nonLues} non lue(s)` : "Tout est à jour."}
          </p>
        </div>
        {nonLues > 0 ? (
          <form action={toutMarquerLu}>
            <BoutonSoumettre variante="secondaire" taille="sm">Tout marquer comme lu</BoutonSoumettre>
          </form>
        ) : null}
      </header>

      <Card>
        <CardHeader titre="100 dernières notifications" />
        {notifications.length === 0 ? (
          <Vide titre="Aucune notification" />
        ) : (
          <ul className="divide-y" style={{ borderColor: "var(--bordure)" }}>
            {notifications.map((n) => {
              const contenu = (
                <div className="flex items-start gap-3 px-5 py-3.5">
                  <span className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    n.luAt ? "bg-transparent" : "bg-indigo-500",
                  )} />
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm", n.luAt ? "" : "font-medium")}>{n.titre}</p>
                    {n.corps ? <p className="doux mt-0.5 truncate text-xs">{n.corps}</p> : null}
                  </div>
                  <span className="doux shrink-0 text-xs">{formatDateHeure(n.createdAt)}</span>
                </div>
              );
              return (
                <li key={n.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  {n.request ? (
                    <Link href={`/demandes/${n.request.id}`} className="block">{contenu}</Link>
                  ) : contenu}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
