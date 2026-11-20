// Le budget d'immobilisations de la Ville de Fredericton, lu dans le cahier budgétaire (N.-B.).
//
//   node scrapers/budget.js
//
// Copie de dossierBC/vancouver/scrapers/budget.js, source changée : Fredericton ne publie pas son
// budget en données ouvertes (le portail n'a que 2017). La source est le cahier budgétaire annuel, en
// PDF sur fredericton.ca. Le plus récent en ligne est celui de 2025 ; celui de 2026 n'est remis que sur
// demande au greffe (cityclerk@fredericton.ca), relevé de Hugette du 19 nov. 2026.
//
// Même sortie, même forme : data/budget.json { immobilisations: { categories → sousCategories → projets } }.
//   catégories      = les « Result Areas » de la Ville (Mobility, Livable Community…)
//   sous-catégories = Renewal/Rebuild, New/Extensions, Growth
//   projets         = la liste détaillée des pages 29 à 33 du cahier 2025
// Pas de « budget ouvert » ni de prévisions dans ce cahier : ouvert/demande restent à null. À la place
// des prévisions, la comparaison 2023–2025 que donne le cahier (page 27), et le service de la dette.
//
// Le PDF est gardé en local dans budget-pdf/ (exclu de git : pas de licence ouverte sur ce document).

import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { USER_AGENT } from '../lib/fre.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const ANNEE = 2025;
const SOURCE = 'https://www.fredericton.ca/sites/default/files/2025-05/2025%20Annual%20Budget-%20Final.pdf';
const PAGE_BUDGETS = 'https://www.fredericton.ca/node/517583';
const FICHIER = `budget-pdf/budget-${ANNEE}.pdf`;

if (!existsSync(FICHIER)) {
  await mkdir('budget-pdf', { recursive: true });
  const r = await fetch(SOURCE, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`${r.status} sur ${SOURCE}`);
  await writeFile(FICHIER, Buffer.from(await r.arrayBuffer()));
  console.log(`Cahier ${ANNEE} téléchargé.`);
}

