// Scraper — le Conseil exécutif (le cabinet) du Nouveau-Brunswick.
//
// Source : legnb.ca/en/members/executive-council, et non la page du gouvernement.
//
// POURQUOI L'ASSEMBLÉE PLUTÔT QUE gnb.ca : les deux listes officielles se contredisent. Le
// 19 septembre 2026, gnb.ca donnait Jean-Claude D'Amours comme ministre de l'Éducation
// postsecondaire « par intérim » et Alyson Townsend comme titulaire, tandis que legnb.ca
// donnait l'inverse. Un communiqué du gouvernement du 11 août 2026 parle de « Post-Secondary
// Education and Training Minister Jean-Claude D'Amours » : c'est la page de l'Assemblée qui
// était à jour, celle du gouvernement qui traînait. On lit donc l'Assemblée, et on publie la
// date de lecture pour que le lecteur sache de quand parle la liste.
//
//   node scrapers/nb-conseil-executif.js

import { load } from 'cheerio';
import { lire, texte, lireCarteMembre, separerNom, ecrireJson, HOTE } from './nb-commun.js';

const SORTIE = 'data/conseil-executif.json';
const PAGE = '/en/members/executive-council';
const PAGE_FR = '/fr/parlementaires/conseil-executif';

async function main() {
  const $ = load(await lire(PAGE));
  // Un membre = une carte, PLUS une liste de portefeuilles qui est sa voisine et non son
  // enfant : les deux vivent côte à côte dans `.cabinet-member-list-item`. Un ministre
  // peut porter un seul portefeuille comme quatre.
  const blocs = $('.cabinet-member-list-item').toArray();
  if (!blocs.length) throw new Error('aucun membre trouvé sur la page du Conseil exécutif — gabarit changé');

  const membres = blocs
    .map((bloc) => {
      const carte = $(bloc).find('.member-card').first();
      if (!carte.length) return null;
      const m = lireCarteMembre($, carte);
      m.roles = $(bloc)
        .find('ul.cabinet-member-positions li')
        .map((_, li) => texte($(li).html()))
        .get()
        .filter(Boolean);
      return m;
    })
    .filter((m) => m && m.nom);

  // La première ministre doit s'y trouver : si elle manque, on a lu la mauvaise page.
  const premiere = membres.find((m) => m.roles.some((r) => /^Premier\b/i.test(r)));
  if (!premiere) throw new Error('la première ministre ne figure pas dans la liste lue — page ou gabarit inattendu');

  for (const m of membres) {
    const { nomAffiche, titre } = separerNom(m.nom);
    m.nomOfficiel = m.nom;
    m.nomAffiche = nomAffiche;
    m.titre = titre;
    delete m.nom;
  }

  console.log(`${membres.length} membres du Conseil exécutif`);
  for (const m of membres) console.log(`  ${m.nomAffiche} — ${m.roles.join(' · ') || 'sans portefeuille publié'}`);

  ecrireJson(SORTIE, {
    luLe: new Date().toISOString(),
    source: HOTE + PAGE,
    sourceFr: HOTE + PAGE_FR,
    avertissement: 'Liste tenue par l\'Assemblée législative. La page du gouvernement (gnb.ca) a déjà '
      + 'été en retard sur celle-ci : en cas de divergence, c\'est cette page-ci qui a fait foi.',
    membres,
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
