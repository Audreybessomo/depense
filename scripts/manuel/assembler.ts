/**
 * Injecte les captures dans le gabarit sous forme de data: URI, pour que la
 * page publiée soit autonome — aucune requête externe, donc rien à héberger
 * à côté.
 */
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  const racine = path.resolve("docs/manuel");
  let html = await fs.readFile(path.join(racine, "gabarit.html"), "utf8");

  const marqueurs = [...html.matchAll(/\{\{IMG:([a-z0-9-]+)\}\}/g)].map((m) => m[1]);
  const uniques = [...new Set(marqueurs)];

  let total = 0;
  for (const nom of uniques) {
    const fichier = path.join(racine, "opt", `${nom}.jpg`);
    const donnees = await fs.readFile(fichier);
    total += donnees.length;
    const uri = `data:image/jpeg;base64,${donnees.toString("base64")}`;
    html = html.replaceAll(`{{IMG:${nom}}}`, uri);
  }

  const restants = html.match(/\{\{IMG:[a-z0-9-]+\}\}/g);
  if (restants) throw new Error(`marqueurs non résolus : ${restants.join(", ")}`);

  const sortie = path.join(racine, "manuel-depenses.html");
  await fs.writeFile(sortie, html);

  const { size } = await fs.stat(sortie);
  console.log(`  ${uniques.length} captures intégrées (${(total / 1024 / 1024).toFixed(1)} Mo d'images)`);
  console.log(`  page : ${(size / 1024 / 1024).toFixed(1)} Mo — ${sortie}`);
}
main();
