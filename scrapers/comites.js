// Scraper — les rapports de comité de l'Assemblée législative du Nouveau-Brunswick (27 nov. 2026).
//
// Version réduite voulue par Martin : pas de section à part. Chaque projet de loi a déjà la date
// de son étude en comité (scrapers/bills.js) ; on y ajoute le NOM du comité et le LIEN vers son
// rapport officiel, tirés des rapports PDF que chaque comité publie après une réunion.
//
// Le N.-B. ne publie pas de transcription des réunions de comité : seulement ces rapports, deux
// pages (« Your Committee met on November 17, 2026, and had under consideration: Bill 8, …; Bill 9,
// …; and have agreed to the same. »). Lus sans IA. Un résultat n'est gardé que si sa formule est une
// de celles qu'on a lues (RESULTATS) ; sinon la fiche dit seulement « étudié », avec le lien.
//
// Politesse : tout passe par lire() (robots.txt, 10 s entre deux lectures). Un rapport déjà lu ne
// l'est plus jamais (cache dans data/comites.json) ; seules les pages des comités sont relues.
//
//   node scrapers/comites.js

import { load } from 'cheerio';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { lire, HOTE } from './nb-commun.js';

const SORTIE = 'data/comites.json';
const MOIS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const dateAnglaise = (s) => {
  const m = String(s).match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  const i = m ? MOIS.indexOf(m[1].toLowerCase()) : -1;
  return i < 0 ? null : `${m[3]}-${String(i + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
};
// Les formules lues dans de vrais rapports. Ordre : la plus précise d'abord.
const RESULTATS = [
  { re: /agreed to the same with certain amendments/i, cle: 'amende' },
  { re: /agreed to the same/i, cle: 'adopte' },
];

const bills = JSON.parse(readFileSync('data/bills.json', 'utf8')).bills || [];
const LEG = Math.max(...bills.map((b) => Number(b.legislature) || 0));
const ancien = existsSync(SORTIE) ? JSON.parse(readFileSync(SORTIE, 'utf8')) : { rapports: {} };
const rapports = ancien.rapports || {};

// 1. Les comités et leurs noms officiels, en anglais et en français.
const noms = async (chemin, prefixe) => {
  const $ = load(await lire(chemin));
  const out = {};
  $('a[href]').each((_, a) => {
    const m = decodeURI($(a).attr('href')).match(new RegExp(`^/${prefixe}/(\\d+)/`));
    const nom = $(a).text().replace(/\s+/g, ' ').trim();
    if (m && nom && !out[m[1]]) out[m[1]] = { chemin: $(a).attr('href'), nom };
  });
  return out;
};
const en = await noms('/en/committees', 'en/committees');
const fr = await noms('/fr/comit%C3%A9s', 'fr/comités');
const comites = Object.entries(en).map(([id, c]) => ({ id, chemin: c.chemin, nomEn: c.nom, nomFr: fr[id]?.nom || null }));
console.log(`${comites.length} comités (${comites.filter((c) => c.nomFr).length} avec leur nom français)`);

// 2. Sur la page de chaque comité, les rapports de la législature en cours.
let nouveaux = 0;
for (const c of comites) {
  let html;
  try { html = await lire(c.chemin); } catch (e) { console.warn(`  ${c.nomEn} : page illisible (${e.message})`); continue; }
  const liens = [...new Set([...html.matchAll(/href="([^"]*\\reports\\(\d+)-(\d+)\\[^"]+\.pdf)"/gi)]
    .filter((m) => Number(m[2]) === LEG).map((m) => m[1].replace(/\\/g, '/')))];
  for (const lien of liens) {
    if (rapports[lien]) { rapports[lien].comite = c.id; continue; }
    const [, leg, ses] = lien.match(/\/(\d+)-(\d+)\//);
    let texte;
    try { texte = (await pdf(await lire(encodeURI(lien), { binaire: true }))).text.replace(/\s+/g, ' '); }
    catch (e) { console.warn(`  ${lien} : rapport illisible (${e.message})`); continue; }
    const reunion = dateAnglaise((texte.match(/met on ([A-Za-z]+ \d{1,2}, \d{4})/) || [])[1] || '');
    const bloc = (texte.match(/under consideration:?(.*?)(and ha(?:ve|s) agreed|Your Committee|Respectfully|$)/i) || [])[1] || '';
    const projets = [...new Set([...bloc.matchAll(/Bill (\d+)\b/g)].map((m) => Number(m[1])))];
    const resultat = RESULTATS.find((r) => r.re.test(texte))?.cle || null;
    rapports[lien] = { comite: c.id, legislature: Number(leg), session: Number(ses), reunion, projets, resultat, lu: new Date().toISOString().slice(0, 10) };
    nouveaux++;
    console.log(`  ${c.nomEn} · ${reunion ?? '?'} · projets ${projets.join(', ') || '—'} · ${resultat ?? 'résultat non reconnu'}`);
  }
}

writeFileSync(SORTIE, JSON.stringify({
  source: `${HOTE}/en/committees`,
  luLe: new Date().toISOString(),
  comites: Object.fromEntries(comites.map((c) => [c.id, { nomFr: c.nomFr, nomEn: c.nomEn, url: HOTE + c.chemin }])),
  rapports,
}, null, 1) + '\n');
console.log(`${Object.keys(rapports).length} rapports connus (${nouveaux} nouveaux) écrits dans ${SORTIE}`);
