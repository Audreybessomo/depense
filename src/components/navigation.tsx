"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  BarChart3, Bell, Building2, ClipboardCheck, FileText, FolderArchive,
  KeyRound, LayoutDashboard, LogOut, Menu, Plus, ScrollText, Users, Wallet, X,
} from "lucide-react";

const ICONES = {
  LayoutDashboard, FileText, ClipboardCheck, BarChart3, Users, Building2,
  ScrollText, Wallet, Plus, FolderArchive,
} as const;

export type Lien = {
  href: string;
  label: string;
  icone: keyof typeof ICONES;
  badge?: number;
  groupe: string;
};

export function Navigation({
  liens, appName, user, nonLues, deconnexion,
}: {
  liens: Lien[];
  appName: string;
  user: { nom: string; email: string; role: string };
  nonLues: number;
  deconnexion: () => Promise<void>;
}) {
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const groupes = [...new Set(liens.map((l) => l.groupe))];

  const actif = (href: string) =>
    href === "/demandes" || href === "/admin"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);

  const contenu = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-indigo-600">
          <Wallet className="h-4 w-4" />
        </span>
        <span className="truncate text-sm font-semibold tracking-tight">{appName}</span>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {groupes.map((groupe) => (
          <div key={groupe}>
            <p className="doux px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider">
              {groupe}
            </p>
            <ul className="space-y-0.5">
              {liens.filter((l) => l.groupe === groupe).map((l) => {
                const Icone = ICONES[l.icone];
                return (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      onClick={() => setOuvert(false)}
                      className={cn(
                        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                        actif(l.href)
                          ? "bg-slate-900 font-medium text-white dark:bg-indigo-600"
                          : "doux hover:bg-slate-100 dark:hover:bg-slate-800",
                      )}
                    >
                      <Icone className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{l.label}</span>
                      {l.badge ? (
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                          actif(l.href) ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800",
                        )}>
                          {l.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t px-3 py-3" style={{ borderColor: "var(--bordure)" }}>
        <Link
          href="/notifications"
          onClick={() => setOuvert(false)}
          className="doux mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <Bell className="h-4 w-4" />
          <span className="flex-1">Notifications</span>
          {nonLues > 0 ? (
            <span className="rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {nonLues}
            </span>
          ) : null}
        </Link>

        <Link
          href="/changer-mot-de-passe?volontaire=1"
          onClick={() => setOuvert(false)}
          className="doux mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <KeyRound className="h-4 w-4" />
          <span className="flex-1">Mon mot de passe</span>
        </Link>

        <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
            {user.nom.split(" ").slice(0, 2).map((m) => m[0]).join("")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">{user.nom}</span>
            <span className="doux block truncate text-[10px]">{user.role}</span>
          </span>
          <form action={deconnexion}>
            <button
              type="submit"
              title="Se déconnecter"
              className="doux rounded-md p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </nav>
  );

  return (
    <>
      <aside
        className="surface fixed inset-y-0 left-0 z-30 hidden w-60 border-r lg:block"
        style={{ borderColor: "var(--bordure)" }}
      >
        {contenu}
      </aside>

      <div
        className="surface sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-3 lg:hidden"
        style={{ borderColor: "var(--bordure)" }}
      >
        <button onClick={() => setOuvert(true)} className="doux rounded-md p-1.5" aria-label="Ouvrir le menu">
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">{appName}</span>
      </div>

      {ouvert ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOuvert(false)} />
          <div className="surface absolute inset-y-0 left-0 w-64 border-r" style={{ borderColor: "var(--bordure)" }}>
            <button
              onClick={() => setOuvert(false)}
              className="doux absolute right-3 top-4 rounded-md p-1.5"
              aria-label="Fermer le menu"
            >
              <X className="h-5 w-5" />
            </button>
            {contenu}
          </div>
        </div>
      ) : null}
    </>
  );
}
