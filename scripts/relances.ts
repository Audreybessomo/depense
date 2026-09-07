/**
 * Envoie les relances en attente. Prévu pour être lancé une fois par jour —
 * le service « taches » du docker-compose s'en charge — mais on peut aussi
 * l'exécuter à la main :
 *
 *   npx tsx scripts/relances.ts
 */
import { envoyerLesRelances } from "../src/server/relances";

async function main() {
  const debut = Date.now();
  const bilan = await envoyerLesRelances();
  const duree = ((Date.now() - debut) / 1000).toFixed(1);

  const horodatage = new Date().toLocaleString("fr-FR");
  console.log(
    `[relances ${horodatage}] ` +
      `${bilan.approbateursRelances} approbateur(s) relancé(s), ` +
      `${bilan.escalades} escalade(s), ` +
      `${bilan.confirmationsRelancees} confirmation(s) relancée(s) — ${duree}s`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("[relances] échec :", e);
  process.exit(1);
});
