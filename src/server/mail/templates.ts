import { env } from "@/lib/env";

type Bouton = { label: string; url: string };

/** Gabarit HTML unique : tableau centre, styles inline, compatible Outlook. */
function gabarit(opts: {
  titre: string;
  intro: string;
  lignes?: [string, string][];
  encart?: string;
  bouton?: Bouton;
  pied?: string;
}) {
  const lignes = (opts.lignes ?? [])
    .map(
      ([k, v]) => `
      <tr>
        <td style="padding:6px 0;color:#64748b;font-size:14px;">${k}</td>
        <td style="padding:6px 0;color:#0f172a;font-size:14px;font-weight:600;text-align:right;">${v}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <tr><td style="background:#0f172a;padding:20px 28px;">
      <span style="color:#ffffff;font-size:16px;font-weight:700;letter-spacing:-0.2px;">${env.APP_NAME}</span>
    </td></tr>
    <tr><td style="padding:28px;">
      <h1 style="margin:0 0 12px;font-size:19px;color:#0f172a;font-weight:700;">${opts.titre}</h1>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">${opts.intro}</p>
      ${lignes ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:0 0 20px;padding:8px 0;">${lignes}</table>` : ""}
      ${opts.encart ? `<div style="background:#f8fafc;border-left:3px solid #94a3b8;padding:12px 14px;margin:0 0 20px;font-size:14px;color:#334155;line-height:1.6;">${opts.encart}</div>` : ""}
      ${
        opts.bouton
          ? `<a href="${opts.bouton.url}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">${opts.bouton.label}</a>
             <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;word-break:break-all;">Si le bouton ne fonctionne pas : ${opts.bouton.url}</p>`
          : ""
      }
    </td></tr>
    <tr><td style="padding:16px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
      <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.5;">${opts.pied ?? "Message automatique — merci de ne pas y répondre."}</p>
    </td></tr>
  </table>
</body></html>`;
}

const texte = (lignes: string[]) => lignes.filter(Boolean).join("\n");

export function mailDemandeAValider(p: {
  approbateur: string; demandeur: string; numero: string; objet: string;
  montant: string; categorie: string; url: string;
}) {
  return {
    subject: `[${p.numero}] Demande à valider — ${p.montant}`,
    html: gabarit({
      titre: "Une demande attend votre validation",
      intro: `Bonjour ${p.approbateur},<br><strong>${p.demandeur}</strong> vous a assigné une demande de paiement.`,
      lignes: [
        ["Référence", p.numero],
        ["Objet", p.objet],
        ["Catégorie", p.categorie],
        ["Montant TTC", p.montant],
      ],
      bouton: { label: "Ouvrir la demande", url: p.url },
    }),
    text: texte([
      `${p.demandeur} vous a assigné la demande ${p.numero}.`,
      `Objet : ${p.objet} — Montant : ${p.montant}`,
      `Valider ici : ${p.url}`,
    ]),
  };
}

export function mailDecision(p: {
  demandeur: string; numero: string; objet: string; montant: string;
  approbateur: string; approuve: boolean; commentaire?: string | null; url: string;
}) {
  return {
    subject: `[${p.numero}] Demande ${p.approuve ? "approuvée" : "rejetée"}`,
    html: gabarit({
      titre: p.approuve ? "Votre demande a été approuvée" : "Votre demande a été rejetée",
      intro: `Bonjour ${p.demandeur},<br><strong>${p.approbateur}</strong> a ${p.approuve ? "approuvé" : "rejeté"} votre demande.`,
      lignes: [
        ["Référence", p.numero],
        ["Objet", p.objet],
        ["Montant TTC", p.montant],
      ],
      encart: p.commentaire ? `<strong>Motif :</strong> ${p.commentaire}` : undefined,
      bouton: { label: "Voir le détail", url: p.url },
    }),
    text: texte([
      `Demande ${p.numero} ${p.approuve ? "approuvée" : "rejetée"} par ${p.approbateur}.`,
      p.commentaire ? `Motif : ${p.commentaire}` : "",
      `Détail : ${p.url}`,
    ]),
  };
}

export function mailInfoDemandee(p: {
  demandeur: string; numero: string; approbateur: string; question: string; url: string;
}) {
  return {
    subject: `[${p.numero}] Complément d'information demandé`,
    html: gabarit({
      titre: "Un complément d'information est demandé",
      intro: `Bonjour ${p.demandeur},<br><strong>${p.approbateur}</strong> a besoin de précisions avant de statuer sur la demande <strong>${p.numero}</strong>.`,
      encart: p.question,
      bouton: { label: "Répondre et resoumettre", url: p.url },
    }),
    text: texte([`${p.approbateur} demande des précisions sur ${p.numero} :`, p.question, p.url]),
  };
}

