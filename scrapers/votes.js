// Scraper — les votes nominatifs (« recorded divisions ») de la législature en cours, au format de
// DossierQuébec (data/votes.json : un vote = pour / contre / abstentions, chaque votant par son
// identifiant de fiche).
//
// IL N'Y A PAS D'AUTRE SOURCE. Le Nouveau-Brunswick ne publie aucun registre des votes : qui a voté
// quoi n'existe que dans les Journaux quotidiens, en PDF. On les lit un par un (anglais), au rythme
// du robots.txt. Les Journaux déjà lus ne changent plus : on garde leur lecture d'un passage à
// l'autre (data/votes-journaux.json) et on ne télécharge que les nouveaux.
//
// LE CONTRÔLE QUI REND CE SCRAPER HONNÊTE : chaque bloc annonce son total (« YEAS - 16 »), puis
// liste les noms. Un vote n'est publié que si (1) le nombre de noms lus égale le total annoncé et
// (2) chaque nom se rattache à UNE seule personne de la liste des député·e·s. Sinon il est compté
// et nommé dans le journal du travail, jamais affiché à moitié : un vote mal lu ferait dire à
// quelqu'un le contraire de ce qu'il a voté.
//
// Ce qu'il faut savoir du N.-B. :
//   - les votes nominatifs sont RARES : la plupart des projets passent de vive voix. L'absence de
//     vote nominatif ne veut pas dire « unanime » ;
//   - la présidence ne vote pas ;
//   - des noms de famille reviennent (deux Chiasson, deux LeBlanc…), d'où les initiales dans les
//     Journaux (« Hon. Mr. K. Chiasson ») : le rattachement se fait sur le nom ET l'initiale ;
//   - le dossier des Journaux a changé de nom d'une session à l'autre (journals/ en 61-2, journal/
//     en 61-3) : on lit les liens de la page, on ne fabrique jamais l'adresse.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { lire, lirePage, absolue, plierNom, HOTE } from './nb-commun.js';

const OUT_PATH = 'data/votes.json';
const CACHE_PATH = 'data/votes-journaux.json';

// --- Lecture d'un Journal ---------------------------------------------------------------------
// pdf-parse d'abord ; pdftotext (poppler) en repli : le Journal du 14 mai 2026 est refusé par
// pdf-parse (« Invalid PDF structure ») et contient deux votes nominatifs.
async function extraireTexte(octets, nom) {
  try {
    return (await pdf(octets)).text;
  } catch (e1) {
    let dossier;
    try {
      dossier = mkdtempSync(join(tmpdir(), 'nb-journal-'));
      writeFileSync(join(dossier, nom), octets);
      return execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', '-layout', join(dossier, nom), '-'], { encoding: 'utf8', maxBuffer: 32 << 20 });
    } catch (e2) {
      return null;
    } finally {
      if (dossier) rmSync(dossier, { recursive: true, force: true });
    }
  }
}

