// Outils communs aux scrapers du Nouveau-Brunswick.
//
// Une seule règle gouverne ce fichier : legnb.ca demande « crawl-delay: 10 » dans son
// robots.txt, et on le respecte à la lettre. Toutes les lectures passent donc par `lire()`,
// qui sérialise les requêtes et attend dix secondes entre deux. C'est lent — un
// rafraîchissement complet prend quelques minutes — et c'est voulu : le site est derrière
// Cloudflare, il nous laisse passer, et la façon de garder cet accès est de ne pas en abuser.
//
// On ne se déguise jamais en navigateur. Le User-Agent nous nomme et donne une adresse où
// nous joindre, pour que l'Assemblée puisse nous écrire plutôt que nous bloquer.

import { writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export const UA = 'dossiernbrunswick-scraper/0.1 (projet citoyen independant, usage non commercial; +https://dossiernbrunswick.ca)';
export const HOTE = 'https://www.legnb.ca';
const DELAI_MS = 10_000;

let derniereLecture = 0;
let file = Promise.resolve();

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Cloudflare sert ses défis avec un corps de page et parfois un code 200 : un statut 200 ne
// suffit donc pas à conclure qu'on a bien été servi.
function defiCloudflare(statut, entetes, debut) {
  if ([403, 429, 503].includes(statut)) return true;
  if (entetes.get('cf-mitigated')) return true;
  return /Just a moment|Attention Required|Checking your browser|__cf_chl/i.test(debut);
}

/**
 * Lit une page de legnb.ca, en file et en respectant le crawl-delay.
 * @param {string} chemin  chemin absolu sur le site, ou URL complète
 * @param {{binaire?: boolean}} options
 * @returns {Promise<string|Buffer>}
 */
export function lire(chemin, options = {}) {
  const url = chemin.startsWith('http') ? chemin : HOTE + chemin;
  // On enchaîne sur la file : deux scrapers lancés en parallèle ne doivent pas
  // additionner leurs requêtes et effacer le délai qu'on s'impose.
  file = file.then(async () => {
    const attente = DELAI_MS - (Date.now() - derniereLecture);
    if (attente > 0) await dormir(attente);
    derniereLecture = Date.now();

    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const octets = Buffer.from(await res.arrayBuffer());
    const debut = octets.subarray(0, 4000).toString('latin1');

    if (defiCloudflare(res.status, res.headers, debut)) {
      throw new Error(`BLOQUÉ par Cloudflare (${res.status}) sur ${url} — on ne contourne pas : voir scripts/test-acces-legnb.js`);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${url}`);
    if (options.binaire) return octets;

    // Les textes des projets de loi sont en ISO-8859-1 (vieux export Arbortext) ; les pages
    // du site sont en UTF-8. On suit ce que la page déclare plutôt que de deviner.
    const type = res.headers.get('content-type') || '';
    const latin = /charset=(iso-8859-1|windows-1252)/i.test(type) || /charset=(ISO-8859-1|windows-1252)/i.test(debut);
    return octets.toString(latin ? 'latin1' : 'utf8');
  });
  return file;
}

/** Texte lisible d'un bout de HTML : une seule espace, entités résolues, rien d'autre. */
export function texte(html) {
  return String(html ?? '')
    // Les ordinaux du site sont en exposant : « 1<sup>st</sup> Reading ». On aplatit la
    // balise sans jeter son contenu, sinon il resterait « 1 Reading » — et l'exposant
    // collé au chiffre doit le rester, d'où le retrait de la balise plutôt qu'une espace.
    .replace(/<sup>([\s\S]*?)<\/sup>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Les dates de legnb.ca sont écrites m/j/aaaa en anglais et jj/mm/aaaa en français : la même
 * chaîne « 11/4/2026 » vaut le 4 novembre d'un côté et le 11 avril de l'autre. On ne lit donc
 * les dates que sur les pages anglaises, et on les range en ISO.
 * @returns {string|null} aaaa-mm-jj
 */
export function dateDepuisAnglais(s) {
  const m = String(s ?? '').match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!m) return null;
  const [, mois, jour, annee] = m;
  if (+mois < 1 || +mois > 12 || +jour < 1 || +jour > 31) return null;
  return `${annee}-${String(mois).padStart(2, '0')}-${String(jour).padStart(2, '0')}`;
}

/** Les liens du site utilisent des antislashs : /content/house_business\61\3\bills\Bill-1-e.htm */
export const normaliserChemin = (href) => String(href ?? '').split("\\").join('/');

/**
 * Lit une carte de député·e (`.member-card`), le composant que legnb.ca réutilise partout :
 * liste des membres, Conseil exécutif, et parrain d'un projet de loi. La carte porte aussi
 * la couleur officielle du parti, en bordure gauche — on la prend ici plutôt que de la
 * chercher ailleurs ou de l'inventer.
 *
 * @param {import('cheerio').CheerioAPI} $
 * @param {any} el  l'élément .member-card
 */
/**
 * Qui dirige un parti. Les fiches de l'Assemblée distinguent deux choses qu'un simple
 * « leader » confondrait : le CHEF d'un parti (« Leader of the Official Opposition »,
 * « Leader of the Third Party ») et le LEADER PARLEMENTAIRE, qui organise les travaux de
 * son groupe en Chambre (« Government House Leader »). Seul le premier compte.
 *
 * La règle vit ici parce que deux endroits s'en servent : le scraper des portraits, pour
 * savoir qui en a besoin, et la construction du site, pour savoir qui a une page.
 */
export const estChefDeParti = (roles) => (roles || []).some(
  (r) => /\bleader\b/i.test(r) && !/house leader/i.test(r),
);

/** Les titres professionnels que l'Assemblée intercale dans un nom. */
const TITRES = /^(K\.C\.|Q\.C\.|C\.M\.|O\.C\.|M\.D\.|Ph\.D\.|LL\.D\.|Dr\.?)$/i;

/**
 * Sépare un nom officiel en ses morceaux. L'Assemblée écrit « Famille, Prénom », mais
 * aussi « McKee, K.C., Robert » : le titre professionnel se glisse ENTRE les deux. Couper
 * à la première virgule donnait « K.C., Robert McKee » sur la page des député·e·s.
 *
 * @returns {{ nomAffiche: string, titre: string|null }}
 */
export function separerNom(nomOfficiel) {
  const morceaux = String(nomOfficiel ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (morceaux.length < 2) return { nomAffiche: String(nomOfficiel ?? '').trim(), titre: null };

  const famille = morceaux[0];
  const titres = morceaux.slice(1).filter((m) => TITRES.test(m));
  const reste = morceaux.slice(1).filter((m) => !TITRES.test(m));
  const prenom = reste.join(' ').trim();

  return {
    nomAffiche: prenom ? `${prenom} ${famille}` : famille,
    titre: titres.length ? titres.join(', ') : null,
  };
}

export function lireCarteMembre($, el) {
  const $c = $(el);
  const $parti = $c.find('.member-card-description-party').clone();
  $parti.find('div').remove(); // la pastille de couleur, qui n'est pas du texte
  const lien = $c.find('.member-card-description-name a').attr('href') || null;
  const src = normaliserChemin($c.find('img').attr('src'));
  return {
    nom: texte($c.find('.member-card-description-name').html()) || null,
    parti: texte($parti.html()) || null,
    couleurParti: (($c.attr('style') || '').match(/#[0-9A-Fa-f]{6}/) || [])[0] || null,
    circonscription: texte($c.find('.member-card-description-riding span').html()) || null,
    portrait: src ? (src.startsWith('http') ? src : HOTE + src) : null,
    fiche: lien ? HOTE + lien : null,
    // Les rôles n'apparaissent que sur certaines pages (Conseil exécutif, chefs de parti).
    roles: $c.find('.member-card-description-role, .member-card-description-title, .member-card-description-position')
      .map((_, r) => texte($(r).html()))
      .get()
      .filter(Boolean),
  };
}

/**
 * Écrit un JSON en deux temps (fichier voisin puis renommage) : un run interrompu ne doit
 * jamais laisser un fichier de données à moitié écrit, que le site servirait ensuite.
 */
export function ecrireJson(chemin, donnees) {
  mkdirSync(dirname(chemin), { recursive: true });
  const tmp = `${chemin}.tmp`;
  writeFileSync(tmp, JSON.stringify(donnees, null, 2) + '\n', 'utf8');
  renameSync(tmp, chemin);
  // On annonce ce qui compte : la longueur du tableau de données, pas le nombre de champs
  // de l'enveloppe (qui ne veut rien dire pour le lecteur).
  const tableau = Array.isArray(donnees)
    ? donnees
    : Object.values(donnees).find((v) => Array.isArray(v) && v.length);
  const n = Array.isArray(tableau) ? tableau.length : Object.keys(donnees).length;
  console.log(`écrit ${chemin} (${n})`);
}

export const existe = existsSync;
