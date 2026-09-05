"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/server/auth";
import { audit } from "@/server/audit";

export type EtatReferentiel = { erreur?: string; succes?: string };

const texte = (fd: FormData, cle: string) => String(fd.get(cle) ?? "").trim();

export async function creerCategorie(_: EtatReferentiel, fd: FormData): Promise<EtatReferentiel> {
  const admin = await requireRole("ADMIN");
  const nom = texte(fd, "nom");
  if (nom.length < 2) return { erreur: "Nom trop court." };

  try {
    const c = await prisma.category.create({
      data: { nom, compteComptable: texte(fd, "compteComptable") || null },
    });
    await audit({ actorId: admin.id, action: "CATEGORIE_CREEE", entity: "Category", entityId: c.id });
  } catch {
    return { erreur: "Cette catégorie existe déjà." };
  }
  revalidatePath("/admin/referentiels");
  return { succes: "Catégorie ajoutée." };
}

export async function creerService(_: EtatReferentiel, fd: FormData): Promise<EtatReferentiel> {
  const admin = await requireRole("ADMIN");
  const nom = texte(fd, "nom");
  if (nom.length < 2) return { erreur: "Nom trop court." };

  const budget = texte(fd, "budgetAnnuel").replace(",", ".");
  try {
    const d = await prisma.department.create({
      data: {
        nom,
        costCenter: texte(fd, "costCenter") || null,
        budgetAnnuel: budget ? new Prisma.Decimal(budget) : null,
      },
    });
    await audit({ actorId: admin.id, action: "SERVICE_CREE", entity: "Department", entityId: d.id });
  } catch {
    return { erreur: "Ce service existe déjà." };
  }
  revalidatePath("/admin/referentiels");
  return { succes: "Service ajouté." };
}

export async function enregistrerDevise(_: EtatReferentiel, fd: FormData): Promise<EtatReferentiel> {
  const admin = await requireRole("ADMIN");
  const code = texte(fd, "code").toUpperCase();
  if (code.length !== 3) return { erreur: "Le code ISO doit faire 3 lettres (XAF, EUR, USD…)." };

  const taux = Number(texte(fd, "taux").replace(",", "."));
  if (!Number.isFinite(taux) || taux <= 0) return { erreur: "Taux de change invalide." };

  const validFrom = texte(fd, "validFrom") ? new Date(texte(fd, "validFrom")) : new Date();

  await prisma.currency.upsert({
    where: { code },
    create: {
      code,
      nom: texte(fd, "nom") || code,
      symbole: texte(fd, "symbole") || code,
      decimals: Number(texte(fd, "decimals") || 2),
    },
    update: {
      nom: texte(fd, "nom") || code,
      symbole: texte(fd, "symbole") || code,
      actif: true,
    },
  });

  // Un taux est date : on ajoute une nouvelle validite plutot que d'ecraser
  // l'historique, sinon les rapports passes changeraient retroactivement.
  await prisma.exchangeRate.upsert({
    where: { currencyCode_validFrom: { currencyCode: code, validFrom } },
    create: { currencyCode: code, taux: new Prisma.Decimal(taux), validFrom },
    update: { taux: new Prisma.Decimal(taux) },
  });

  await audit({
    actorId: admin.id, action: "DEVISE_ENREGISTREE", entity: "Currency", entityId: code,
    diff: { taux, validFrom },
  });
  revalidatePath("/admin/referentiels");
  return { succes: `Devise ${code} enregistrée.` };
}

export async function basculerActif(fd: FormData): Promise<void> {
  const admin = await requireRole("ADMIN");
  const type = String(fd.get("type") ?? "");
  const id = String(fd.get("id") ?? "");
  const actif = fd.get("actif") === "true";

  if (type === "category") await prisma.category.update({ where: { id }, data: { actif } });
  else if (type === "department") await prisma.department.update({ where: { id }, data: { actif } });
  else if (type === "currency") await prisma.currency.update({ where: { code: id }, data: { actif } });
  else return;

  await audit({
    actorId: admin.id, action: actif ? "REFERENTIEL_ACTIVE" : "REFERENTIEL_DESACTIVE",
    entity: type, entityId: id,
  });
  revalidatePath("/admin/referentiels");
}
