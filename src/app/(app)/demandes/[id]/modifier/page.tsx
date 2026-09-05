import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { getDemande, peutModifierDemande } from "@/server/requests";
import { FormulaireDemande } from "../../formulaire-demande";
import { donneesFormulaire } from "../../donnees";
import { toNumber } from "@/lib/money";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Modifier la dépense" };

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function ModifierDemande({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const d = await getDemande(id);
  if (!d) notFound();
  if (!peutModifierDemande(user, d)) redirect(`/demandes/${id}`);

  const donnees = await donneesFormulaire(user.id);

  return (
    <div className="space-y-5">
      <header>
        <Link href={`/demandes/${id}`} className="doux mb-2 inline-flex items-center gap-1 text-xs hover:underline">
          <ChevronLeft className="h-3.5 w-3.5" />
          {d.numero}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Modifier la demande</h1>
        {d.statut === "INFO_DEMANDEE" ? (
          <p className="doux text-sm">
            Un complément vous a été demandé. Corrigez puis renvoyez la demande.
          </p>
        ) : null}
      </header>

      <FormulaireDemande
        valeurs={{
          id: d.id,
          objet: d.objet,
          description: d.description ?? "",
          devise: d.devise,
          montant: String(toNumber(d.montant)),
          categoryId: d.categoryId ?? "",
          departmentId: d.departmentId ?? "",
          numeroPiece: d.numeroPiece ?? "",
          datePiece: iso(d.datePiece),
          dateEcheance: iso(d.dateEcheance),
        }}
        piecesExistantes={d.attachments.length}
        {...donnees}
      />
    </div>
  );
}
