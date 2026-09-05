/**
 * Version imprimable du manuel, produite avec le Chrome de la machine.
 */
import puppeteer from "puppeteer-core";
import path from "node:path";
import fs from "node:fs/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function main() {
  const source = path.resolve("docs/manuel/manuel-depenses.html");
  const sortie = path.resolve("docs/manuel/Manuel-des-depenses.pdf");

  const navigateur = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--hide-scrollbars", "--allow-file-access-from-files"],
  });
  const page = await navigateur.newPage();
  await page.emulateMediaType("print");
  await page.goto(`file://${source}`, { waitUntil: "networkidle0", timeout: 120_000 });
  await new Promise((r) => setTimeout(r, 2500));

  await page.pdf({
    path: sortie,
    format: "A4",
    printBackground: true,
    margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
    displayHeaderFooter: true,
    headerTemplate: `<div></div>`,
    footerTemplate:
      `<div style="width:100%;font-size:8px;color:#78838d;padding:0 14mm;
        font-family:-apple-system,sans-serif;display:flex;justify-content:space-between">
        <span>Manuel des dépenses</span>
        <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
      </div>`,
  });

  await navigateur.close();
  const { size } = await fs.stat(sortie);
  console.log(`  ${sortie}`);
  console.log(`  ${(size / 1024 / 1024).toFixed(1)} Mo`);
}
main();
