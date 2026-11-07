// Rafraîchit toutes les données du site, puis reconstruit les pages.
//
// L'ordre compte : le build lit ce que les scrapers viennent d'écrire. Chaque scraper est
// lancé dans son propre processus, pour qu'un échec ne laisse pas les autres à moitié faits
// et pour que la file des dix secondes de legnb.ca reparte propre à chaque fois.
//
// POURQUOI ON NE S'ARRÊTE PAS AU PREMIER ÉCHEC : les quatre jeux de données sont
// indépendants. Si la page des votes change de forme, les projets de loi et les député·e·s
// n'ont aucune raison de rester vieux d'un jour de plus. On lance donc tout, on reconstruit
// avec ce qu'on a, et on sort en erreur à la fin pour que l'échec se voie dans GitHub.
//
// Le site ne contient jamais de donnée inventée : un scraper qui échoue laisse son fichier
// précédent en place, et chaque page affiche la date de la dernière lecture réussie.
//
//   node scripts/refresh.js

import { spawnSync } from 'node:child_process';

const ETAPES = [
  ['projets de loi', 'scrapers/nb-projets-de-loi.js'],
  ['député·e·s', 'scrapers/nb-deputes.js'],
  ['Conseil exécutif', 'scrapers/nb-conseil-executif.js'],
  ['calendrier', 'scrapers/nb-calendrier.js'],
  ['votes nominatifs', 'scrapers/nb-votes.js'],
];

const echecs = [];

for (const [nom, script] of ETAPES) {
  console.log(`\n=== ${nom} ===`);
  const r = spawnSync(process.execPath, [script], { stdio: 'inherit' });
  if (r.status !== 0) {
    echecs.push(nom);
    console.error(`!! ${nom} : échec (code ${r.status}) — les données précédentes restent en place`);
  }
}

console.log('\n=== pages ===');
const build = spawnSync(process.execPath, ['scripts/build.js'], { stdio: 'inherit' });
if (build.status !== 0) echecs.push('construction des pages');

if (echecs.length) {
  console.error(`\nRafraîchissement incomplet : ${echecs.join(', ')}.`);
  process.exitCode = 1;
} else {
  console.log('\nRafraîchissement complet.');
}