// Le texte page par page, en lignes reconstruites par position : le nom d'un projet et son montant
// sont dans deux colonnes, qu'il faut garder sur la même ligne (séparées par « | »).
const pages = [];
await pdf(await readFile(FICHIER), {
  pagerender: async (page) => {
    const c = await page.getTextContent({ normalizeWhitespace: true });
    const lignes = [];
    for (const it of c.items) {
      const y = Math.round(it.transform[5]);
      let l = lignes.find((x) => Math.abs(x.y - y) <= 2);
      if (!l) lignes.push((l = { y, morceaux: [] }));
      l.morceaux.push({ x: it.transform[4], t: it.str, w: it.width });
    }
    lignes.sort((a, b) => b.y - a.y);
    const texte = lignes.map((l) => {
      l.morceaux.sort((a, b) => a.x - b.x);
      let s = '', fin = null;
      for (const m of l.morceaux) { if (fin != null && m.x - fin > 40) s += ' | '; s += m.t; fin = m.x + m.w; }
      return s.replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
    pages.push(texte);
    return texte.join('\n');
  },
});
const page = (no) => pages[no - 1] ?? [];   // numéro de page du PDF (1 = couverture)
const montant = (s) => Number(String(s).replace(/[$,\s]/g, '')) || 0;

// ---------- Les projets (pages 31 à 35 du PDF = pages 29 à 33 du cahier) ----------
const AIRES = ['Governance and Civic Engagement', 'Economic Vitality', 'Environmental Stewardship', 'Livable Community', 'Mobility', 'Public Safety', 'Sustainable Infrastructure', 'Corporate'];
const SOUS = [[/^Renewal\/Rebuild$/i, 'Renewal/Rebuild'], [/^New\/Extensions?$/i, 'New/Extensions'], [/^Growth$/i, 'Growth']];
const categories = new Map();
let aire = null, sous = null, attente = '';
for (let p = 31; p <= 35; p++) {
  for (const brut of page(p)) {
    const l = brut.replace(/\s*\|\s*/g, ' | ').trim();
    if (/^\d+$/.test(l) || /CAPITAL BUDGET RESULT AREA/i.test(l)) continue;
    const a = AIRES.find((x) => x === l);
    if (a) { aire = a; sous = null; attente = ''; continue; }
    const s = SOUS.find(([re]) => re.test(l));
    if (s) { sous = s[1]; attente = ''; continue; }
    if (/Total/i.test(l)) { attente = ''; continue; }
    const m = l.match(/^(.*?)\s*\|?\s*([\d,]+)\s*\$?$/);
    if (m && aire && sous && /\d{2,}/.test(m[2])) {
      // « … Roundabout $ » : le $ de la colonne des montants reste parfois collé au nom.
      const nom = `${attente} ${m[1]}`.replace(/\s*\|\s*/g, ' ').replace(/\s+/g, ' ').replace(/[\s$]+$/, '').trim();
      attente = '';
      if (!nom) { console.warn(`⚠ montant sans nom : ${l}`); continue; }
      const cat = categories.get(aire) ?? categories.set(aire, { nom: aire, depense: 0, ouvert: null, demande: null, previsions: {}, sousCategories: new Map() }).get(aire);
      const sc = cat.sousCategories.get(sous) ?? cat.sousCategories.set(sous, { nom: sous, depense: 0, projets: [] }).get(sous);
      const depense = montant(m[2]);
      // Un nom coupé par la Ville elle-même (« … (Parks & ») garde sa coupure, marquée.
      sc.projets.push({ nom: /[&(,]$/.test(nom) ? `${nom} …` : nom, cat3: '', approuve: null, demande: null, ouvert: null, disponible: null, depense, previsions: {} });
      sc.depense += depense; cat.depense += depense;
    } else if (aire && sous) {
      attente = `${attente} ${l}`.trim();   // un nom sur deux lignes : la première attend la seconde
    }
  }
}

// ---------- Les totaux du cahier, pour vérifier la lecture ----------
const ligneDe = (no, re) => page(no).find((l) => re.test(l)) ?? '';
const nombres = (l) => (l.match(/[\d,]{4,}/g) ?? []).map(montant);
const resume = AIRES.map((a) => [a, nombres(ligneDe(30, new RegExp(`^${a}\\b`)))]);
let ecarts = 0;
for (const [a, ns] of resume) {
  const lu = categories.get(a)?.depense ?? 0;
  const attendu = ns.at(-1) ?? 0;
  // Un secteur au sommaire sans liste détaillée dans le cahier (2025 : Sustainable Infrastructure,
  // 197 500 $) : il garde son total du sommaire, sans projets, et la page le dit.
  if (!lu && attendu) {
    categories.set(a, { nom: a, depense: attendu, ouvert: null, demande: null, previsions: {}, detailAbsent: true, sousCategories: new Map() });
    console.log(`  ${a} : ${attendu} $ au sommaire, sans liste de projets dans le cahier.`);
    continue;
  }
  if (lu !== attendu) { ecarts++; console.warn(`⚠ ${a} : lu ${lu}, le cahier dit ${attendu}`); }
}
const comparaison = nombres(ligneDe(29, /^Total \|/));   // 2023, 2024, 2025
const resumeFG = (re) => nombres(ligneDe(16, re));
const fondsGeneral = resumeFG(/^Total Operating and Capital Expenditures/)[0] ?? null;
const fonctionnement = resumeFG(/^Total Operating Expenditures/)[0] ?? null;
const dette = resumeFG(/^Debt Service Costs/)[0] ?? null;

const cats = [...categories.values()].sort((a, b) => b.depense - a.depense).map((c) => ({
  ...c,
  sousCategories: [...c.sousCategories.values()].sort((a, b) => b.depense - a.depense).map((s) => ({ ...s, projets: s.projets.sort((a, b) => b.depense - a.depense) })),
}));
const immobilisations = {
  source: SOURCE, jeu: `budget-${ANNEE}`, jeuModifieLe: null, annee: ANNEE,
  nombreProjets: cats.reduce((n, c) => n + c.sousCategories.reduce((m, s) => m + s.projets.length, 0), 0),
  totalDepense: cats.reduce((s, c) => s + c.depense, 0),
  totalOuvert: null, totalDemande: null,
  previsions: {},
  // N.-B. : les années PRÉCÉDENTES (le cahier compare 2023, 2024 et 2025), pas des prévisions.
  anneesPrecedentes: comparaison.length === 3 ? { 2023: comparaison[0], 2024: comparaison[1] } : {},
  fondsGeneral, fonctionnement, serviceDette: dette,
  categories: cats,
};
await mkdir('data', { recursive: true });
await writeFile('data/budget.json.tmp', JSON.stringify({
  source: SOURCE, pageBudgets: PAGE_BUDGETS,
  licence: 'Document de la Ville de Fredericton (fredericton.ca), sans licence ouverte',
  attribution: `Source: City of Fredericton, ${ANNEE} Annual Budget.`,
  extraction: new Date().toISOString(),
  immobilisations,
  conseil: null,
}, null, 1), 'utf8');
await rename('data/budget.json.tmp', 'data/budget.json');
const M = (x) => (x / 1e6).toFixed(1) + ' M$';
console.log(`Budget ${ANNEE} : ${immobilisations.nombreProjets} projets, ${M(immobilisations.totalDepense)} d'immobilisations (${ecarts ? `${ecarts} écart(s) avec le cahier` : 'égal au cahier, secteur par secteur'}).`);
console.log(`  Fonds général ${fondsGeneral ? M(fondsGeneral) : '?'} · fonctionnement ${fonctionnement ? M(fonctionnement) : '?'} · dette ${dette ? M(dette) : '?'} · 2023–2024 : ${comparaison.map(M).join(' / ')}`);
console.log('  ' + cats.map((c) => `${c.nom} ${M(c.depense)}`).join(' · '));
