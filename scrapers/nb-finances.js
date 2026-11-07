// Scraper — les dépenses payées aux député·e·s de l'Assemblée du N.-B.
//
// L'Assemblée publie chaque exercice financier deux tableaux, en PDF bilingue :
//
//   1. « Members Expenses / Frais des députés » — indemnité de session, kilométrage, tarifs
//      aériens, comités, conférences, déplacements, orientation professionnelle, et le total ;
//   2. « Constituency / Circonscription » — le budget de bureau de circonscription.
//
// LE CONTRÔLE QUI REND CE SCRAPER HONNÊTE : le premier tableau publie SON PROPRE total par
// personne. On additionne les huit colonnes et on exige qu'elles retombent dessus. Au moindre
// écart, le scraper échoue et rien n'est publié — un chiffre d'argent mal lu, placé sous le
// nom de quelqu'un, est pire que pas de chiffre du tout.
//
// CE QUE CES CHIFFRES NE SONT PAS : un salaire. L'indemnité de session est une partie de la
// rémunération ; le reste est du remboursement de frais (kilométrage, avion, comités) et le
// budget de circonscription paie un bureau et son personnel, pas la personne. La page le dit.
//
// L'EXERCICE NE SUIT PAS LA LÉGISLATURE. Un exercice commence le 1er avril : celui de
// 2025-2026 contient des personnes qui ne siègent plus. On publie ce que le tableau dit, et
// on ne rattache à une fiche que les personnes qui siègent aujourd'hui.
//
//   node scrapers/nb-finances.js

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'cheerio';
import pdf from 'pdf-parse';
import { lire, normaliserChemin, separerNom, ecrireJson, existe, HOTE } from './nb-commun.js';

const SORTIE = 'data/finances.json';
const PAGE = '/en/members/expenses';

/** Les colonnes du tableau des frais, dans l'ordre où le PDF les imprime. */
const COLONNES = [
  ['session', 'Indemnité de session', 'Sessional allowance'],
  ['kilometrage', 'Indemnité de kilométrage', 'Kilometric allowance'],
  ['avion', 'Tarifs aériens', 'Air fare'],
  ['comitesIndemnite', 'Indemnité des membres de comités', 'Committee allowance'],
  ['comitesAllocation', 'Allocation des membres de comités', 'Committee indemnity'],
  ['conferences', 'Frais de conférence et autres frais', 'Conference and other expenses'],
  ['deplacements', 'Indemnité de déplacement', 'Travel trip allowance'],
  ['orientation', 'Services d\'orientation professionnelle et recyclage', 'Career counselling and training'],
];

