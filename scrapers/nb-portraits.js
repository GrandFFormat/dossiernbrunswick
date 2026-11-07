// Scraper — le portrait officiel des personnes qui ont leur page.
//
// L'Assemblée publie les portraits de ses membres sur legnb.ca, pour un usage « personal
// and public non-commercial ». Ce site est gratuit et non commercial : on les reprend
// **créditées**, avec un lien vers la fiche officielle sous chaque photo. On ne les retouche
// pas et on ne les recadre pas.
//
// QUI EN A UNE : les membres du Conseil exécutif, et les chefs de parti qui n'en font pas
// partie — les mêmes personnes qui ont une page. Les autres n'en ont pas besoin, et une
// image qu'aucune page n'affiche n'a rien à faire dans le dépôt.
//
// LE POIDS. L'Assemblée publie des fichiers de toutes les tailles — 47 ko pour l'un,
// 521 ko pour l'autre, jusqu'à 1000 × 1410 pixels pour une photo affichée à 200. On les
// réduit donc à la taille d'affichage, en WebP : 200 px de large, et 400 px pour les écrans
// à haute densité. Rien n'est recadré, seulement redimensionné.
//
// Les fichiers vont dans photos/<prenom-nom>.webp et <prenom-nom>@2x.webp.
//
//   node scrapers/nb-portraits.js

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { lire, ecrireJson, existe, estChefDeParti } from './nb-commun.js';

const DOSSIER = 'photos';
const SORTIE = 'data/portraits.json';

const sansAccent = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const slug = (nom) => sansAccent(nom).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const cle = (nom) => sansAccent(nom).toLowerCase().replace(/[^a-z]+/g, ' ').trim();

function lireJson(chemin) {
  if (!existe(chemin)) throw new Error(`${chemin} manque — lancer les scrapers de personnes d'abord.`);
  return JSON.parse(readFileSync(chemin, 'utf8'));
}

async function main() {
  const conseil = lireJson('data/conseil-executif.json');
  const deputes = lireJson('data/deputes.json');
  const fiches = existe('data/fiches.json') ? lireJson('data/fiches.json') : { fiches: [] };

  const roles = new Map(fiches.fiches.map((f) => [cle(f.nomAffiche), f.roles?.en || []]));
  const dansLeConseil = new Set(conseil.membres.map((m) => cle(m.nomAffiche)));

  // Les mêmes personnes que celles qui ont une page, et pas une de plus.
  const voulues = [
    ...conseil.membres,
    ...deputes.deputes.filter((d) => !dansLeConseil.has(cle(d.nomAffiche))
      && estChefDeParti(roles.get(cle(d.nomAffiche)))),
  ];

  console.log(`Portraits — ${voulues.length} personnes (Conseil exécutif et chefs de parti)`);
  mkdirSync(DOSSIER, { recursive: true });

  const publies = [];
  for (const personne of voulues) {
    if (!personne.portrait) {
      console.log(`  ${personne.nomAffiche} — aucun portrait publié par l'Assemblée`);
      continue;
    }
    const octets = await lire(personne.portrait, { binaire: true });
    const base = slug(personne.nomAffiche);

    // 200 px pour l'écran ordinaire, 400 px pour les écrans à haute densité.
    const tailles = await Promise.all([200, 400].map(async (largeur) => {
      const sortie = await sharp(octets).resize({ width: largeur, withoutEnlargement: true })
        .webp({ quality: 82 }).toBuffer();
      const nom = largeur === 200 ? `${base}.webp` : `${base}@2x.webp`;
      writeFileSync(`${DOSSIER}/${nom}`, sortie);
      return { nom, octets: sortie.length };
    }));

    const poidsPersonne = tailles.reduce((n, t) => n + t.octets, 0);
    publies.push({
      nomAffiche: personne.nomAffiche,
      fichier: `/${DOSSIER}/${base}.webp`,
      fichier2x: `/${DOSSIER}/${base}@2x.webp`,
      source: personne.portrait,
      octets: poidsPersonne,
    });
    console.log(`  ${personne.nomAffiche} — ${base}.webp (${Math.round(tailles[0].octets / 1024)} ko)`
      + ` + @2x (${Math.round(tailles[1].octets / 1024)} ko), d'un original de ${Math.round(octets.length / 1024)} ko`);
  }

  const poids = publies.reduce((n, p) => n + p.octets, 0);
  console.log(`\n${publies.length} portraits, ${Math.round(poids / 1024)} ko en tout`);

  ecrireJson(SORTIE, {
    luLe: new Date().toISOString(),
    credit: 'Assemblée législative du Nouveau-Brunswick',
    conditions: 'https://www.legnb.ca/en/disclaimer',
    portraits: publies,
  });
}

main().catch((e) => { console.error(e.message); process.exit(1); });
