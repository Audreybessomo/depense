import Link from "next/link";
import { requireUser } from "@/server/auth";
import { FormulaireDemande } from "../formulaire-demande";
import { VALEURS_VIDES } from "../valeurs";
import { donneesFormulaire } from "../donnees";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Nouvelle dépense" };

export default async function NouvelleDemande() {
  const user = await requireUser();
  const donnees = await donneesFormulaire(user.id);

  return (
    <div className="space-y-5">
      <header>
        <Link href="/demandes" className="doux mb-2 inline-flex items-center gap-1 text-xs hover:underline">
          <ChevronLeft className="h-3.5 w-3.5" />
          Mes dépenses
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">Nouvelle dépense</h1>
        <p className="doux text-sm">
          Chargez le justificatif et complétez les informations. Elle partira
          automatiquement vers le circuit de validation défini pour votre compte.
        </p>
      </header>

      <FormulaireDemande
        valeurs={{ ...VALEURS_VIDES, departmentId: user.departmentId ?? "" }}
        piecesExistantes={0}
        {...donnees}
      />
    </div>
  );
}
