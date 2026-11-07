// Scraper — les hauts fonctionnaires de l'Assemblée du Nouveau-Brunswick.
//
// Ce sont les sept charges indépendantes du gouvernement et des partis : vérificateur
// général, directeur général des élections, défenseur des enfants, des jeunes et des aînés,
// commissaire aux langues officielles, défenseur du consommateur en matière d'assurances,
// commissaire à l'intégrité, ombud. Ils relèvent de l'Assemblée, pas du gouvernement, et
// sont nommés pour un mandat fixe de sept à dix ans.
//
// POURQUOI ILS COMPTENT ICI : c'est à eux qu'on s'adresse quand une loi ne suit pas son
// cours, et le commissaire à l'intégrité tient le registre des lobbyistes. Le lexique les
// nomme, avec leur site, pour que le mot « ombud » mène quelque part.
//
// L'Assemblée ne publie PAS le nom des personnes en poste sur cette page — seulement les
// charges. On n'en invente donc aucun : on nomme la charge et on renvoie à son site.
//
//   node scrapers/nb-officiers.js

import { load } from 'cheerio';
import { lire, texte, ecrireJson, HOTE } from './nb-commun.js';

const SORTIE = 'data/officiers.json';
const PAGES = { en: '/en/legislative-officers', fr: '/fr/hauts-fonctionnaires-de-assemblée' };

/** Les charges et leur site, dans l'ordre où la page les présente. */
function lireOfficiers(html) {
  const $ = load(html);
  $('script, style, nav, header, footer').remove();
  const corps = $('main').length ? $('main') : $('body');

  // La page range les charges dans un tableau : le nom dans une cellule, son site dans la
  // suivante. On lit les rangées, pas les liens — un lien seul ne dit pas de quoi il parle.
  const charges = [];
  corps.find('table tr').each((_, tr) => {
    const cellules = $(tr).find('td');
    if (cellules.length < 2) return;
    const nom = texte($(cellules[0]).html() || '').trim();
    const site = $(cellules[1]).find('a[href^="http"]').attr('href');
    if (!nom || !site) return;
    charges.push({ nom, site });
  });

  const intro = texte(corps.find('p').first().html() || '').trim();
  return { intro, charges };
}

async function main() {
  const resultats = {};
  for (const [langue, chemin] of Object.entries(PAGES)) {
    resultats[langue] = lireOfficiers(await lire(chemin));
    console.log(`${langue} : ${resultats[langue].charges.length} charges`);
  }

  // Le contrôle : les deux langues doivent annoncer le même nombre de charges. Si l'une en
  // a plus que l'autre, la page a changé d'un côté et on ne publie pas un lexique bancal.
  if (resultats.fr.charges.length !== resultats.en.charges.length) {
    throw new Error(
      `la page anglaise annonce ${resultats.en.charges.length} charges et la française `
      + `${resultats.fr.charges.length}. Rien n'est publié : le gabarit a changé d'un côté.`,
    );
  }
  if (!resultats.en.charges.length) {
    throw new Error('aucune charge lue — le gabarit de la page a changé.');
  }

  const officiers = resultats.en.charges.map((c, i) => ({
    nom: { en: c.nom, fr: resultats.fr.charges[i].nom },
    site: { en: c.site, fr: resultats.fr.charges[i].site },
  }));

  for (const o of officiers) console.log(`  ${o.nom.fr} — ${o.site.fr}`);

  ecrireJson(SORTIE, {
    luLe: new Date().toISOString(),
    source: { en: HOTE + PAGES.en, fr: HOTE + PAGES.fr },
    intro: { en: resultats.en.intro, fr: resultats.fr.intro },
    officiers,
  });
}

main().catch((e) => { console.error(e.message); process.exit(1); });
