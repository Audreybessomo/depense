import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { BadgeStatut } from "@/components/ui/statut";
import { Vide } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Paperclip } from "lucide-react";

export type LigneDemande = Prisma.ExpenseRequestGetPayload<{
  include: {
    demandeur: { select: { nom: true } };
    category: { select: { nom: true } };
    department: { select: { nom: true } };
    etapes: { include: { approver: { select: { nom: true } } } };
    _count: { select: { attachments: true } };
  };
}>;

export const INCLUDE_LIGNE = {
  demandeur: { select: { nom: true } },
  category: { select: { nom: true } },
  department: { select: { nom: true } },
  etapes: { include: { approver: { select: { nom: true } } }, orderBy: { ordre: "asc" } },
  _count: { select: { attachments: true } },
} satisfies Prisma.ExpenseRequestInclude;

export function TableDemandes({
  demandes, colonneDemandeur = true, vide,
}: {
  demandes: LigneDemande[];
  colonneDemandeur?: boolean;
  vide?: React.ReactNode;
}) {
  if (demandes.length === 0) {
    return (
      <>{vide ?? <Vide titre="Aucune demande" description="Rien à afficher pour ces critères." />}</>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="doux border-b text-left text-xs" style={{ borderColor: "var(--bordure)" }}>
            <th className="px-5 py-2.5 font-medium">Référence</th>
            <th className="px-3 py-2.5 font-medium">Objet</th>
            {colonneDemandeur ? <th className="px-3 py-2.5 font-medium">Demandeur</th> : null}
            <th className="px-3 py-2.5 font-medium">Approbateur</th>
            <th className="px-3 py-2.5 text-right font-medium">Montant</th>
            <th className="px-3 py-2.5 font-medium">Date</th>
            <th className="px-5 py-2.5 font-medium">Statut</th>
          </tr>
        </thead>
        <tbody>
          {demandes.map((d) => {
            const etapeCourante =
              d.etapes.find((e) => e.statut === "EN_ATTENTE") ?? d.etapes.at(-1);
            return (
              <tr
                key={d.id}
                className="border-b transition last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                style={{ borderColor: "var(--bordure)" }}
              >
                <td className="whitespace-nowrap px-5 py-3">
                  <Link href={`/demandes/${d.id}`} className="font-medium hover:underline">
                    {d.numero}
                  </Link>
                </td>
                <td className="max-w-xs px-3 py-3">
                  <Link href={`/demandes/${d.id}`} className="block truncate hover:underline">
                    {d.objet}
                  </Link>
                  <span className="doux flex items-center gap-2 text-xs">
                    {d.category?.nom ?? "Non catégorisé"}
                    {d._count.attachments > 0 ? (
                      <span className="inline-flex items-center gap-0.5">
                        <Paperclip className="h-3 w-3" />
                        {d._count.attachments}
                      </span>
                    ) : null}
                  </span>
                </td>
                {colonneDemandeur ? (
                  <td className="whitespace-nowrap px-3 py-3">{d.demandeur.nom}</td>
                ) : null}
                <td className="doux whitespace-nowrap px-3 py-3">
                  {etapeCourante?.approver.nom ?? "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">
                  {formatMoney(d.montant, d.devise)}
                </td>
                <td className="doux whitespace-nowrap px-3 py-3">
                  {formatDate(d.submittedAt ?? d.createdAt)}
                </td>
                <td className="px-5 py-3">
                  <BadgeStatut statut={d.statut} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
