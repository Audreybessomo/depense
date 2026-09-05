import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

export function Kpi({
  label, valeur, secondaire, variation, inverse, className,
}: {
  label: string;
  valeur: string;
  secondaire?: string;
  /** Variation en % par rapport a la periode de comparaison. */
  variation?: number | null;
  /** true si une hausse est une mauvaise nouvelle (taux de rejet, delais). */
  inverse?: boolean;
  className?: string;
}) {
  const bon = variation == null ? null : inverse ? variation < 0 : variation > 0;
  const Icone = variation == null || Math.abs(variation) < 0.5
    ? Minus
    : variation > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <Card className={cn("px-4 py-3.5", className)}>
      <p className="doux text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{valeur}</p>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {secondaire ? <span className="doux tabular-nums">{secondaire}</span> : null}
        {variation != null ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 tabular-nums",
              bon === null ? "doux" : bon ? "text-emerald-600" : "text-rose-600",
            )}
            title="Comparaison avec la même période l'an dernier"
          >
            <Icone className="h-3 w-3" />
            {Math.abs(variation).toFixed(0)} %
          </span>
        ) : null}
      </div>
    </Card>
  );
}