const DEBUT_DE_NOM = /(?:Hon\.\s+)?(?:Mr|Ms|Mrs)\.\s+/g;
// L'en-tête de page tombe parfois au milieu d'une liste : on retire la LIGNE entière.
const EN_TETE = /\n?[^\n]*(?:Journal of Assembly|Journal de l'Assemblée)[^\n]*\n?|\d+\s+\d+-\d+\s+Charles\s+III/g;
const PAS_UN_VOTANT = /^(?:Hon\.\s+)?(?:Mr|Ms|Mrs)\.\s+(?:Deputy|Speaker|Clerk|Madam)\b/;

/** Les noms d'un bloc, découpés sur les titres (Mr., Ms., Hon.) : c'est la structure qui coupe. */
function lireNoms(bloc) {
  const propre = bloc.replace(EN_TETE, ' ');
  const debuts = [...propre.matchAll(DEBUT_DE_NOM)];
  const noms = [];
  for (let i = 0; i < debuts.length; i++) {
    const nom = propre.slice(debuts[i].index, i + 1 < debuts.length ? debuts[i + 1].index : propre.length)
      .replace(/\s+/g, ' ').replace(/[,;.]?\s*$/, '').trim();
    if (PAS_UN_VOTANT.test(nom)) continue;
    // Le titre, une initiale au besoin, et UN nom de famille — pas davantage, sinon le récit qui
    // suit la liste se colle au dernier nom.
    const coupe = nom.match(/^((?:Hon\.\s+)?(?:Mr|Ms|Mrs)\.\s+(?:[A-ZÀ-Ý]\.\s+)?[A-ZÀ-Ý][\p{L}'’-]*)/u);
    if (!coupe || coupe[1].length <= 4) continue;
    noms.push(coupe[1].replace(/\s+/g, ' ').trim());
  }
  return noms;
}

/** L'objet du vote, dans le texte qui le précède. On ne devine rien. */
function lireObjet(avant) {
  const fin = avant.slice(-900).replace(/\s+/g, ' ');
  return { ...objetDeLaPhrase(fin.slice(-320)), phrase: fin.slice(-320).trim() };
}

/**
 * L'étape et le projet, lus dans la SEULE phrase qui annonce le vote (« …the question being put
 * that Bill 2 be now read a third time, it was resolved… on the following recorded division: »).
 * Chercher plus haut dans le texte attrapait le projet ou l'amendement du paragraphe précédent :
 * un vote sur la « Motion 11 » se retrouvait rattaché au projet 7. Pas de numéro de projet dans
 * cette phrase : le vote n'est rattaché à aucun projet (on ne devine pas).
 */
function objetDeLaPhrase(texte) {
  const morceaux = String(texte).replace(/\s+/g, ' ').split(/\.\s+(?=[A-Z])/);
  const derniere = morceaux[morceaux.length - 1] || '';
  const bill = Number((derniere.match(/\bBill\s+(\d+)\b/) || [])[1]) || null;
  const etape = /read a third time|third reading/i.test(derniere) ? 'troisieme'
    : /read a second time|second reading/i.test(derniere) ? 'deuxieme'
      : /sub-?\s?amendment/i.test(derniere) ? 'sous-amendement'
        : /\bamendment\b/i.test(derniere) ? 'amendement'
          : 'motion';
  return { bill, etape };
}

function lireVotes(texte) {
  const votes = [];
  for (const m of texte.matchAll(/YEAS\s*-\s*(\d+)/g)) {
    const nPour = Number(m[1]);
    const brut = texte.slice(m.index + m[0].length, m.index + 4000);
    const prochain = brut.search(/YEAS\s*-\s*\d+/);
    const suite = prochain > 0 ? brut.slice(0, prochain) : brut;
    const mNays = suite.match(/NAYS\s*-\s*(\d+)/);
    const nContre = mNays ? Number(mNays[1]) : 0;
    const pour = lireNoms(mNays ? suite.slice(0, mNays.index) : suite).slice(0, nPour);
    const contre = nContre ? lireNoms(suite.slice(mNays.index + mNays[0].length)).slice(0, nContre) : [];
    votes.push({ objet: lireObjet(texte.slice(0, m.index)), annonce: { pour: nPour, contre: nContre }, pour, contre });
  }
  return votes;
}

// --- Rattachement des noms aux député·e·s -------------------------------------------------------
function rattacheur(deputes) {
  const fiches = deputes.map((d) => {
    const [famille, ...prenoms] = d.officiel.split(',').map((s) => s.trim());
    return { d, famille: plierNom(famille), initiale: plierNom(prenoms.filter((p) => !/^([A-Z]\.)+$/i.test(p)).join(' ')).charAt(0) };
  });
  return (nom) => {
    const m = nom.match(/(?:Mr|Ms|Mrs)\.\s+(?:([A-ZÀ-Ý])\.\s+)?(.+)$/u);
    if (!m) return null;
    const initiale = m[1] ? plierNom(m[1]) : null;
    const famille = plierNom(m[2]);
    const candidats = fiches.filter((f) => f.famille === famille || f.famille.split(' ').pop() === famille);
    const retenus = initiale ? candidats.filter((f) => f.initiale === initiale) : candidats;
    return retenus.length === 1 ? retenus[0].d : null;
  };
}

// --- Les Journaux de la législature -------------------------------------------------------------
async function journaux(leg) {
  const liste = new Map();
  const ajouter = ($) => $('a[href]').each((_, a) => {
    const href = absolue($(a).attr('href'));
    const m = href.match(new RegExp(`/house_business/${leg}/(\\d+)/journals?/((\\d{2})(\\d{2})(\\d{2})(\\d{2})e\\.pdf)$`, 'i'));
    if (m) liste.set(href, { url: href, session: Number(m[1]), fichier: m[2], seance: Number(m[3]), date: `20${m[4]}-${m[5]}-${m[6]}` });
  });
  // La page générale montre la session en cours ; ses liens mènent aux sessions précédentes.
  const $ = await lirePage('/en/house-business/journals');
  ajouter($);
  const sessions = new Set();
  $('a[href]').each((_, a) => {
    const m = String($(a).attr('href')).match(new RegExp(`/en/house-business/journals/${leg}/(\\d+)$`));
    if (m) sessions.add(Number(m[1]));
  });
  for (const s of [...sessions].sort()) ajouter(await lirePage(`/en/house-business/journals/${leg}/${s}`));
  return [...liste.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const ETAPES = {
  deuxieme: 'Deuxième lecture',
  troisieme: 'Troisième lecture',
  amendement: 'Amendement',
  'sous-amendement': 'Sous-amendement',
  motion: 'Motion',
};

async function main() {
  const { deputes } = JSON.parse(readFileSync('data/deputes.json', 'utf-8'));
  const { bills, legislature: leg } = JSON.parse(readFileSync('data/bills.json', 'utf-8'));
  const trouver = rattacheur(deputes);
  const billDe = (ses, num) => bills.find((b) => b.introSession === ses && b.num === num) || null;

  const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, 'utf-8')) : { journaux: {} };
  const liste = await journaux(leg);
  if (!liste.length) throw new Error(`aucun Journal trouvé pour la ${leg}e législature`);
  console.log(`${liste.length} Journaux de la ${leg}e législature (${liste.filter((j) => !cache.journaux[j.url]).length} nouveaux, lus un toutes les dix secondes)`);

  const illisibles = [];
  for (const j of liste) {
    if (cache.journaux[j.url]) continue;
    const texte = await extraireTexte(await lire(j.url, { binaire: true }), j.fichier);
    if (!texte) { illisibles.push(j.fichier); console.error(`  ${j.fichier} ILLISIBLE`); continue; }
    cache.journaux[j.url] = { ...j, votes: lireVotes(texte) };
    console.log(`  ${j.fichier}  séance ${String(j.seance).padStart(2)}  ${j.date}  ${cache.journaux[j.url].votes.length} vote(s)`);
  }
  writeFileSync(CACHE_PATH, JSON.stringify(cache) + '\n');

  const votes = [];
  const rejetes = [];
  const numParSession = {};
  for (const j of Object.values(cache.journaux).sort((a, b) => a.date.localeCompare(b.date))) {
    for (const v of j.votes) {
      const raisons = [];
      if (v.pour.length !== v.annonce.pour || v.contre.length !== v.annonce.contre) {
        raisons.push(`annonce ${v.annonce.pour} pour / ${v.annonce.contre} contre, lu ${v.pour.length} / ${v.contre.length}`);
      }
      const camp = (noms) => noms.map((n) => {
        const d = trouver(n);
        if (!d) raisons.push(`« ${n} » ne se rattache à personne (ou à plusieurs)`);
        return d && { assnatId: d.assnatId, lastName: d.officiel.split(',')[0], riding: null, party: d.party };
      });
      const pour = camp(v.pour);
      const contre = camp(v.contre);
      if (raisons.length) { rejetes.push(`${j.fichier} : ${raisons.join(' ; ')}`); continue; }

      numParSession[j.session] = (numParSession[j.session] || 0) + 1;
      // L'objet est relu dans la phrase gardée en cache : une correction de la lecture s'applique
      // sans retélécharger les Journaux.
      v.objet = { ...v.objet, ...objetDeLaPhrase(v.objet.phrase) };
      const bill = v.objet.bill ? billDe(j.session, v.objet.bill) : null;
      const stage = ETAPES[v.objet.etape];
      // Le sujet porte le titre officiel du projet : build-votes-data.js le rapproche par le titre.
      const subject = bill ? `Projet de loi ${bill.num}, ${bill.title}` : v.objet.phrase;
      votes.push({
        legislature: leg,
        session: j.session,
        num: numParSession[j.session],
        url: j.url,
        date: j.date,
        title: `${stage} – ${subject}`,
        stage,
        subject,
        subjectEn: bill ? `Bill ${bill.num}, ${bill.titleEn}` : v.objet.phrase,
        extrait: v.objet.phrase,
        billNum: bill ? bill.num : (v.objet.bill ?? null),
        totals: { pour: pour.length, contre: contre.length, abstentions: null },
        pour,
        contre,
        // Le Journal ne consigne pas d'abstention : qui ne vote pas n'apparaît simplement pas.
        abstentions: [],
      });
    }
  }

  writeFileSync(OUT_PATH, JSON.stringify({
    legislature: leg,
    source: `${HOTE}/en/house-business/journals`,
    scrapedAt: new Date().toISOString(),
    note: 'Votes nominatifs lus dans les Journaux de l\'Assemblée législative du Nouveau-Brunswick. La plupart des projets de loi y sont adoptés de vive voix : l\'absence de vote nominatif ne veut pas dire « unanime ».',
    journauxLus: Object.keys(cache.journaux).length,
    journauxIllisibles: illisibles,
    votesNonPublies: rejetes,
    count: votes.length,
    votes,
  }, null, 1) + '\n');

  console.log(`${votes.length} votes nominatifs écrits dans ${OUT_PATH} — ${votes.filter((v) => v.billNum).length} sur un projet de loi`);
  if (rejetes.length) { console.log(`  ⚠ ${rejetes.length} vote(s) NON publié(s) :`); for (const r of rejetes) console.log(`    ${r}`); }
  if (illisibles.length) { console.error(`  ✗ Journaux illisibles : ${illisibles.join(', ')}`); process.exitCode = 1; }
}

main().catch((err) => {
  console.error('Échec du scraper votes.js :', err.message);
  process.exitCode = 1;
});
