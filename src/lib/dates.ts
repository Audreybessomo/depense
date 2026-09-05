import {
  endOfDay, endOfMonth, endOfQuarter, endOfYear,
  startOfDay, startOfMonth, startOfQuarter, startOfYear,
  subDays, subMonths, subYears, format,
} from "date-fns";
import { fr } from "date-fns/locale";

export type PeriodKey =
  | "aujourdhui" | "7j" | "30j" | "mois" | "mois_dernier"
  | "trimestre" | "annee" | "annee_derniere" | "personnalise";

export const PERIODES: { key: PeriodKey; label: string }[] = [
  { key: "aujourdhui", label: "Aujourd'hui" },
  { key: "7j", label: "7 derniers jours" },
  { key: "30j", label: "30 derniers jours" },
  { key: "mois", label: "Mois en cours" },
  { key: "mois_dernier", label: "Mois dernier" },
  { key: "trimestre", label: "Trimestre en cours" },
  { key: "annee", label: "Année en cours" },
  { key: "annee_derniere", label: "Année dernière" },
  { key: "personnalise", label: "Période personnalisée" },
];

export function resolvePeriod(
  key: PeriodKey,
  from?: string | null,
  to?: string | null,
  now = new Date(),
): { debut: Date; fin: Date; label: string } {
  switch (key) {
    case "aujourdhui":
      return { debut: startOfDay(now), fin: endOfDay(now), label: "Aujourd'hui" };
    case "7j":
      return { debut: startOfDay(subDays(now, 6)), fin: endOfDay(now), label: "7 derniers jours" };
    case "30j":
      return { debut: startOfDay(subDays(now, 29)), fin: endOfDay(now), label: "30 derniers jours" };
    case "mois_dernier": {
      const d = subMonths(now, 1);
      return { debut: startOfMonth(d), fin: endOfMonth(d), label: formatMois(d) };
    }
    case "trimestre":
      return { debut: startOfQuarter(now), fin: endOfQuarter(now), label: "Trimestre en cours" };
    case "annee":
      return { debut: startOfYear(now), fin: endOfYear(now), label: String(now.getFullYear()) };
    case "annee_derniere": {
      const d = subYears(now, 1);
      return { debut: startOfYear(d), fin: endOfYear(d), label: String(d.getFullYear()) };
    }
    case "personnalise": {
      const debut = from ? startOfDay(new Date(from)) : startOfMonth(now);
      const fin = to ? endOfDay(new Date(to)) : endOfDay(now);
      return { debut, fin, label: `${formatDate(debut)} → ${formatDate(fin)}` };
    }
    case "mois":
    default:
      return { debut: startOfMonth(now), fin: endOfMonth(now), label: formatMois(now) };
  }
}

/** Meme duree, decalee d'un an, pour la comparaison N-1. */
export function periodePrecedente(debut: Date, fin: Date) {
  return { debut: subYears(debut, 1), fin: subYears(fin, 1) };
}

export const formatDate = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "dd/MM/yyyy", { locale: fr }) : "—";

export const formatDateHeure = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "dd/MM/yyyy à HH:mm", { locale: fr }) : "—";

export const formatMois = (d: Date | string) =>
  format(new Date(d), "MMMM yyyy", { locale: fr });

export function joursOuvresEcoules(depuis: Date, jusqua = new Date()) {
  return Math.max(0, Math.round((jusqua.getTime() - depuis.getTime()) / 86_400_000));
}