export function mailResoumise(p: {
  approbateur: string; demandeur: string; numero: string; url: string;
}) {
  return {
    subject: `[${p.numero}] Demande complétée et resoumise`,
    html: gabarit({
      titre: "La demande a été complétée",
      intro: `Bonjour ${p.approbateur},<br><strong>${p.demandeur}</strong> a répondu à votre demande d'information sur <strong>${p.numero}</strong>.`,
      bouton: { label: "Reprendre la validation", url: p.url },
    }),
    text: `${p.demandeur} a complété la demande ${p.numero} : ${p.url}`,
  };
}

export function mailPaiement(p: {
  demandeur: string; numero: string; montant: string; reference: string; url: string;
}) {
  return {
    subject: `[${p.numero}] Réglée — merci de confirmer et de joindre vos justificatifs`,
    html: gabarit({
      titre: "Votre dépense a été réglée",
      intro:
        `Bonjour ${p.demandeur}, le règlement de la dépense <strong>${p.numero}</strong> a été ` +
        `enregistré. Il vous reste une dernière étape : <strong>confirmer la réception</strong>, ` +
        `joindre les factures ou reçus définitifs et laisser un message.`,
      lignes: [["Montant", p.montant], ["Référence de règlement", p.reference]],
      encart:
        "Tant que la confirmation n'est pas faite, la dépense reste ouverte et apparaît " +
        "comme en attente de justificatifs dans l'état de la période.",
      bouton: { label: "Confirmer et joindre mes pièces", url: p.url },
    }),
    text: texte([
      `Dépense ${p.numero} réglée (${p.montant}), référence ${p.reference}.`,
      "Merci de confirmer la réception et de joindre vos justificatifs définitifs :",
      p.url,
    ]),
  };
}

export function mailConfirmation(p: {
  destinataire: string; demandeur: string; numero: string; objet: string;
  montant: string; message: string; nbPieces: number; url: string;
}) {
  return {
    subject: `[${p.numero}] Réception confirmée par ${p.demandeur}`,
    html: gabarit({
      titre: "Le demandeur a confirmé la réception",
      intro:
        `Bonjour ${p.destinataire},<br><strong>${p.demandeur}</strong> a confirmé avoir reçu le ` +
        `règlement de la dépense <strong>${p.numero}</strong> et a joint ` +
        `${p.nbPieces} pièce${p.nbPieces > 1 ? "s" : ""} justificative${p.nbPieces > 1 ? "s" : ""}.`,
      lignes: [["Objet", p.objet], ["Montant", p.montant]],
      encart: `<strong>Message du demandeur :</strong> ${p.message}`,
      bouton: { label: "Voir les pièces", url: p.url },
    }),
    text: texte([
      `${p.demandeur} a confirmé la réception de ${p.numero} (${p.montant}).`,
      `${p.nbPieces} pièce(s) jointe(s). Message : ${p.message}`,
      p.url,
    ]),
  };
}

export function mailLienConnexion(p: { nom: string; url: string; minutes: number }) {
  return {
    subject: `Votre lien de connexion — ${env.APP_NAME}`,
    html: gabarit({
      titre: "Connexion à votre espace",
      intro: `Bonjour ${p.nom}, cliquez sur le bouton ci-dessous pour vous connecter. Ce lien est valable ${p.minutes} minutes et ne fonctionne qu'une seule fois.`,
      bouton: { label: "Me connecter", url: p.url },
      pied: "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    }),
    text: `Lien de connexion (valable ${p.minutes} min) : ${p.url}`,
  };
}

export function mailBienvenue(p: { nom: string; url: string; role: string }) {
  return {
    subject: `Votre accès à ${env.APP_NAME}`,
    html: gabarit({
      titre: "Bienvenue",
      intro: `Bonjour ${p.nom}, un compte vient d'être créé pour vous avec le rôle <strong>${p.role}</strong>. Définissez votre mot de passe pour commencer.`,
      bouton: { label: "Définir mon mot de passe", url: p.url },
    }),
    text: `Compte créé (${p.role}). Définissez votre mot de passe : ${p.url}`,
  };
}
