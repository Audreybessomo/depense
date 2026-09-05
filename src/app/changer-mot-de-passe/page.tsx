import { redirect } from "next/navigation";
import { requireUser } from "@/server/auth";
import { FormulaireChangement } from "./formulaire";
import { KeyRound } from "lucide-react";

export const metadata = { title: "Changer mon mot de passe" };

export default async function ChangerMotDePasse({
  searchParams,
}: {
  searchParams: Promise<{ volontaire?: string }>;
}) {
  const user = await requireUser();
  const { volontaire } = await searchParams;

  // Hors obligation, on n'arrive ici que volontairement.
  if (!user.doitChangerMotDePasse && volontaire !== "1") redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <span className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-indigo-600">
          <KeyRound className="h-5 w-5" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">
          {user.doitChangerMotDePasse ? "Choisissez votre mot de passe" : "Changer mon mot de passe"}
        </h1>
        <p className="doux mt-1 text-sm">
          {user.doitChangerMotDePasse
            ? "Votre mot de passe a été créé par un administrateur. Remplacez-le par un mot de passe que vous seul connaissez."
            : "Au moins 10 caractères, avec une lettre et un chiffre."}
        </p>
        <FormulaireChangement obligatoire={user.doitChangerMotDePasse} />
      </div>
    </main>
  );
}
