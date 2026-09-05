import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth";
import { env } from "@/lib/env";
import { FormulaireConnexion } from "./formulaire";
import { Wallet } from "lucide-react";

export const metadata = { title: "Connexion" };

const MESSAGES: Record<string, string> = {
  lien_invalide: "Lien de connexion invalide.",
  lien_expire: "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.",
  deconnecte: "Vous avez été déconnecté.",
};

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { erreur } = await searchParams;

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-indigo-600">
              <Wallet className="h-5 w-5" />
            </span>
            <span className="text-base font-semibold tracking-tight">{env.APP_NAME}</span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">Connexion à votre espace</h1>
          <p className="doux mt-1 text-sm">
            Accédez à vos dépenses et à vos validations.
          </p>

          <FormulaireConnexion messageInitial={erreur ? MESSAGES[erreur] : undefined} />
        </div>
      </section>

      <section className="relative hidden items-center justify-center bg-slate-900 px-12 lg:flex">
        <div className="max-w-md text-white">
          <p className="text-2xl font-semibold leading-snug tracking-tight">
            Une facture, un circuit de validation, une trace.
          </p>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            {[
              ["Dépôt", "Le demandeur charge son justificatif et l'assigne à un approbateur."],
              ["Validation", "L'approbateur ouvre la pièce dans son espace et statue."],
              ["Pilotage", "La direction suit les montants approuvés, par période."],
            ].map(([titre, texte], i) => (
              <li key={titre} className="flex gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
                  {i + 1}
                </span>
                <span>
                  <strong className="text-white">{titre}.</strong> {texte}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
