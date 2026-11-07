// Scraper — les votes nominatifs (« recorded divisions ») de l'Assemblée du N.-B.
//
// IL N'Y A PAS D'AUTRE SOURCE. Le Nouveau-Brunswick ne publie aucun registre des votes :
// qui a voté quoi n'existe que dans le texte des Journaux quotidiens, en PDF. On les lit donc
// un par un. Les Journaux anglais servent de référence pour les noms (les deux versions
// donnent les mêmes, mais on n'en lit qu'une pour ne pas doubler les requêtes).
//
// LE CONTRÔLE QUI REND CE SCRAPER HONNÊTE : chaque bloc de vote annonce son total
// (« YEAS - 16 »), puis liste les noms. On compte les noms lus et on exige qu'ils soient
// exactement ce nombre. Au moindre écart, le vote n'est PAS publié et le scraper échoue :
// un vote nominatif à moitié lu attribuerait une position à quelqu'un qui ne l'a pas prise.
// Sur la session 61-2, les 24 votes passaient ce contrôle.
//
// Ce qu'il faut savoir du N.-B. :
//   - les votes sont RARES. Sur 51 projets de loi en 2025-2026, quatre seulement ont été
//     adoptés par un vote nominatif ; les autres l'ont été de vive voix. Le site doit donc
//     écrire « adopté sans vote nominal », jamais « unanime » ;
//   - la présidence ne vote pas : un vote ne dépasse jamais 48 voix sur 49 sièges ;
//   - un même nom de famille revient (deux Chiasson, deux Johnson, deux LeBlanc, deux
//     Wilson), d'où les initiales dans les Journaux (« Hon. Mr. K. Chiasson »). On garde la
//     graphie du Journal telle quelle : c'est la source, et le rapprochement avec la liste
//     des député·e·s se fait ailleurs, sous contrôle ;
//   - le chemin des Journaux a changé de session en session (« /journals/ » en 61-2,
//     « /journal/ » en 61-3). On lit donc les liens de la page, on ne fabrique jamais l'URL.
//
//   node scrapers/nb-votes.js            la session en cours
//   node scrapers/nb-votes.js 61 2       une session précise

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { load } from 'cheerio';
import pdf from 'pdf-parse';
import { lire, texte, normaliserChemin, ecrireJson, HOTE } from './nb-commun.js';

const SORTIE = 'data/votes.json';

/**
 * Extrait le texte d'un Journal. Deux lecteurs, dans cet ordre :
 *
 *   1. pdf-parse, qui vient avec le projet et n'exige rien du système ;
 *   2. pdftotext (poppler), en repli.
 *
 * POURQUOI DEUX : le Journal du 14 mai 2026 (39260514e.pdf) est refusé par pdf-parse
 * (« Invalid PDF structure ») alors que poppler le lit sans broncher. Ce Journal contient
 * deux votes nominatifs, dont un sur le projet de loi 45. Un lecteur unique nous les ferait
 * perdre en silence — et un vote manquant est une donnée fausse par omission.
 *
 * Si les deux échouent, on ne devine pas : le Journal est déclaré illisible, il est nommé
 * dans les données publiées, et le scraper sort en erreur pour que ça se voie.
 */
