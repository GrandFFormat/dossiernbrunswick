// Ce que les scrapers du Nouveau-Brunswick partagent.
//
// Règle n° 1 : jamais de donnée inventée, jamais de protection contournée. Le robot se présente
// pour ce qu'il est (USER_AGENT). Un 403, un 404 ou un défi anti-robot est une réponse : lire()
// lève une erreur, le scraper s'arrête sans écrire et les données de la veille restent.
//
// legnb.ca demande « crawl-delay: 10 » dans son robots.txt (lu le 7 nov. 2026, rien d'interdit
// par ailleurs). Toutes les lectures passent donc par lire(), qui les met en file et attend dix
// secondes entre deux. Avant la première lecture d'un domaine, son robots.txt est lu, et toute
// adresse qu'il interdit est refusée dans le code : une erreur de programmation ne peut pas le
// violer en silence. Une seule reprise, et seulement pour une panne réseau passagère.

import { load } from 'cheerio';

export const USER_AGENT =
  'dossier-nouveau-brunswick-scraper/0.1 (projet citoyen independant, usage non commercial; +https://dossiernbrunswick.ca)';
export const HOTE = 'https://www.legnb.ca';
const DELAI_MS = 10_000;

const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
let derniere = 0;
let file = Promise.resolve();

// --- Le garde-fou robots.txt ----------------------------------------------------------------
const robots = new Map();   // origine → { interdits: [préfixes], delai }
async function reglesDe(origine) {
  if (robots.has(origine)) return robots.get(origine);
  const res = await fetch(`${origine}/robots.txt`, { headers: { 'User-Agent': USER_AGENT } });
  const regles = { interdits: [], delai: DELAI_MS };
  if (res.ok) {
    let pourNous = false;
    for (const brut of (await res.text()).split(/\r?\n/)) {
      const ligne = brut.replace(/#.*/, '').trim();
      const [cle, ...reste] = ligne.split(':');
      const val = reste.join(':').trim();
      if (/^user-agent$/i.test(cle)) pourNous = val === '*' || /dossier/i.test(val);
      else if (pourNous && /^disallow$/i.test(cle) && val) regles.interdits.push(val);
      else if (pourNous && /^crawl-delay$/i.test(cle) && Number(val)) regles.delai = Math.max(DELAI_MS, Number(val) * 1000);
    }
  }
  robots.set(origine, regles);
  return regles;
}

function interdit(regles, chemin) {
  return regles.interdits.some((motif) => {
    const re = new RegExp('^' + motif.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$'));
    return re.test(chemin);
  });
}

/**
 * Lit une adresse de legnb.ca (ou d'un autre domaine permis), en file, au rythme demandé.
 * @param {string} chemin  chemin absolu sur legnb.ca, ou adresse complète
 * @param {{ binaire?: boolean }} options
 */
export function lire(chemin, options = {}) {
  const url = new URL(chemin.startsWith('http') ? chemin : HOTE + chemin);
  const tache = file.then(async () => {
    const regles = await reglesDe(url.origin);
    if (interdit(regles, url.pathname + url.search)) {
      throw new Error(`${url} : interdit par le robots.txt de ${url.host} — on ne le lit pas`);
    }
    const attente = regles.delai - (Date.now() - derniere);
    if (attente > 0) await dormir(attente);
    let res;
    for (let essai = 1; ; essai++) {
      derniere = Date.now();
      try {
        res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, redirect: 'follow' });
        break;
      } catch (e) {
        if (essai > 1) throw new Error(`${url} : ${e.message}`);
        await dormir(regles.delai);
      }
    }
    const octets = Buffer.from(await res.arrayBuffer());
    const debut = octets.subarray(0, 4000).toString('latin1');
    const defi = Boolean(res.headers.get('cf-mitigated')) || /Just a moment\.\.\.|cf-chl|challenge-platform|Attention Required/i.test(debut);
    if (!res.ok || defi) {
      throw new Error(`${url} : HTTP ${res.status}${defi ? ' (défi anti-robot — on ne le contourne pas)' : ''}`);
    }
    if (options.binaire) return octets;
    // Les textes des projets de loi sont en ISO-8859-1 ; les pages du site en UTF-8. On suit ce
    // que la réponse déclare.
    const latin = /charset=(iso-8859-1|windows-1252)/i.test(res.headers.get('content-type') || '')
      || /charset=["']?(iso-8859-1|windows-1252)/i.test(debut);
    return octets.toString(latin ? 'latin1' : 'utf8');
  });
  file = tache.catch(() => {});
  return tache;
}

export const lirePage = async (chemin) => load(await lire(chemin));

/** Texte lisible d'un bout de HTML : une seule espace, entités résolues. */
export function texte(html) {
  return String(html ?? '')
    .replace(/<sup>([\s\S]*?)<\/sup>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Les liens de legnb.ca utilisent parfois des antislashs (/content/house_business\61\3\...). */
export const normaliserChemin = (href) => String(href ?? '').split('\\').join('/');
export const absolue = (href) => {
  const h = normaliserChemin(href);
  return !h ? null : h.startsWith('http') ? h : HOTE + (h.startsWith('/') ? '' : '/') + h;
};

/**
 * Les dates de legnb.ca s'écrivent m/j/aaaa en anglais et jj/mm/aaaa en français : « 11/4/2026 »
 * vaut le 4 novembre d'un côté et le 11 avril de l'autre. On ne lit les dates que sur les pages
 * anglaises.
 */
export function dateAnglaise(s) {
  const m = String(s ?? '').match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!m) return null;
  const [, mois, jour, annee] = m;
  if (+mois < 1 || +mois > 12 || +jour < 1 || +jour > 31) return null;
  return `${annee}-${mois.padStart(2, '0')}-${jour.padStart(2, '0')}`;
}

/** Même logique que norm() côté page : sans accents, casse ni tirets. */
export function plierNom(nom) {
  return (nom || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[-–—'’.]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Les titres professionnels que l'Assemblée intercale dans un nom (« McKee, K.C., Robert »). */
const TITRES = /^(K\.C\.|Q\.C\.|C\.M\.|O\.C\.|M\.D\.|Ph\.D\.|LL\.D\.|Dr\.?)$/i;

/** « Holt, Susan » → « Susan Holt » ; « McKee, K.C., Robert » → « Robert McKee ». */
export function nomCourant(officiel) {
  const morceaux = String(officiel ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (morceaux.length < 2) return String(officiel ?? '').replace(/\s+/g, ' ').trim();
  const prenom = morceaux.slice(1).filter((m) => !TITRES.test(m)).join(' ');
  return prenom ? `${prenom} ${morceaux[0]}` : morceaux[0];
}

/**
 * Les partis, tels que l'Assemblée les nomme sur ses cartes de député·e, et le code court que
 * la page utilise (couleurs, filtres). Le nom français est celui de la page française de
 * l'Assemblée. Un parti absent de cette table arrête deputes.js : on n'étiquette personne au hasard.
 */
export const PARTIS = {
  'Liberal Party': { code: 'LIB', fr: 'Parti libéral', en: 'Liberal Party' },
  'Progressive Conservative Party': { code: 'PC', fr: 'Parti progressiste-conservateur', en: 'Progressive Conservative Party' },
  'Green Party': { code: 'VERT', fr: 'Parti vert', en: 'Green Party' },
  'Independent': { code: 'IND', fr: 'Indépendant·e', en: 'Independent' },
};
