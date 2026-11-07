// Scraper — la page Wikipédia de chaque personne qui a une fiche, dans les deux langues.
//
// POURQUOI UNE VÉRIFICATION. Chercher « John Herron » sur Wikipédia donne plusieurs
// personnes, et deux député·e·s du N.-B. partagent parfois un nom avec quelqu'un d'autre.
// Un lien W qui mène à la mauvaise personne est pire que pas de lien du tout.
//
// On ne garde donc une page QUE si son résumé la rattache au Nouveau-Brunswick ET à la
// politique. Les deux conditions, pas une. Ce qui ne passe pas n'a pas de bouton W, et le
// scraper le dit.
//
// Wikipédia demande un User-Agent qui nomme le projet : celui du site le fait déjà.
//
//   node scrapers/nb-wikipedia.js

import { readFileSync } from 'node:fs';
import { ecrireJson, existe, estChefDeParti, UA } from './nb-commun.js';

const SORTIE = 'data/wikipedia.json';
const DELAI_MS = 1000;   // Wikipédia ne demande pas de délai ; on reste poli quand même.

const LANGUES = {
  fr: {
    hote: 'fr.wikipedia.org',
    // La recherche se fait dans la langue de l'encyclopédie : chercher « Nouveau-Brunswick
    // politique » sur la Wikipédia anglaise ne trouvait personne.
    requete: (nom) => `${nom} Nouveau-Brunswick politique`,
    lieu: /nouveau[- ]brunswick/i,
    politique: /(député|ministre|politique|parti|assemblée législative)/i,
  },
  en: {
    hote: 'en.wikipedia.org',
    requete: (nom) => `${nom} New Brunswick politician`,
    lieu: /new brunswick/i,
    politique: /(politician|member of the legislative assembly|mla|minister|party|premier)/i,
  },
};

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const cle = (nom) => String(nom).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();

async function json(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!r.ok) throw new Error(`HTTP ${r.status} sur ${url}`);
  return r.json();
}

/**
 * Cherche une personne sur une Wikipédia, et ne rend une adresse que si le résumé de
 * l'article la rattache au Nouveau-Brunswick et à la politique.
 */
async function chercher(nom, langue) {
  const { hote, requete, lieu, politique } = LANGUES[langue];
  const recherche = `https://${hote}/w/api.php?action=query&list=search&srsearch=`
    + `${encodeURIComponent(requete(nom))}&srlimit=5&format=json&origin=*`;
  const { query } = await json(recherche);
  const candidats = (query?.search || []).map((s) => s.title);
  if (!candidats.length) return null;

  await dormir(DELAI_MS);

  // Le résumé des cinq premiers résultats, en une requête.
  const resumes = `https://${hote}/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1`
    + `&titles=${encodeURIComponent(candidats.join('|'))}&format=json&origin=*`;
  const pages = Object.values((await json(resumes)).query?.pages || {});

  for (const titre of candidats) {
    const page = pages.find((p) => p.title === titre);
    const texte = page?.extract || '';
    if (!texte) continue;
    // Le nom doit figurer dans le résumé, et l'article doit parler du N.-B. ET de politique.
    const nomDansLeTexte = cle(nom).split(' ').every((mot) => cle(texte).includes(mot));
    if (!nomDansLeTexte || !lieu.test(texte) || !politique.test(texte)) continue;
    return { titre, adresse: `https://${hote}/wiki/${encodeURIComponent(titre.replace(/ /g, '_'))}` };
  }
  return null;
}

async function main() {
  for (const f of ['data/conseil-executif.json', 'data/deputes.json', 'data/fiches.json']) {
    if (!existe(f)) throw new Error(`${f} manque — lancer les scrapers de personnes d'abord.`);
  }
  const conseil = JSON.parse(readFileSync('data/conseil-executif.json', 'utf8'));
  const deputes = JSON.parse(readFileSync('data/deputes.json', 'utf8'));
  const fiches = JSON.parse(readFileSync('data/fiches.json', 'utf8'));

  const roles = new Map(fiches.fiches.map((f) => [cle(f.nomAffiche), f.roles?.en || []]));
  const dansLeConseil = new Set(conseil.membres.map((m) => cle(m.nomAffiche)));

  // Les mêmes personnes que celles qui ont une fiche.
  const voulues = [
    ...conseil.membres,
    ...deputes.deputes.filter((d) => !dansLeConseil.has(cle(d.nomAffiche))
      && estChefDeParti(roles.get(cle(d.nomAffiche)))),
  ];

  console.log(`Wikipédia — ${voulues.length} personnes, deux langues chacune`);
  const trouvees = [];
  let sansPage = 0;

  for (const personne of voulues) {
    const pages = {};
    for (const langue of Object.keys(LANGUES)) {
      pages[langue] = await chercher(personne.nomAffiche, langue);
      await dormir(DELAI_MS);
    }
    const quoi = ['fr', 'en'].filter((l) => pages[l]).join(' + ') || 'aucune';
    console.log(`  ${personne.nomAffiche.padEnd(24)} ${quoi}`);
    if (!pages.fr && !pages.en) { sansPage += 1; continue; }
    trouvees.push({
      nomAffiche: personne.nomAffiche,
      fr: pages.fr?.adresse || null,
      en: pages.en?.adresse || null,
    });
  }

  console.log(`\n${trouvees.length} personnes avec une page vérifiée, ${sansPage} sans`);
  ecrireJson(SORTIE, {
    luLe: new Date().toISOString(),
    regle: 'une page n\'est gardée que si son résumé nomme la personne, le Nouveau-Brunswick et la politique',
    personnes: trouvees,
  });
}

main().catch((e) => { console.error(e.message); process.exit(1); });
