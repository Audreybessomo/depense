import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth";
import { Card, CardHeader } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { formatDateHeure } from "@/lib/dates";
import { FormulaireUtilisateur } from "./formulaire";
import { modifierUtilisateur } from "./actions";
import { BoutonReinitialiser } from "./identifiants";
import { CircuitUtilisateur } from "./circuit";
import { approbateursDisponibles, circuitDe } from "@/server/circuit";

export const metadata = { title: "Utilisateurs" };

const ROLES = ["DEMANDEUR", "APPROBATEUR", "ADMIN"] as const;

export default async function Utilisateurs() {
  const admin = await requireRole("ADMIN");

  const [utilisateurs, departements, approbateurs] = await Promise.all([
    prisma.user.findMany({
      include: {
        department: { select: { nom: true } },
        _count: { select: { demandes: true, etapes: true } },
      },
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
    }),
    prisma.department.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
    approbateursDisponibles(),
  ]);

  // Le circuit de chacun, pour l'afficher et le modifier depuis la liste.
  const circuits = new Map(
    await Promise.all(
      utilisateurs.map(async (u) => [u.id, await circuitDe(u.id)] as const),
    ),
  );

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Utilisateurs</h1>
        <p className="doux text-sm">
          L&apos;administrateur crée les comptes et remet les identifiants en main propre —
          aucun email n&apos;est envoyé. Désactiver un compte révoque ses sessions ouvertes.
        </p>
      </header>

      <FormulaireUtilisateur
        departements={departements.map((d) => ({ id: d.id, nom: d.nom }))}
        approbateurs={approbateurs}
        utilisateurs={utilisateurs.map((u) => ({ id: u.id, nom: u.nom }))}
      />

      <Card>
        <CardHeader titre={`${utilisateurs.length} compte(s)`} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="doux border-b text-left text-xs" style={{ borderColor: "var(--bordure)" }}>
                <th className="px-5 py-2.5 font-medium">Utilisateur</th>
                <th className="px-3 py-2.5 font-medium">Service</th>
                <th className="px-3 py-2.5 font-medium">Approbateurs</th>
                <th className="px-3 py-2.5 text-right font-medium">Demandes</th>
                <th className="px-3 py-2.5 text-right font-medium">Validations</th>
                <th className="px-3 py-2.5 font-medium">Dernière connexion</th>
                <th className="px-5 py-2.5 font-medium">Rôle & état</th>
              </tr>
            </thead>
            <tbody>
              {utilisateurs.map((u) => (
                <tr key={u.id} className="border-b last:border-0" style={{ borderColor: "var(--bordure)" }}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{u.nom}</p>
                    <p className="doux text-xs">{u.email}</p>
                  </td>
                  <td className="doux px-3 py-3 text-xs">{u.department?.nom ?? "—"}</td>
                  <td className="min-w-[240px] px-3 py-3">
                    <CircuitUtilisateur
                      id={u.id}
                      nom={u.nom}
                      circuit={circuits.get(u.id) ?? []}
                      approbateurs={approbateurs}
                    />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{u._count.demandes}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{u._count.etapes}</td>
                  <td className="doux px-3 py-3 text-xs">
                    {u.lastLoginAt ? formatDateHeure(u.lastLoginAt) : "Jamais connecté"}
                    {u.doitChangerMotDePasse ? (
                      <span className="mt-0.5 block text-[10px] font-medium text-amber-600">
                        mot de passe à changer
                      </span>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <form action={modifierUtilisateur} className="flex items-center gap-1.5">
                        <input type="hidden" name="id" value={u.id} />
                        <select
                          name="role"
                          defaultValue={u.role}
                          disabled={u.id === admin.id}
                          className="surface rounded-md border px-2 py-1 text-xs"
                        >
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                          name="actif"
                          defaultValue={String(u.actif)}
                          disabled={u.id === admin.id}
                          className="surface rounded-md border px-2 py-1 text-xs"
                        >
                          <option value="true">Actif</option>
                          <option value="false">Désactivé</option>
                        </select>
                        {u.id !== admin.id ? (
                          <BoutonSoumettre variante="secondaire" taille="sm">OK</BoutonSoumettre>
                        ) : (
                          <span className="doux text-xs">(vous)</span>
                        )}
                      </form>
                      {u.actif ? <BoutonReinitialiser id={u.id} nom={u.nom} /> : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
