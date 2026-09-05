"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { enregistrerDemande, type EtatAction } from "./actions";
import { Alerte, Card, CardHeader, Champ, Label, Select, Zone } from "@/components/ui/primitives";
import { BoutonSoumettre } from "@/components/ui/soumission";
import { formatMoney } from "@/lib/money";
import type { ValeursDemande } from "./valeurs";
import { FileText, Send, Save, Upload, X } from "lucide-react";

type Option = { id: string; nom: string };
type Devise = { code: string; nom: string; symbole: string; decimals: number };

export function FormulaireDemande({
  valeurs, devises, categories, departements, circuit, piecesExistantes,
}: {
  valeurs: ValeursDemande;
  devises: Devise[];
  categories: Option[];
  departements: Option[];
  circuit: { ordre: number; nom: string; email: string; activeSonCompte: boolean }[];
  piecesExistantes: number;
}) {
  const [etat = {}, action] = useActionState(enregistrerDemande, {} as EtatAction);
  const [montant, setMontant] = useState(valeurs.montant);
  const [devise, setDevise] = useState(valeurs.devise || devises[0]?.code || "");
  const [fichiers, setFichiers] = useState<File[]>([]);
  const inputFichiers = useRef<HTMLInputElement>(null);

  const apercu = useMemo(
    () => Number(montant.replace(/\s/g, "").replace(",", ".")) || 0,
    [montant],
  );

  const ajouterFichiers = (liste: FileList | null) => {
    if (!liste) return;
    setFichiers((prec) => {
      const suivants = [...prec];
      for (const f of Array.from(liste)) {
        if (!suivants.some((x) => x.name === f.name && x.size === f.size)) suivants.push(f);
      }
      return suivants;
    });
  };

  // Le champ file natif doit refleter exactement la selection affichee.
  const synchroniser = (liste: File[]) => {
    if (!inputFichiers.current) return;
    const dt = new DataTransfer();
    liste.forEach((f) => dt.items.add(f));
    inputFichiers.current.files = dt.files;
  };

  return (
    <form action={action} className="grid gap-5 lg:grid-cols-3">
      {valeurs.id ? <input type="hidden" name="requestId" value={valeurs.id} /> : null}

      <div className="space-y-5 lg:col-span-2">
        {etat.erreur ? <Alerte type="erreur">{etat.erreur}</Alerte> : null}

        <Card>
          <CardHeader titre="Le justificatif"
                      description="Facture, reçu, bordereau — PDF ou photo lisible. 20 Mo maximum par fichier." />
          <div className="p-5">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                ajouterFichiers(e.dataTransfer.files);
                setTimeout(() => synchroniser([...fichiers, ...Array.from(e.dataTransfer.files)]), 0);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
              style={{ borderColor: "var(--bordure)" }}
            >
              <Upload className="doux h-6 w-6" />
              <span className="text-sm font-medium">Glissez vos fichiers ici</span>
              <span className="doux text-xs">ou cliquez pour parcourir — PDF, JPEG, PNG, WebP</span>
              <input
                ref={inputFichiers}
                type="file"
                name="fichiers"
                multiple
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => ajouterFichiers(e.target.files)}
              />
            </label>

            {fichiers.length > 0 ? (
              <ul className="mt-3 space-y-1.5">
                {fichiers.map((f) => (
                  <li key={`${f.name}-${f.size}`}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      style={{ borderColor: "var(--bordure)" }}>
                    <FileText className="doux h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="doux text-xs tabular-nums">
                      {(f.size / 1024 / 1024).toFixed(2)} Mo
                    </span>
                    <button
                      type="button"
                      aria-label={`Retirer ${f.name}`}
                      onClick={() => {
                        const reste = fichiers.filter((x) => x !== f);
                        setFichiers(reste);
                        synchroniser(reste);
                      }}
                      className="doux rounded p-0.5 hover:text-rose-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            {piecesExistantes > 0 ? (
              <p className="doux mt-3 text-xs">
                {piecesExistantes} pièce{piecesExistantes > 1 ? "s" : ""} déjà attachée
                {piecesExistantes > 1 ? "s" : ""} à cette demande.
              </p>
            ) : null}
          </div>
        </Card>

        <Card>
          <CardHeader titre="La dépense" />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="objet">Objet *</Label>
              <Champ id="objet" name="objet" required defaultValue={valeurs.objet}
                     placeholder="Ex. Maintenance annuelle des serveurs" maxLength={200} />
            </div>

            <div>
              <Label htmlFor="devise">Devise *</Label>
              <Select id="devise" name="devise" required value={devise}
                      onChange={(e) => setDevise(e.target.value)}>
                {devises.map((d) => (
                  <option key={d.code} value={d.code}>{d.code} — {d.nom}</option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="montant">Montant *</Label>
              <Champ id="montant" name="montant" inputMode="decimal" required
                     value={montant} onChange={(e) => setMontant(e.target.value)} placeholder="0" />
            </div>

            <div className="sm:col-span-2 flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
              <span className="doux text-sm">Montant de la dépense</span>
              <span className="text-lg font-semibold tabular-nums">
                {formatMoney(apercu, devise || "—")}
              </span>
            </div>

            <div>
              <Label htmlFor="categoryId">Catégorie</Label>
              <Select id="categoryId" name="categoryId" defaultValue={valeurs.categoryId}>
                <option value="">Non catégorisé</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </Select>
            </div>

            <div>
              <Label htmlFor="numeroPiece">N° de la pièce</Label>
              <Champ id="numeroPiece" name="numeroPiece" defaultValue={valeurs.numeroPiece}
                     placeholder="Reçu n° 018 / FAC-2026-018" />
            </div>

            <div>
              <Label htmlFor="departmentId">Service imputé</Label>
              <Select id="departmentId" name="departmentId" defaultValue={valeurs.departmentId}>
                <option value="">Mon service</option>
                {departements.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="datePiece">Date de la dépense</Label>
                <Champ id="datePiece" name="datePiece" type="date" defaultValue={valeurs.datePiece} />
              </div>
              <div>
                <Label htmlFor="dateEcheance">Échéance</Label>
                <Champ id="dateEcheance" name="dateEcheance" type="date" defaultValue={valeurs.dateEcheance} />
              </div>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="description">Note / justification</Label>
              <Zone id="description" name="description" rows={4} defaultValue={valeurs.description}
                    placeholder="Contexte de la dépense, précisions utiles à l'approbateur…" />
            </div>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card className="lg:sticky lg:top-6">
          <CardHeader
            titre="Validation"
            description={
              circuit.length > 1
                ? `${circuit.length} approbateurs désignés — le premier qui statue décide`
                : "Approbateur désigné par l'administrateur"
            }
          />
          <div className="space-y-4 p-5">
            {circuit.length === 0 ? (
              <Alerte type="erreur">
                Aucun approbateur n&apos;est assigné à votre compte. Contactez un
                administrateur avant de soumettre.
              </Alerte>
            ) : (
              <>
                <ol className="space-y-2">
                  {circuit.map((e) => (
                    <li key={e.ordre} className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold dark:bg-slate-800">
                        {e.nom.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{e.nom}</span>
                        <span className="doux block truncate text-[11px]">{e.email}</span>
                      </span>
                    </li>
                  ))}
                </ol>
                {circuit.some((e) => !e.activeSonCompte) ? (
                  <Alerte type="info">
                    {circuit.filter((e) => !e.activeSonCompte).map((e) => e.nom).join(", ")} ne
                    s&apos;est jamais connecté. Votre dépense restera en attente à ce niveau —
                    signalez-le à un administrateur.
                  </Alerte>
                ) : null}
              </>
            )}

            <div className="space-y-2 pt-1">
              <BoutonSoumettre className="w-full" name="intention" value="soumettre">
                <Send className="h-4 w-4" />
                Soumettre pour validation
              </BoutonSoumettre>
              <BoutonSoumettre className="w-full" variante="secondaire"
                               name="intention" value="brouillon">
                <Save className="h-4 w-4" />
                Enregistrer en brouillon
              </BoutonSoumettre>
            </div>

            <p className="doux border-t pt-3 text-xs leading-relaxed" style={{ borderColor: "var(--bordure)" }}>
              Un justificatif est obligatoire pour soumettre.{" "}
              {circuit.length > 1
                ? "Ils sont tous prévenus en même temps ; il suffit que l'un d'eux statue, les autres verront simplement sa décision."
                : "L'approbateur recevra un email avec le lien direct."}
            </p>
          </div>
        </Card>
      </div>
    </form>
  );
}