/** Deux lecteurs de PDF, comme pour les Journaux : pdf-parse, puis poppler en repli. */
function extraireTexte(octets, nom) {
  return pdf(octets).then(
    ({ text }) => text,
    () => {
      let dossier;
      try {
        dossier = mkdtempSync(join(tmpdir(), 'nb-finances-'));
        const chemin = join(dossier, nom);
        writeFileSync(chemin, octets);
        return execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', chemin, '-'],
          { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
      } catch {
        return null;
      } finally {
        if (dossier) rmSync(dossier, { recursive: true, force: true });
      }
    },
  );
}

/** « 2,192 » → 2192 ; « - » → 0. */
const montant = (s) => {
  const net = String(s).trim();
  if (!net || net === '-' || net === '–') return 0;
  const n = Number(net.replace(/[,\s$]/g, ''));
  if (!Number.isFinite(n)) throw new Error(`montant illisible : « ${s} »`);
  return n;
};

/** « Chiasson, Hon./l'hon. Keith » → { famille: 'Chiasson', prenom: 'Keith' } */
function separer(nomDuTableau) {
  const net = String(nomDuTableau).replace(/\s+/g, ' ').trim();
  const m = net.match(/^([^,]+),\s*(?:Hon\.\/l'hon\.|Hon\.|l'hon\.)?\s*(.+)$/);
  if (!m) return null;
  return { famille: m[1].trim(), prenom: m[2].trim(), tel_quel: net };
}

/**
 * Le tableau des frais : une personne, huit colonnes, un total. On coupe sur les débuts de
 * ligne — « Famille, Prénom » suivi de neuf montants — plutôt que sur les sauts de ligne,
 * que l'extraction du PDF place où elle veut.
 */
function lireFrais(texte) {
  const nombre = String.raw`(?:-|–|[\d,]+)`;
  const re = new RegExp(
    String.raw`([A-ZÀ-ÿ][^\n,]{1,40}),\s*((?:Hon\.\/l'hon\.\s*)?[^\n\d]{1,40}?)\s*\n` +
    Array.from({ length: 9 }, () => String.raw`\s*(${nombre})\s*`).join('\n'),
    'g',
  );
  const lignes = [];
  for (const m of texte.matchAll(re)) {
    const nom = separer(`${m[1]}, ${m[2]}`);
    if (!nom) continue;
    const valeurs = m.slice(3, 11).map(montant);
    const total = montant(m[11]);
    const somme = valeurs.reduce((a, b) => a + b, 0);

    // Le contrôle : les huit colonnes doivent faire le total que le PDF imprime.
    // Un dollar d'écart est toléré — le tableau est arrondi à l'unité.
    if (Math.abs(somme - total) > 1) {
      throw new Error(
        `${nom.tel_quel} : les colonnes font ${somme} $ et le tableau annonce ${total} $. `
        + 'Rien n\'est publié : une colonne mal lue sous le nom de quelqu\'un est pire que pas de chiffre.',
      );
    }

    const frais = {};
    COLONNES.forEach(([cle], i) => { frais[cle] = valeurs[i]; });
    lignes.push({ ...nom, frais, total });
  }
  return lignes;
}

/** Le tableau des bureaux de circonscription : une personne, un montant. */
function lireCirconscription(texte) {
  const re = /([A-ZÀ-ÿ][^\n,]{1,40}),\s*((?:Hon\.\/l'hon\.\s*)?[^\n\d]{1,40}?)\s*\n\s*([\d,]+)\s*/g;
  const lignes = [];
  for (const m of texte.matchAll(re)) {
    const nom = separer(`${m[1]}, ${m[2]}`);
    if (nom) lignes.push({ ...nom, bureau: montant(m[3]) });
  }
  return lignes;
}

/** Les deux tableaux annuels de l'exercice le plus récent, lus sur la page, jamais fabriqués. */
function liensAnnuels($) {
  const liens = [...new Set($('a[href]').map((_, a) => normaliserChemin($(a).attr('href'))).get())]
    .filter((u) => /\/members\/expenses\//i.test(u) && u.endsWith('.pdf'));

  // Les trimestriels commencent par Q1…Q4 : on ne garde que les annuels.
  const annuels = liens.filter((u) => !/\/Q[1-4][-_]/i.test(u));
  const exercice = (u) => (u.match(/(\d{4})-(\d{4})/) || [])[0] || '';
  const recent = annuels.map(exercice).sort().pop();
  if (!recent) throw new Error('aucun tableau annuel de dépenses trouvé sur la page.');

  const deCetExercice = annuels.filter((u) => exercice(u) === recent);
  const frais = deCetExercice.find((u) => /MembersExpenses|FraisDeputes/i.test(u));
  const bureaux = deCetExercice.find((u) => /Constituency|Circonscription/i.test(u));
  if (!frais || !bureaux) {
    throw new Error(`exercice ${recent} : il manque un des deux tableaux annuels (frais ou circonscription).`);
  }
  return { exercice: recent, frais: HOTE + frais, bureaux: HOTE + bureaux };
}

/** Rattache une ligne du tableau à une personne qui siège, ou à personne. */
function rattacher(ligne, deputes) {
  const net = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z]/g, '');
  const famille = net(ligne.famille);
  const prenom = net(ligne.prenom);

  const candidats = deputes.filter((d) => net(String(d.nomOfficiel || '').split(',')[0]) === famille);
  if (!candidats.length) return null;

  // « McKee, Rob » dans le tableau, « McKee, K.C., Robert » dans la liste : un prénom qui
  // commence l'autre suffit, et le titre professionnel doit sortir avant la comparaison,
  // sinon on compare « rob » à « kcrobert ». Deux personnes du même nom de famille gardent
  // leur prénom complet dans le tableau, donc elles se départagent.
  const exact = candidats.filter((d) => {
    const famillePropre = String(d.nomOfficiel || '').split(',')[0];
    const p = net(separerNom(d.nomOfficiel).nomAffiche.replace(famillePropre, ''));
    return p.startsWith(prenom) || prenom.startsWith(p);
  });
  return exact.length === 1 ? exact[0].nomAffiche : null;
}

async function main() {
  if (!existe('data/deputes.json')) {
    throw new Error('data/deputes.json manque — lancer scrapers/nb-deputes.js d\'abord.');
  }
  const { deputes } = JSON.parse(readFileSync('data/deputes.json', 'utf8'));

  const $ = load(await lire(PAGE));
  const { exercice, frais, bureaux } = liensAnnuels($);
  console.log(`Dépenses payées aux député·e·s — exercice ${exercice}`);

  const texteFrais = await extraireTexte(await lire(frais, { binaire: true }), 'frais.pdf');
  if (!texteFrais) throw new Error(`${frais} : PDF illisible par les deux lecteurs.`);
  const lignesFrais = lireFrais(texteFrais);
  console.log(`  frais : ${lignesFrais.length} personnes, toutes vérifiées contre leur total`);

  const texteBureaux = await extraireTexte(await lire(bureaux, { binaire: true }), 'bureaux.pdf');
  if (!texteBureaux) throw new Error(`${bureaux} : PDF illisible par les deux lecteurs.`);
  const lignesBureaux = lireCirconscription(texteBureaux);
  console.log(`  bureaux de circonscription : ${lignesBureaux.length} personnes`);

  if (!lignesFrais.length || !lignesBureaux.length) {
    throw new Error('un des deux tableaux n\'a donné aucune ligne — le gabarit du PDF a changé.');
  }

  // On réunit les deux tableaux par personne, puis on rattache à qui siège aujourd'hui.
  const parNom = new Map();
  for (const l of lignesFrais) parNom.set(l.tel_quel, { ...l });
  for (const l of lignesBureaux) {
    const dejaLa = [...parNom.values()].find((x) => x.famille === l.famille && x.prenom.startsWith(l.prenom.slice(0, 3)));
    if (dejaLa) dejaLa.bureau = l.bureau;
    else parNom.set(l.tel_quel, { ...l });
  }

  const personnes = [...parNom.values()].map((p) => ({
    nomDuTableau: p.tel_quel,
    siege: rattacher(p, deputes),
    frais: p.frais || null,
    total: p.total ?? null,
    bureau: p.bureau ?? null,
  })).sort((a, b) => a.nomDuTableau.localeCompare(b.nomDuTableau, 'fr'));

  const rattachees = personnes.filter((p) => p.siege).length;
  console.log(`\n${personnes.length} personnes au tableau, dont ${rattachees} siègent aujourd'hui`);

  ecrireJson(SORTIE, {
    luLe: new Date().toISOString(),
    exercice,
    source: HOTE + PAGE,
    documents: { frais, bureaux },
    colonnes: COLONNES.map(([cle, fr, en]) => ({ cle, fr, en })),
    personnes,
  });
}

main().catch((e) => { console.error(e.message); process.exit(1); });