function extraireTexte(octets, nom) {
  return pdf(octets).then(
    ({ text }) => ({ text, lecteur: 'pdf-parse' }),
    (erreurPdfParse) => {
      let dossier;
      try {
        dossier = mkdtempSync(join(tmpdir(), 'nb-journal-'));
        const chemin = join(dossier, nom);
        writeFileSync(chemin, octets);
        const text = execFileSync('pdftotext', ['-q', '-enc', 'UTF-8', '-layout', chemin, '-'],
          { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
        return { text, lecteur: 'pdftotext' };
      } catch (erreurPoppler) {
        return {
          text: null,
          lecteur: null,
          pourquoi: `pdf-parse : ${erreurPdfParse.message} ; pdftotext : ${erreurPoppler.message.split('\n')[0]}`,
        };
      } finally {
        if (dossier) rmSync(dossier, { recursive: true, force: true });
      }
    },
  );
}

/** Le début d'un nom de votant : « Mr. », « Ms. », « Hon. Mr. »… */
const DEBUT_DE_NOM = /(?:Hon\.\s+)?(?:Mr|Ms|Mrs)\.\s+/g;

/**
 * Les en-têtes de page des Journaux, à ne pas confondre avec du contenu.
 *
 * On enlève la LIGNE entière, pas seulement les mots « Journal of Assembly ». Un en-tête
 * tombe au milieu d'une liste de votants — « Ms. Wilcott / October 29 Journal of Assembly 5 /
 * NAYS - 16 » —, et n'en retirer que le milieu laissait « Ms. Wilcott October » : un nom de
 * député avec un mois collé dessus.
 */
const EN_TETE = /\n?[^\n]*(?:Journal of Assembly|Journal de l'Assemblée)[^\n]*\n?|\d+\s+\d+-\d+\s+Charles\s+III/g;

/** Ce qui suit un titre sans être un votant : la présidence, le greffe. */
const PAS_UN_VOTANT = /^(?:Hon\.\s+)?(?:Mr|Ms|Mrs)\.\s+(?:Deputy|Speaker|Clerk|Madam)\b/;

/**
 * Découpe un bloc de noms. Les Journaux les disposent sur trois colonnes ; l'extraction du
 * PDF les met bout à bout, séparés par une seule espace — « Mr. Hogan Mr. Ames Mr. Cullins ».
 * On ne peut donc pas couper sur l'espace, et on ne peut pas non plus décrire un nom par une
 * seule expression : « Scott-Wallace », « M. LeBlanc » et « K. Chiasson » n'ont pas la même
 * forme, et un motif gourmand avale le titre du voisin.
 *
 * On repère donc les DÉBUTS de nom (le titre), et chaque nom est ce qui va d'un début au
 * suivant. C'est la structure du document qui découpe, pas une devinette sur les noms.
 */
function lireNoms(bloc) {
  const propre = bloc.replace(EN_TETE, ' ');
  const debuts = [...propre.matchAll(DEBUT_DE_NOM)];
  const noms = [];
  for (let i = 0; i < debuts.length; i++) {
    const depart = debuts[i].index;
    const arrivee = i + 1 < debuts.length ? debuts[i + 1].index : propre.length;
    const nom = propre
      .slice(depart, arrivee)
      .replace(/\s+/g, ' ')
      .replace(/[,;.]?\s*$/, '')
      .trim();
    // « Mr. Deputy Speaker put the question… », « Madam Speaker resumed the chair » : le
    // récit qui suit la liste commence par une fonction, pas par un votant. La présidence
    // ne vote pas, et le greffe non plus.
    if (PAS_UN_VOTANT.test(nom)) continue;
    // Un nom de votant, c'est le titre, une initiale au besoin, et UN nom de famille :
    // « Ms. S. Wilson », « Hon. Mr. D'Amours », « Ms. Scott-Wallace ». Pas davantage.
    //
    // La borne compte : le dernier nom d'une liste est suivi du récit du Journal, et une
    // forme gourmande avalait les mots capitalisés qui suivent. « Ms. S. Wilson Madam
    // Speaker » se faisait ainsi jeter comme présidence, et le compteur allait chercher un
    // nom plus bas pour compléter — il attribuait à quelqu'un un vote qu'il n'avait pas pris.
    const coupe = nom.match(/^((?:Hon\.\s+)?(?:Mr|Ms|Mrs)\.\s+(?:[A-ZÀ-Ÿ]\.\s+)?[A-ZÀ-Ÿ][\p{L}'’-]*)/u);
    if (!coupe || coupe[1].length <= 4) continue;
    noms.push(coupe[1].replace(/\s+/g, ' ').trim());
  }
  return noms;
}

/**
 * Trouve l'objet d'un vote dans le texte qui le précède : un projet de loi, une motion, ou
 * un amendement à l'un des deux. On ne devine rien — si le texte ne le dit pas, on l'écrit.
 */
function lireObjet(avant) {
  const fin = avant.slice(-700).replace(/\s+/g, ' ');
  const refs = [...fin.matchAll(/\b(Bill|Motion)\s+(\d+)/g)];
  const derniere = refs[refs.length - 1] || null;
  const surAmendement = /\b(sub-amendment|amendment)\b[^.]{0,80}$/i.test(fin)
    || /\bthe (sub-)?amendment was\b/i.test(fin);
  return {
    genre: derniere ? derniere[1].toLowerCase() : null,          // bill | motion | null
    numero: derniere ? Number(derniere[2]) : null,
    surAmendement,
    phrase: fin.slice(-260).trim(),   // la phrase du Journal, pour que le lecteur juge lui-même
  };
}

/** Tous les votes nominatifs d'un Journal. */
function lireVotes(texteDuJournal, journal) {
  const votes = [];
  const re = /YEAS\s*-\s*(\d+)([\s\S]*?)(?:NAYS\s*-\s*(\d+)([\s\S]*?))?(?=\n\s*\n\s*[A-Z]|$)/g;
  for (const m of texteDuJournal.matchAll(/YEAS\s*-\s*(\d+)/g)) {
    const debut = m.index;
    const nPour = Number(m[1]);

    // Le bloc du vote va de « YEAS » jusqu'à la reprise du récit. « NAYS - n » le coupe en deux.
    // Il s'arrête au vote suivant : sans cette borne, une liste à qui il manque un nom irait
    // le chercher dans la division d'après, et le compteur ne verrait rien passer.
    const brut = texteDuJournal.slice(debut + m[0].length, debut + 4000);
    const prochain = brut.search(/YEAS\s*-\s*\d+/);
    const suite = prochain > 0 ? brut.slice(0, prochain) : brut;
    const mNays = suite.match(/NAYS\s*-\s*(\d+)/);
    const blocPour = mNays ? suite.slice(0, mNays.index) : suite;
    const nContre = mNays ? Number(mNays[1]) : 0;
    const blocContre = mNays ? suite.slice(mNays.index + mNays[0].length) : '';

    const pour = lireNoms(blocPour).slice(0, nPour);
    // Un vote unanime n'a pas de bloc NAYS : on ne lit des noms « contre » que s'il y en a.
    const contre = nContre ? lireNoms(blocContre).slice(0, nContre) : [];

    if (pour.length !== nPour || contre.length !== nContre) {
      throw new Error(
        `${journal} : vote illisible — le Journal annonce ${nPour} pour et ${nContre} contre, `
        + `j'ai lu ${pour.length} et ${contre.length} noms. Rien n'est publié : un vote à moitié lu `
        + `ferait dire à des député·e·s le contraire de ce qu'ils ont voté.`
      );
    }

    votes.push({
      objet: lireObjet(texteDuJournal.slice(0, debut)),
      pour: { total: nPour, noms: pour },
      contre: { total: nContre, noms: contre },
      votants: nPour + nContre,
    });
  }
  return votes;
}

/** Les Journaux de la session, lus sur la page qui les liste (jamais une URL fabriquée). */
async function journauxDeLaSession(leg, ses) {
  const html = await lire(`/en/house-business/journals/${leg}/${ses}`);
  const $ = load(html);
  const vus = new Set();
  const journaux = [];
  $('a[href]').each((_, el) => {
    const href = normaliserChemin($(el).attr('href'));
    // Les Journaux anglais de CETTE session : le « e » final est la langue.
    if (!new RegExp(`/house_business/${leg}/${ses}/journals?/[^/]+e\\.pdf$`, 'i').test(href)) return;
    if (vus.has(href)) return;
    vus.add(href);
    journaux.push({ fichier: href.split('/').pop(), url: href.startsWith('http') ? href : HOTE + href });
  });
  return journaux.sort((a, b) => a.fichier.localeCompare(b.fichier));
}

/** « 31260326e.pdf » -> 2026-03-26 (numéro de séance, puis aammjj). */
function dateDuJournal(fichier) {
  const m = fichier.match(/^(\d{2})(\d{2})(\d{2})(\d{2})[ef]\.pdf$/i);
  if (!m) return { seance: null, date: null };
  return { seance: Number(m[1]), date: `20${m[2]}-${m[3]}-${m[4]}` };
}

/**
 * La session en cours, lue sur les CHEMINS DES FICHIERS et non sur les liens de session : la
 * page des Journaux affiche la session courante directement, sans se lier elle-même — en
 * novembre 2026, ses liens de session s'arrêtaient à 61-2 alors qu'elle listait les Journaux
 * de 61-3. Les chemins des PDF, eux, portent toujours la bonne session.
 */
async function sessionEnCours() {
  const html = normaliserChemin(await lire('/en/house-business/journals'));
  const paires = [...html.matchAll(/\/house_business\/(\d+)\/(\d+)\/journals?\//g)]
    .map((m) => ({ leg: Number(m[1]), ses: Number(m[2]) }));
  if (!paires.length) throw new Error('aucun Journal trouvé sur la page des Journaux');
  paires.sort((a, b) => b.leg - a.leg || b.ses - a.ses);
  return paires[0];
}

async function main() {
  const [argLeg, argSes] = process.argv.slice(2).map(Number);
  const { leg, ses } = argLeg && argSes ? { leg: argLeg, ses: argSes } : await sessionEnCours();
  console.log(`Votes nominatifs — ${leg}e législature, ${ses}e session`);

  const journaux = await journauxDeLaSession(leg, ses);
  if (!journaux.length) throw new Error(`aucun Journal trouvé pour la session ${leg}-${ses}`);
  console.log(`${journaux.length} Journaux à lire, un toutes les dix secondes`);

  const votes = [];
  const illisibles = [];
  for (const j of journaux) {
    const octets = await lire(j.url, { binaire: true });
    const { seance, date } = dateDuJournal(j.fichier);
    const { text, lecteur, pourquoi } = await extraireTexte(octets, j.fichier);

    if (!text) {
      // On n'arrête pas tout pour un PDF cassé, mais on ne fait pas semblant non plus :
      // le Journal est nommé dans les données et le scraper finira en erreur.
      illisibles.push({ fichier: j.fichier, seance, date, url: j.url, pourquoi });
      console.error(`  ${j.fichier}  séance ${String(seance ?? '?').padStart(2)}  ILLISIBLE`);
      continue;
    }

    const trouves = lireVotes(text, j.fichier);
    for (const v of trouves) {
      votes.push({ legislature: leg, session: ses, seance, date, journal: j.url, ...v });
    }
    const note = lecteur === 'pdftotext' ? '  (lu par pdftotext, pdf-parse l\'a refusé)' : '';
    console.log(`  ${j.fichier}  séance ${String(seance ?? '?').padStart(2)}  ${date ?? '?'}  ${trouves.length} vote(s)${note}`);
  }

  const surProjets = votes.filter((v) => v.objet.genre === 'bill' && !v.objet.surAmendement);
  console.log(`\n${votes.length} votes nominatifs, dont ${surProjets.length} sur une étape d'un projet de loi`);
  const maxVotants = Math.max(0, ...votes.map((v) => v.votants));
  if (maxVotants > 48) {
    throw new Error(`un vote compte ${maxVotants} votant·e·s : impossible, la présidence ne vote pas (48 au plus)`);
  }

  ecrireJson(SORTIE, {
    legislature: leg,
    session: ses,
    luLe: new Date().toISOString(),
    source: `${HOTE}/en/house-business/journals/${leg}/${ses}`,
    note: 'Les votes nominatifs sont rares au Nouveau-Brunswick : la plupart des projets de loi '
      + 'sont adoptés de vive voix, sans que les positions individuelles soient consignées. '
      + 'L\'absence de vote nominatif ne veut donc pas dire « unanime ».',
    noms: 'Les noms sont écrits comme le Journal les écrit, initiale comprise (plusieurs '
      + 'député·e·s partagent un nom de famille).',
    journauxLus: journaux.length - illisibles.length,
    journauxIllisibles: illisibles,
    votes,
  });

  if (illisibles.length) {
    throw new Error(
      `${illisibles.length} Journal(aux) illisible(s) : ${illisibles.map((j) => j.fichier).join(', ')}.\n`
      + 'Les votes qu\'ils contiennent manquent aux données, qui le déclarent. '
      + 'Installer poppler (pdftotext) règle le cas le plus courant.'
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
