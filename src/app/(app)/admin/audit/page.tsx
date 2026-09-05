import { redirect } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser, estAdmin } from "@/server/auth";
import { pagination, type ParamsRecherche } from "@/server/filtres";
import { Card, CardHeader, Vide } from "@/components/ui/primitives";
import { BarreFiltres } from "@/components/filtres";
import { Pagination } from "@/components/ui/pagination";
import { formatDateHeure } from "@/lib/dates";

export const metadata = { title: "Journal d'audit" };

const LIBELLES: Record<string, string> = {
  CONNEXION: "Connexion",
  CONNEXION_LIEN: "Connexion par lien email",
  CONNEXION_ECHEC: "Échec de connexion",
  DECONNEXION: "Déconnexion",
  MOT_DE_PASSE_DEFINI: "Mot de passe défini",
  MOT_DE_PASSE_CHANGE: "Mot de passe changé par son titulaire",
  MOT_DE_PASSE_REINITIALISE: "Mot de passe réinitialisé par un administrateur",
  DEMANDE_CREEE: "Demande créée",
  DEMANDE_MODIFIEE: "Demande modifiée",
  DEMANDE_SOUMISE: "Demande soumise",
  DEMANDE_RESOUMISE: "Demande resoumise",
  DEMANDE_APPROUVER: "Demande approuvée",
  DEMANDE_REJETER: "Demande rejetée",
  DEMANDE_DEMANDER_INFO: "Complément demandé",
  DEMANDE_PAYEE: "Règlement enregistré",
  DEMANDE_CONFIRMEE: "Réception confirmée par le demandeur",
  EXPORT_DOSSIER: "Export du dossier de justificatifs",
  DEMANDE_ANNULEE: "Demande annulée",
  PIECE_SUPPRIMEE: "Pièce jointe supprimée",
  FICHIER_CONSULTE: "Pièce jointe consultée",
  COMMENTAIRE: "Commentaire ajouté",
  EXPORT_DEMANDES: "Export du registre",
  ADMIN_AMORCE: "Premier administrateur amorcé (hors application)",
  UTILISATEUR_CREE: "Utilisateur créé",
  UTILISATEUR_MODIFIE: "Utilisateur modifié",
  INVITATION_RENVOYEE: "Invitation renvoyée",
};

export default async function JournalAudit({
  searchParams,
}: {
  searchParams: Promise<ParamsRecherche>;
}) {
  const user = await requireUser();
  if (!estAdmin(user.role)) redirect("/acces-refuse");

  const params = await searchParams;
  const { page, parPage, skip, take } = pagination(params, 50);
  const action = typeof params.action === "string" ? params.action : undefined;

  const where = action ? { action } : {};

  const [entrees, total, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { actor: { select: { nom: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip, take,
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({ by: ["action"], _count: { _all: true }, orderBy: { action: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Journal d&apos;audit</h1>
        <p className="doux text-sm">
          Registre en ajout seul : aucune entrée n&apos;est modifiée ni supprimée par
          l&apos;application.
        </p>
      </header>

      <Card>
        <CardHeader titre={`${total} entrée(s)`} />
        <div className="border-b px-5 py-3" style={{ borderColor: "var(--bordure)" }}>
          <Suspense fallback={null}>
            <BarreFiltres
              recherche={false}
              champs={[{
                nom: "action",
                label: "Toutes les actions",
                options: actions.map((a) => ({
                  valeur: a.action,
                  label: `${LIBELLES[a.action] ?? a.action} (${a._count._all})`,
                })),
              }]}
            />
          </Suspense>
        </div>

        {entrees.length === 0 ? (
          <Vide titre="Aucune entrée" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="doux border-b text-left text-xs" style={{ borderColor: "var(--bordure)" }}>
                  <th className="px-5 py-2.5 font-medium">Horodatage</th>
                  <th className="px-3 py-2.5 font-medium">Acteur</th>
                  <th className="px-3 py-2.5 font-medium">Action</th>
                  <th className="px-3 py-2.5 font-medium">Objet</th>
                  <th className="px-5 py-2.5 font-medium">Détail</th>
                </tr>
              </thead>
              <tbody>
                {entrees.map((e) => (
                  <tr key={e.id} className="border-b last:border-0" style={{ borderColor: "var(--bordure)" }}>
                    <td className="doux whitespace-nowrap px-5 py-2.5 text-xs tabular-nums">
                      {formatDateHeure(e.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {e.actor?.nom ?? "Système"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs font-medium">
                      {LIBELLES[e.action] ?? e.action}
                    </td>
                    <td className="doux whitespace-nowrap px-3 py-2.5 text-xs">
                      {e.entity} · {e.entityId.slice(0, 10)}
                    </td>
                    <td className="doux max-w-md truncate px-5 py-2.5 text-xs">
                      {e.diff ? JSON.stringify(e.diff) : "—"}
                      {e.ip ? ` · ${e.ip}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} parPage={parPage} params={params} />
      </Card>
    </div>
  );
}
