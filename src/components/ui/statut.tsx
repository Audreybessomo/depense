import type { RequestStatus, StepStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

export const LIBELLE_STATUT: Record<RequestStatus, string> = {
  BROUILLON: "Brouillon",
  EN_ATTENTE: "En attente",
  INFO_DEMANDEE: "Info demandée",
  APPROUVEE: "Approuvée",
  REJETEE: "Rejetée",
  PAYEE: "Réglée, à confirmer",
  CONFIRMEE: "Confirmée",
  ANNULEE: "Annulée",
};

const COULEURS: Record<RequestStatus, string> = {
  BROUILLON: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
  EN_ATTENTE: "bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900",
  INFO_DEMANDEE: "bg-sky-100 text-sky-800 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-900",
  APPROUVEE: "bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900",
  REJETEE: "bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:ring-rose-900",
  PAYEE: "bg-violet-100 text-violet-800 ring-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900",
  CONFIRMEE: "bg-teal-100 text-teal-800 ring-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:ring-teal-900",
  ANNULEE: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700",
};

export function BadgeStatut({ statut, className }: { statut: RequestStatus; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        COULEURS[statut],
        className,
      )}
    >
      {LIBELLE_STATUT[statut]}
    </span>
  );
}

export const LIBELLE_ETAPE: Record<StepStatus, string> = {
  A_VENIR: "À venir",
  EN_ATTENTE: "En attente",
  APPROUVEE: "Approuvée",
  REJETEE: "Rejetée",
  INFO_DEMANDEE: "Info demandée",
  IGNOREE: "Traitée par un autre approbateur",
};
