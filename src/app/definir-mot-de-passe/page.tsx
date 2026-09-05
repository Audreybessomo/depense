import { FormulaireMotDePasse } from "./formulaire";
import { KeyRound } from "lucide-react";

export const metadata = { title: "Définir mon mot de passe" };

export default async function PageMotDePasse({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <span className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-indigo-600">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Définissez votre mot de passe</h1>
        <p className="doux mt-1 text-sm">
          Au moins 10 caractères, avec une lettre et un chiffre.
        </p>
        <FormulaireMotDePasse token={token ?? ""} />
      </div>
    </main>
  );
}
