import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("surface rounded-xl border shadow-sm", className)}
      {...props}
    />
  );
}

export function CardHeader({
  titre, description, action, className,
}: {
  titre: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b px-5 py-4", className)}
         style={{ borderColor: "var(--bordure)" }}>
      <div>
        <h2 className="text-sm font-semibold tracking-tight">{titre}</h2>
        {description ? <p className="doux mt-0.5 text-xs">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

type BoutonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primaire" | "secondaire" | "danger" | "succes" | "fantome";
  taille?: "sm" | "md";
};

const VARIANTES: Record<NonNullable<BoutonProps["variante"]>, string> = {
  primaire: "bg-slate-900 text-white hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500",
  secondaire: "surface border hover:bg-slate-50 dark:hover:bg-slate-800",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
  succes: "bg-emerald-600 text-white hover:bg-emerald-700",
  fantome: "hover:bg-slate-100 dark:hover:bg-slate-800",
};

export function Bouton({
  variante = "primaire", taille = "md", className, ...props
}: BoutonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
        taille === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        VARIANTES[variante],
        className,
      )}
      {...props}
    />
  );
}

export const Champ = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Champ({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "surface w-full rounded-lg border px-3 py-2 text-sm outline-none transition",
          "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
          "disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Zone({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "surface w-full rounded-lg border px-3 py-2 text-sm outline-none transition",
        "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "surface w-full rounded-lg border px-3 py-2 text-sm outline-none transition",
        "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium doux", className)} {...props} />;
}

export function Vide({ titre, description, action }: {
  titre: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-medium">{titre}</p>
      {description ? <p className="doux mt-1 max-w-sm text-xs">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Alerte({ type = "erreur", children }: {
  type?: "erreur" | "succes" | "info"; children: React.ReactNode;
}) {
  const styles = {
    erreur: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
    succes: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
    info: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  }[type];
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-sm", styles)} role="alert">
      {children}
    </div>
  );
}
