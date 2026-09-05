import { redirect } from "next/navigation";
import { requireUser, peutApprouver, peutRegler, voitTout, estAdmin } from "@/server/auth";
import { prisma } from "@/lib/prisma";
import { compterNonLues } from "@/server/notifications";
import { env } from "@/lib/env";
import { Navigation, type Lien } from "@/components/navigation";
import { deconnexion } from "./actions";

const LIBELLE_ROLE: Record<string, string> = {
  DEMANDEUR: "Demandeur",
  APPROBATEUR: "Approbateur",
  ADMIN: "Administrateur",
};

export default async function LayoutApplication({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Un mot de passe attribue par l'administrateur ne doit pas survivre a la
  // premiere connexion : tant qu'il n'est pas remplace, aucune page de
  // l'application n'est accessible.
  if (user.doitChangerMotDePasse) redirect("/changer-mot-de-passe");

  const [aValider, nonLues, aRegler] = await Promise.all([
    peutApprouver(user.role)
      ? prisma.approvalStep.count({
          where: { approverId: user.id, statut: "EN_ATTENTE", request: { statut: "EN_ATTENTE" } },
        })
      : Promise.resolve(0),
    compterNonLues(user.id),
    peutRegler(user.role)
      ? prisma.expenseRequest.count({ where: { statut: "APPROUVEE" } })
      : Promise.resolve(0),
  ]);

  const liens: Lien[] = [
    { href: "/demandes", label: "Mes dépenses", icone: "FileText", groupe: "Mon espace" },
    { href: "/demandes/nouvelle", label: "Nouvelle dépense", icone: "Plus", groupe: "Mon espace" },
  ];

  if (peutApprouver(user.role)) {
    liens.push({
      href: "/validations", label: "À valider", icone: "ClipboardCheck",
      badge: aValider || undefined, groupe: "Mon espace",
    });
  }
  if (peutRegler(user.role)) {
    liens.push({
      href: "/tresorerie", label: "À régler", icone: "Wallet",
      badge: aRegler || undefined, groupe: "Suivi",
    });
  }
  if (voitTout(user.role)) {
    liens.push(
      { href: "/admin", label: "Tableau de bord", icone: "LayoutDashboard", groupe: "Suivi" },
      { href: "/admin/demandes", label: "Toutes les dépenses", icone: "FileText", groupe: "Suivi" },
      { href: "/admin/rapports", label: "Rapports", icone: "BarChart3", groupe: "Suivi" },
      { href: "/admin/etat", label: "État & justificatifs", icone: "FolderArchive", groupe: "Suivi" },
    );
  }
  if (estAdmin(user.role)) {
    liens.push(
      { href: "/admin/utilisateurs", label: "Utilisateurs", icone: "Users", groupe: "Administration" },
      { href: "/admin/referentiels", label: "Référentiels", icone: "Building2", groupe: "Administration" },
    );
  }
  if (estAdmin(user.role)) {
    liens.push({
      href: "/admin/audit", label: "Journal d'audit", icone: "ScrollText", groupe: "Administration",
    });
  }

  return (
    <div className="min-h-screen">
      <Navigation
        liens={liens}
        appName={env.APP_NAME}
        user={{ nom: user.nom, email: user.email, role: LIBELLE_ROLE[user.role] ?? user.role }}
        nonLues={nonLues}
        deconnexion={deconnexion}
      />
      <main className="lg:pl-60">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
