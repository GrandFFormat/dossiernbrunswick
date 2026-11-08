// Scraper — le Conseil exécutif (le cabinet) du Nouveau-Brunswick, au format de DossierQuébec
// ({ name, role, roleEn, party }).
//
// Source : legnb.ca, page du Conseil exécutif, en anglais et en français. Chaque membre : une
// carte de député·e, puis la liste de ses portefeuilles. Le français est celui de l'Assemblée :
// on ne traduit rien.
//
// POURQUOI L'ASSEMBLÉE PLUTÔT QUE gnb.ca : le 19 sept. 2026, les deux listes officielles se
// contredisaient sur un portefeuille, et c'est celle de l'Assemblée qui était à jour (un
// communiqué du gouvernement du 11 août 2026 lui donnait raison).
//
// Vérifications, sinon rien n'est écrit :
//   - les deux pages nomment les mêmes personnes, dans le même ordre (numéro de fiche) ;
//   - la première ou le premier ministre y figure ;
//   - chaque membre se retrouve parmi les député·e·s (data/deputes.json).

import { readFileSync, writeFileSync } from 'node:fs';
import { lirePage, texte, HOTE } from './nb-commun.js';

const PAGE_EN = '/en/members/executive-council';
const PAGE_FR = '/fr/parlementaires/conseil-executif';
const OUT_PATH = 'data/ministers.json';

const numeroFiche = (href) => Number((String(href || '').match(/\/(\d+)\/[^/]*$/) || [])[1]) || null;

function lire($) {
  return $('.cabinet-member-list-item').map((_, bloc) => {
    const $b = $(bloc);
    return {
      id: numeroFiche($b.find('.member-card-description-name a').attr('href')),
      postes: $b.find('ul.cabinet-member-positions li').map((__, li) => texte($(li).html())).get().filter(Boolean),
    };
  }).get().filter((m) => m.id);
}

async function main() {
  const { deputes } = JSON.parse(readFileSync('data/deputes.json', 'utf-8'));
  const parId = new Map(deputes.map((d) => [d.assnatId, d]));
  const en = lire(await lirePage(PAGE_EN));
  const fr = lire(await lirePage(PAGE_FR));

  const erreurs = [];
  if (!en.length) erreurs.push('aucun membre lu sur la page anglaise');
  if (en.length !== fr.length) erreurs.push(`${en.length} membres en anglais, ${fr.length} en français`);
  en.forEach((m, i) => {
    if (fr[i]?.id !== m.id) erreurs.push(`rang ${i + 1} : fiches différentes en anglais et en français`);
    if (!m.postes.length) erreurs.push(`fiche ${m.id} : aucun portefeuille lu`);
    if (!parId.has(m.id)) erreurs.push(`fiche ${m.id} : introuvable parmi les député·e·s`);
  });
  if (!en.some((m) => m.postes.some((p) => /^Premier\b/i.test(p)))) erreurs.push('la première ou le premier ministre manque à la liste');
  if (erreurs.length) {
    console.error(`ministers.js : rien n'est écrit —`);
    for (const e of erreurs) console.error(`  ✗ ${e}`);
    process.exitCode = 1;
    return;
  }

  // Les portefeuilles, joints comme sur DossierQuébec (« Premier ministre · Ministre de… »). La
  // majuscule initiale de chaque poste français : l'Assemblée les écrit en minuscules dans une liste.
  const majuscule = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const ministers = en.map((m, i) => {
    const d = parId.get(m.id);
    return {
      name: d.name,
      role: fr[i].postes.map(majuscule).join(' · '),
      roleEn: m.postes.join(' · '),
      party: d.party,
      assnatId: d.assnatId,
    };
  });

  writeFileSync(OUT_PATH, JSON.stringify({
    source: HOTE + PAGE_EN,
    sourceFr: HOTE + PAGE_FR,
    scrapedAt: new Date().toISOString(),
    count: ministers.length,
    ministers,
  }, null, 2) + '\n');
  console.log(`${ministers.length} membres du Conseil exécutif écrits dans ${OUT_PATH} — 1re : ${ministers[0].name} (${ministers[0].roleEn})`);
}

main().catch((err) => {
  console.error('Échec du scraper ministers.js :', err.message);
  process.exitCode = 1;
});
