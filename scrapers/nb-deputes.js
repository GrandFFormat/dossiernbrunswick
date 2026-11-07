// Scraper — les député·e·s de l'Assemblée législative du Nouveau-Brunswick.
//
// Source : legnb.ca/en/members/current, qui liste tout le monde avec le parti, la
// circonscription, le portrait et la couleur officielle du parti. La même page annonce les
// « Party Standings » (la composition de la Chambre) : on compare ce total au nombre de
// cartes qu'on a lues, et on s'arrête si les deux ne concordent pas.
//
// Deux choses à savoir sur le N.-B. :
//
// 1. LA PRÉSIDENTE NE VOTE PAS. Francine Landry préside l'Assemblée. Elle apparaît dans la
//    liste comme tout le monde, mais un vote nominatif ne peut donc jamais dépasser 48 voix
//    sur 49 sièges. Le scraper des votes s'appuie là-dessus.
//
// 2. LES COURRIELS SONT MASQUÉS. legnb.ca passe par la protection de Cloudflare
//    (`data-cfemail`) : les adresses ne sont pas dans la page, seulement une version
//    brouillée que du JavaScript décode dans le navigateur. On ne la décode pas — ce serait
//    contourner une protection volontaire. Le site renvoie donc vers la fiche officielle.
//
//   node scrapers/nb-deputes.js

import { load } from 'cheerio';
import { lire, texte, lireCarteMembre, ecrireJson, HOTE } from './nb-commun.js';

const SORTIE = 'data/deputes.json';
const LISTE = '/en/members/current';

/** « 31 Liberal Party · 16 Progressive Conservative Party · 2 Green Party » */
function lireCompositionAnnoncee(texteDeLaPage) {
  const bloc = (texteDeLaPage.match(/Party Standings(.*?)(?:Executive Council|Members Listing)/) || [])[1] || '';
  const standings = new Map();
  for (const m of bloc.matchAll(/(\d+)\s+((?:[A-Z][\w'’.-]*\s?)+Party|Independent)/g)) {
    standings.set(m[2].trim(), Number(m[1]));
  }
  return standings;
}

async function main() {
  const html = await lire(LISTE);
  const $ = load(html);

  const deputes = $('#members-list .member-card')
    .map((_, el) => lireCarteMembre($, el))
    .get()
    .filter((d) => d.nom);

  if (!deputes.length) throw new Error('aucune carte de député·e trouvée — le gabarit de la page a changé');

  // Le site annonce lui-même la composition de la Chambre : on la vérifie plutôt que de la croire.
  const annoncee = lireCompositionAnnoncee(texte($.html()));
  const compte = new Map();
  for (const d of deputes) compte.set(d.parti, (compte.get(d.parti) || 0) + 1);

  const ecarts = [];
  for (const [parti, n] of annoncee) {
    if (compte.get(parti) !== n) ecarts.push(`${parti} : la page annonce ${n}, j'ai lu ${compte.get(parti) ?? 0}`);
  }
  for (const [parti, n] of compte) {
    if (!annoncee.has(parti)) ecarts.push(`${parti} : ${n} lu·e·s, mais le parti n'est pas dans les totaux de la page`);
  }
  if (ecarts.length) throw new Error(`composition de la Chambre incohérente :\n  - ${ecarts.join('\n  - ')}`);

  const total = [...annoncee.values()].reduce((a, b) => a + b, 0);
  console.log(`${deputes.length} député·e·s, conformes aux totaux de la page (${[...annoncee].map(([p, n]) => `${n} ${p}`).join(', ')})`);

  // Les noms de la liste s'écrivent « Famille, Prénom ». On garde la forme officielle et on
  // ajoute la forme courante, celle qu'on affiche.
  for (const d of deputes) {
    const m = d.nom.match(/^([^,]+),\s*(.+)$/);
    d.nomOfficiel = d.nom;
    d.nomAffiche = m ? `${m[2]} ${m[1]}` : d.nom;
    delete d.nom;
  }

  ecrireJson(SORTIE, {
    luLe: new Date().toISOString(),
    source: HOTE + LISTE,
    sieges: total,
    composition: Object.fromEntries(annoncee),
    note: 'La présidence de l\'Assemblée ne vote pas : un vote nominatif ne peut donc pas dépasser '
      + `${total - 1} voix sur ${total} sièges.`,
    courriels: 'Non publiés ici : legnb.ca les masque derrière la protection de Cloudflare, et on ne la contourne pas. Voir la fiche officielle de chaque député·e.',
    deputes,
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
