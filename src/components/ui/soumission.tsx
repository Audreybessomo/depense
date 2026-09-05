"use client";

import { useFormStatus } from "react-dom";
import { Bouton } from "@/components/ui/primitives";
import { Loader2 } from "lucide-react";

/**
 * Bouton de soumission qui se desactive pendant l'action serveur.
 * `name`/`value` sont transmis dans le FormData : c'est ainsi qu'un meme
 * formulaire peut porter plusieurs intentions (soumettre / brouillon).
 */
export function BoutonSoumettre({
  children, variante = "primaire", taille = "md", className, confirmation, name, value,
}: {
  children: React.ReactNode;
  variante?: React.ComponentProps<typeof Bouton>["variante"];
  taille?: React.ComponentProps<typeof Bouton>["taille"];
  className?: string;
  confirmation?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Bouton
      type="submit"
      name={name}
      value={value}
      variante={variante}
      taille={taille}
      className={className}
      disabled={pending}
      onClick={(e) => {
        if (confirmation && !window.confirm(confirmation)) e.preventDefault();
      }}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </Bouton>
  );
}
