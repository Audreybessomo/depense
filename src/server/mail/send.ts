import "server-only";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type Email = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

let transport: import("nodemailer").Transporter | null = null;

async function getTransport() {
  if (transport) return transport;
  const nodemailer = await import("nodemailer");
  transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === "true",
    auth:
      env.SMTP_USER && env.SMTP_PASSWORD
        ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
        : undefined,
  });
  return transport;
}

/**
 * L'envoi ne doit jamais faire echouer l'action metier : une approbation
 * reste valide meme si le serveur SMTP est injoignable. On journalise.
 */
export async function envoyerEmail(email: Email): Promise<boolean> {
  try {
    if (env.MAIL_DRIVER === "console") {
      logger.info(
        { to: email.to, subject: email.subject },
        "[MAIL:console] email simule (definir MAIL_DRIVER=smtp pour envoyer)",
      );
      // eslint-disable-next-line no-console
      console.log(`\n───── EMAIL ─────\nÀ      : ${email.to}\nObjet  : ${email.subject}\n${email.text ?? ""}\n─────────────────\n`);
      return true;
    }
    const t = await getTransport();
    await t.sendMail({
      from: env.MAIL_FROM,
      to: email.to,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    return true;
  } catch (err) {
    logger.error({ err, to: email.to, subject: email.subject }, "Echec envoi email");
    return false;
  }
}
