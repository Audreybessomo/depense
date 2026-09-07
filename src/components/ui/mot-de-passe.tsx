"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Champ } from "./primitives";
import { cn } from "@/lib/utils";

/**
 * Champ de mot de passe avec bascule d'affichage.
 *
 * Les mots de passe de cette application sont générés puis recopiés à la main
 * depuis un terminal ou un message : saisir à l'aveugle est la première cause
 * de « mot de passe incorrect » alors que le compte est parfaitement valide.
 */
type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export const ChampMotDePasse = React.forwardRef<HTMLInputElement, Props>(
  function ChampMotDePasse({ className, ...props }, ref) {
    const [visible, setVisible] = React.useState(false);
    const Icone = visible ? EyeOff : Eye;

    return (
      <div className="relative">
        <Champ
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          aria-pressed={visible}
          className={cn(
            "doux absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-lg transition",
            "hover:text-slate-900 dark:hover:text-slate-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          )}
        >
          <Icone className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  },
);
