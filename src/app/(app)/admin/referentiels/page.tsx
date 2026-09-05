import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth";
import { Card, CardHeader } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { DEVISE_BASE } from "@/server/currency";
import { formatDate } from "@/lib/dates";
import { toNumber } from "@/lib/money";
import { basculerActif } from "./actions";
import { AjoutCategorie, AjoutDevise, AjoutService } from "./formulaires";

export const metadata = { title: "Référentiels" };

function Bascule({ type, id, actif }: { type: string; id: string; actif: boolean }) {
  return (
    <form action={basculerActif}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="actif" value={String(!actif)} />
      <BoutonSoumettre variante="fantome" taille="sm">
        {actif ? "Désactiver" : "Activer"}
      </BoutonSoumettre>
    </form>
  );
}

export default async function Referentiels() {
  await requireRole("ADMIN");

  const [categories, services, devises] = await Promise.all([
    prisma.category.findMany({
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
      include: { _count: { select: { demandes: true } } },
    }),
    prisma.department.findMany({
      orderBy: [{ actif: "desc" }, { nom: "asc" }],
      include: { _count: { select: { demandes: true, users: true } } },
    }),
    prisma.currency.findMany({
      orderBy: [{ actif: "desc" }, { code: "asc" }],
      include: { taux: { orderBy: { validFrom: "desc" }, take: 1 } },
    }),
  ]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">Référentiels</h1>
        <p className="doux text-sm">
          Catégories de dépense, services et devises. Un élément désactivé disparaît des
          formulaires sans effacer l&apos;historique.
        </p>
      </header>

      <Card>
        <CardHeader titre="Devises et taux de change"
                    description={`Devise de référence : ${DEVISE_BASE}`} />
        <table className="w-full text-sm">
          <thead>
            <tr className="doux border-b text-left text-xs" style={{ borderColor: "var(--bordure)" }}>
              <th className="px-5 py-2.5 font-medium">Code</th>
              <th className="px-3 py-2.5 font-medium">Nom</th>
              <th className="px-3 py-2.5 text-right font-medium">Taux → {DEVISE_BASE}</th>
              <th className="px-3 py-2.5 font-medium">Depuis le</th>
              <th className="px-5 py-2.5 text-right font-medium">État</th>
            </tr>
          </thead>
          <tbody>
            {devises.map((d) => (
              <tr key={d.code} className="border-b last:border-0" style={{ borderColor: "var(--bordure)" }}>
                <td className="px-5 py-2.5 font-medium">{d.code}</td>
                <td className="px-3 py-2.5">{d.nom} <span className="doux">{d.symbole}</span></td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {d.code === DEVISE_BASE ? "1 (référence)" : toNumber(d.taux[0]?.taux ?? 0) || "—"}
                </td>
                <td className="doux px-3 py-2.5 text-xs">
                  {d.taux[0] ? formatDate(d.taux[0].validFrom) : "—"}
                </td>
                <td className="px-5 py-2.5 text-right">
                  {d.code === DEVISE_BASE ? (
                    <span className="doux text-xs">référence</span>
                  ) : (
                    <Bascule type="currency" id={d.code} actif={d.actif} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <AjoutDevise deviseBase={DEVISE_BASE} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader titre="Catégories" description={`${categories.length} enregistrée(s)`} />
          <ul className="divide-y" style={{ borderColor: "var(--bordure)" }}>
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className={c.actif ? "" : "doux line-through"}>{c.nom}</span>
                {c.compteComptable ? <span className="doux text-xs">· {c.compteComptable}</span> : null}
                <span className="doux ml-auto text-xs tabular-nums">{c._count.demandes}</span>
                <Bascule type="category" id={c.id} actif={c.actif} />
              </li>
            ))}
          </ul>
          <AjoutCategorie />
        </Card>

        <Card>
          <CardHeader titre="Services" description={`${services.length} enregistré(s)`} />
          <ul className="divide-y" style={{ borderColor: "var(--bordure)" }}>
            {services.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                <span className={s.actif ? "" : "doux line-through"}>{s.nom}</span>
                {s.costCenter ? <span className="doux text-xs">· {s.costCenter}</span> : null}
                <span className="doux ml-auto text-xs tabular-nums">
                  {s._count.users} pers. · {s._count.demandes}
                </span>
                <Bascule type="department" id={s.id} actif={s.actif} />
              </li>
            ))}
          </ul>
          <AjoutService />
        </Card>
      </div>

    </div>
  );
}
