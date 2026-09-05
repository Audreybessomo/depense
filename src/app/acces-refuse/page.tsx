import Link from "next/link";
import { ShieldX } from "lucide-react";

export const metadata = { title: "Accès refusé" };

export default function AccesRefuse() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <ShieldX className="h-10 w-10 text-rose-500" />
      <h1 className="text-lg font-semibold">Accès refusé</h1>
      <p className="doux max-w-sm text-sm">
        Votre rôle ne vous permet pas d&apos;accéder à cette page. Contactez un administrateur
        si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
      </p>
      <Link href="/" className="mt-2 text-sm font-medium text-indigo-600 hover:underline">
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
