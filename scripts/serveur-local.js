// Serveur local pour regarder le site, comme Vercel le servira.
//
// Il sert CE dossier, repéré depuis l'emplacement du fichier et non depuis le répertoire
// courant : le panneau d'aperçu de Claude peut le lancer depuis un autre projet, et un
// serveur qui servirait le mauvais dossier donnerait une page blanche inexplicable.
//
//   node scripts/serveur-local.js        http://localhost:8123

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8123;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

const estUnDossier = (chemin) => stat(chemin).then((s) => s.isDirectory(), () => false);
const existe = (chemin) => stat(chemin).then(() => true, () => false);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    // normalize() + le test de préfixe : une adresse comme /../../secret ne doit pas
    // sortir du dossier servi.
    let chemin = join(RACINE, normalize(decodeURIComponent(url.pathname)));
    if (!chemin.startsWith(RACINE)) {
      res.writeHead(403).end('Hors du dossier servi');
      return;
    }

    // Vercel sert les « URL propres » (cleanUrls) : /projets-de-loi donne le .html.
    //
    // L'ORDRE COMPTE. /ministres est à la fois une page (ministres.html) et un dossier
    // (ministres/, qui tient une page par personne). Le fichier gagne, comme chez Vercel :
    // chercher le dossier d'abord servait un index.html qui n'existe pas, et la page
    // tombait en 404 en local alors qu'elle s'affiche en ligne.
    if (!extname(chemin) && await existe(`${chemin}.html`)) chemin += '.html';
    else if (await estUnDossier(chemin)) chemin = join(chemin, 'index.html');
    else if (!extname(chemin)) chemin += '.html';

    const corps = await readFile(chemin);
    res.writeHead(200, {
      'Content-Type': TYPES[extname(chemin)] || 'application/octet-stream',
      'Cache-Control': 'no-store', // on regarde un site qu'on est en train d'écrire
    }).end(corps);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      .end('<p>404 — cette page n\'existe pas encore.</p>');
  }
}).listen(PORT, () => {
  console.log(`DossierNBrunswick servi depuis ${RACINE}`);
  console.log(`  français : http://localhost:${PORT}/`);
  console.log(`  anglais  : http://localhost:${PORT}/en/`);
});
