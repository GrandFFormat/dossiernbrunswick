// Construit les pages du site à partir des données lues sur legnb.ca.
//
// Deux langues, deux pages. Le français vit à la racine (/, /projets-de-loi.html…),
// l'anglais sous /en/. Chaque page porte les liens `hreflang` vers son équivalent, et
// aucune n'est un gabarit traduit à l'exécution : ce sont deux pages de vrai HTML, qu'un
// moteur peut indexer et qu'un lecteur peut lire sans JavaScript. Dans la seule province
// officiellement bilingue du pays, les deux langues ne peuvent pas être l'une le réglage
// de l'autre.
//
// RIEN N'EST ÉCRIT QUI NE VIENNE DES DONNÉES. Les chiffres de l'affiche sont comptés dans
// les fichiers de data/, pas saisis à la main ; la date de la prochaine séance vient du
// calendrier officiel. Quand une donnée manque, la page le dit au lieu de la deviner — la
// maquette du cahier de design, elle, annonçait « 38 projets de loi » et une reprise des
// travaux le 18 novembre, deux chiffres inventés qui ne doivent jamais passer ici.
//
//   node scripts/build.js

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const SITE = 'https://dossiernbrunswick.ca';

const lireJson = (chemin) => (existsSync(chemin) ? JSON.parse(readFileSync(chemin, 'utf8')) : null);

const projetsFichier = lireJson('data/projets-de-loi.json');
const deputesFichier = lireJson('data/deputes.json');
const conseilFichier = lireJson('data/conseil-executif.json');
const calendrierFichier = lireJson('data/calendrier.json');
const votesFichier = lireJson('data/votes.json');

if (!projetsFichier) throw new Error('data/projets-de-loi.json manque — lancer les scrapers avant le build');

// Les fichiers de data/ sont écrits par des scrapers lancés séparément : rien ne garantit
// qu'ils parlent tous de la même session. Un fichier de votes resté sur la session
// précédente afficherait ses 24 votes sous le titre « cette session » — une donnée fausse,
// sans rien de cassé pour la signaler. On vérifie donc avant de construire.
const session = `${projetsFichier.legislature}-${projetsFichier.session}`;
for (const [nom, fichier] of [['data/votes.json', votesFichier]]) {
  if (!fichier?.legislature) continue;
  const sienne = `${fichier.legislature}-${fichier.session}`;
  if (sienne !== session) {
    throw new Error(
      `${nom} porte sur la session ${sienne}, les projets de loi sur ${session}. `
      + 'Relancer ce scraper sur la session en cours avant de construire : les pages diraient '
      + 'autrement « cette session » en montrant celle d\'avant.'
    );
  }
}

/* ─── Textes ──────────────────────────────────────────────────────────────── */

const T = {
  fr: {
    langue: 'fr', autre: 'en', autreNom: 'English',
    titreOnglet: 'DossierNBrunswick — l\'Assemblée législative du Nouveau-Brunswick en clair',
    description: 'Les projets de loi, les votes et les élu·e·s de l\'Assemblée législative du Nouveau-Brunswick, en langage clair. Site citoyen indépendant, données publiques officielles.',
    ticker: 'DossierNBrunswick — site citoyen indépendant · vraies données publiques · Assemblée législative du Nouveau-Brunswick',
    surtitre: (l, s) => `${l}ᵉ législature · ${s}ᵉ session`,
    h1: 'L\'Assemblée législative du N.‑B. en clair',
    sousTitre: 'Qui siège, qui légifère, qui vote quoi.',
    chapo: 'L\'Assemblée législative du Nouveau-Brunswick, réorganisée <b>par personne</b> et traduite <b>en langage clair</b> — sans jugement ni verdict. Site citoyen indépendant, vraies données publiques, en français et en anglais.',
    explorer: 'Les projets de loi →', deputesBtn: 'Les député·e·s',
    chiffreDeputes: 'Député·e·s à l\'Assemblée',
    chiffreProjets: 'Projets de loi cette session',
    chiffreVotes: 'Votes nominatifs cette session',
    prochaineSeance: (d, h) => `<b>Prochaine séance le ${d}${h ? `, à ${h}` : ''}.</b> Les projets de loi déposés à Fredericton apparaissent ici au rafraîchissement suivant.`,
    pasDeSeance: '<b>Aucune séance annoncée pour l\'instant.</b> Le calendrier de l\'Assemblée ne publie pas de prochaine séance à la date de cette lecture.',
    projetsTitre: 'Projets de loi de la session', projetsVoir: 'Voir tous les projets →',
    projetsNote: 'Chaque projet renvoie au texte officiel, en français et en anglais. Les étapes et leurs dates sont celles publiées par l\'Assemblée.',
    activiteTitre: 'Derniers actes à l\'Assemblée',
    votesTitre: 'Votes nominatifs',
    votesVides: 'Aucun vote nominatif n\'a encore été consigné cette session.',
    votesNote: 'Les votes nominatifs sont rares : la plupart des projets de loi sont adoptés de vive voix, sans que les positions individuelles soient inscrites au Journal. Une absence de vote nominatif ne veut donc pas dire « unanime ».',
    missionTitre: 'Le site officiel est la source. Celui-ci la rend plus facile à suivre.',
    mission: [
      'Tout ce que vous lisez ici vient de legnb.ca, le site de l\'Assemblée législative, et de gnb.ca. Chaque page nomme sa source et la date de sa dernière lecture.',
      'Aucun verdict : les faits sont mis côte à côte, et le jugement reste au lecteur. Aucune donnée inventée : quand une information manque, le site l\'écrit.',
      'Site non officiel, indépendant, sans publicité ni abonnement. L\'Assemblée publie ses informations pour un usage non commercial : ce site s\'y tient.',
    ],
    piedSources: 'Données publiques de l\'Assemblée législative du Nouveau-Brunswick (legnb.ca) et du gouvernement du Nouveau-Brunswick (gnb.ca).',
    piedNonOfficiel: 'Site non officiel',
    piedAvis: 'La version imprimée des projets de loi reste la version officielle.',
    luLe: (d) => `Données lues le ${d}.`,
    onglets: [
      { num: '01', nom: 'Aperçu', vers: '' },
      { num: '02', nom: 'Ministres', vers: 'ministres' },
      { num: '03', nom: 'Projets de loi', vers: 'projets-de-loi' },
      { num: '04', nom: 'Député·e·s', vers: 'deputes' },
      { num: '05', nom: 'Lexique', vers: 'lexique' },
    ],
    neufSurtitre: 'Quoi de neuf', neufTitre: 'Dernières activités réelles à l\'Assemblée',
    neufIntro: 'Fil chronologique, du plus récent au plus ancien. Chaque ligne est un acte inscrit au registre de l\'Assemblée.',
    missionSurtitre: 'Notre mission',
    missionOfficiel: 'legnb.ca fait', missionNous: 'Ce site essaie de faire',
    missionListeOfficiel: [
      'Organise tout par document officiel',
      'La source légale et complète de tout',
      'Neutre — ne compare ni ne résume jamais',
    ],
    missionListeNous: [
      'Organise tout par personne : une fiche, tous ses dossiers',
      'Traduit le jargon en langage clair (voir le Lexique)',
      'Vous laisse suivre ce qui vous touche, sans jugement ni verdict',
    ],
    piedLiens: [['Les règles', 'regles'], ['Sources', 'sources']],
    theme: 'Thème clair ou sombre', texteMoins: 'Réduire le texte', textePlus: 'Agrandir le texte',
    deposeLe: 'Dépôt', dernierActe: 'Dernier acte', pour: 'pour', contre: 'contre',
    parrainePar: 'Déposé par',
  },
  en: {
    langue: 'en', autre: 'fr', autreNom: 'Français',
    titreOnglet: 'DossierNBrunswick — the Legislative Assembly of New Brunswick in plain language',
    description: 'Bills, recorded votes and members of the Legislative Assembly of New Brunswick, in plain language. Independent citizen site, official public data.',
    ticker: 'DossierNBrunswick — independent citizen site · real public data · Legislative Assembly of New Brunswick',
    surtitre: (l, s) => `${l}${l % 10 === 1 && l % 100 !== 11 ? 'st' : l % 10 === 2 && l % 100 !== 12 ? 'nd' : l % 10 === 3 && l % 100 !== 13 ? 'rd' : 'th'} Legislature · Session ${s}`,
    h1: 'The N.B. Legislature in plain language',
    sousTitre: 'Who sits, who legislates, who votes how.',
    chapo: 'The Legislative Assembly of New Brunswick, reorganized <b>by person</b> and translated <b>into plain language</b> — no scores, no verdicts. Independent citizen site, real public data, in French and English.',
    explorer: 'The bills →', deputesBtn: 'The members',
    chiffreDeputes: 'Members of the Assembly',
    chiffreProjets: 'Bills this session',
    chiffreVotes: 'Recorded votes this session',
    // « p.m. » porte déjà son point final : le gabarit ne doit pas en ajouter un second.
    prochaineSeance: (d, h) => `<b>Next sitting on ${d}${h ? `, at ${h}` : '.'}</b> Bills tabled in Fredericton appear here at the next refresh.`,
    pasDeSeance: '<b>No sitting announced yet.</b> The Assembly\'s calendar listed no upcoming sitting when this page was built.',
    projetsTitre: 'Bills of this session', projetsVoir: 'All bills →',
    projetsNote: 'Every bill links to its official text, in French and in English. Stages and dates are those published by the Assembly.',
    activiteTitre: 'Latest acts in the House',
    votesTitre: 'Recorded votes',
    votesVides: 'No recorded vote has been entered this session yet.',
    votesNote: 'Recorded votes are rare: most bills pass on a voice vote, with no individual positions entered in the Journal. No recorded vote therefore does not mean "unanimous".',
    missionTitre: 'The official site is the source. This one makes it easier to follow.',
    mission: [
      'Everything here comes from legnb.ca, the Legislative Assembly\'s own site, and from gnb.ca. Every page names its source and when it was last read.',
      'No verdicts: facts are placed side by side and the judgment stays with the reader. No invented data: when something is missing, the site says so.',
      'Unofficial, independent, with no advertising and no subscription. The Assembly publishes its information for non-commercial use, and this site keeps to that.',
    ],
    piedSources: 'Public data from the Legislative Assembly of New Brunswick (legnb.ca) and the Government of New Brunswick (gnb.ca).',
    piedNonOfficiel: 'Unofficial site',
    piedAvis: 'The printed version of a bill remains the official version.',
    luLe: (d) => `Data read on ${d}.`,
    onglets: [
      { num: '01', nom: 'Overview', vers: '' },
      { num: '02', nom: 'Ministers', vers: 'ministers' },
      { num: '03', nom: 'Bills', vers: 'bills' },
      { num: '04', nom: 'Members', vers: 'members' },
      { num: '05', nom: 'Glossary', vers: 'glossary' },
    ],
    neufSurtitre: 'What\'s new', neufTitre: 'Latest real activity in the House',
    neufIntro: 'A timeline, most recent first. Every line is an act entered in the Assembly\'s record.',
    missionSurtitre: 'Our mission',
    missionOfficiel: 'legnb.ca does', missionNous: 'This site tries to do',
    missionListeOfficiel: [
      'Organizes everything by official document',
      'The complete, legal source for all of it',
      'Neutral — never compares, never summarizes',
    ],
    missionListeNous: [
      'Organizes everything by person: one page, all their files',
      'Turns the jargon into plain language (see the Glossary)',
      'Lets you follow what affects you, with no scores and no verdicts',
    ],
    piedLiens: [['The rules', 'rules'], ['Sources', 'sources']],
    theme: 'Light or dark theme', texteMoins: 'Smaller text', textePlus: 'Larger text',
    deposeLe: 'Tabled', dernierActe: 'Latest act', pour: 'yeas', contre: 'nays',
    parrainePar: 'Sponsored by',
  },
};

/* ─── Mise en forme ───────────────────────────────────────────────────────── */

const MOIS_FR = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juill.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MOIS_EN = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** « 2026-11-17 » -> « 17 nov. 2026 » / « Nov. 17, 2026 ». */
function dateLisible(iso, langue) {
  if (!iso) return null;
  const [a, m, j] = iso.split('-').map(Number);
  if (!a || !m || !j) return null;
  return langue === 'en' ? `${MOIS_EN[m - 1]} ${j}, ${a}` : `${j} ${MOIS_FR[m - 1]} ${a}`;
}

/**
 * L'heure telle que le calendrier l'écrit (« 1:00 PM ») vers la convention de chaque langue :
 * « 13 h » en français, « 1:00 p.m. » en anglais. Une heure en AM/PM dans une phrase
 * française se lit comme une traduction oubliée.
 */
function heureLisible(brute, langue) {
  if (!brute) return null;
  const m = String(brute).match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!m) return brute;
  let heures = Number(m[1]) % 12;
  if (/pm/i.test(m[3])) heures += 12;
  const minutes = m[2];
  if (langue === 'en') return `${Number(m[1])}:${minutes} ${m[3].toLowerCase() === 'pm' ? 'p.m.' : 'a.m.'}`;
  return minutes === '00' ? `${heures} h` : `${heures} h ${minutes}`;
}

const echapper = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Traduit en français une étape ou un statut écrit par l'Assemblée en anglais. On traduit
 * les libellés de procédure, qui sont un vocabulaire fermé et connu ; on ne traduit jamais
 * le titre d'un projet de loi, puisque l'Assemblée le publie elle-même dans les deux langues.
 */
const ETAPES_FR = new Map([
  ['1st Reading', '1re lecture'], ['2nd Reading', '2e lecture'], ['3rd Reading', '3e lecture'],
  ['Committee', 'Comité'], ['Royal Assent', 'Sanction royale'],
  ['First Reading', '1re lecture'], ['Second Reading', '2e lecture'], ['Third Reading', '3e lecture'],
]);
const RESULTATS_FR = new Map([
  ['Introduced', 'déposé'], ['Passed', 'adopté'], ['Defeated', 'rejeté'],
  ['Received', 'reçue'], ['Withdrawn', 'retiré'],
]);

function etapeLisible(nom, langue) {
  if (langue === 'en') return nom;
  return ETAPES_FR.get(nom) || nom;
}

/**
 * Où en est un projet de loi, dans la langue de la page.
 *
 * En anglais, c'est le statut que la fiche affiche (« Second Reading Passed »). En français,
 * on ne le traduit PAS : on reprend le libellé que l'Assemblée écrit elle-même sur sa page
 * française, « 2e lecture · Adoption ». Traduire à la main donnait « 2e lecture adopté », avec
 * une faute d'accord — et dans la seule province officiellement bilingue, le vocabulaire de
 * procédure a déjà sa forme française officielle.
 */
function statutLisible(projet, langue) {
  if (langue === 'en') return projet.statut || null;
  const etape = derniereEtape(projet);
  if (etape?.nomFr) return etape.resultatFr ? `${etape.nomFr} · ${etape.resultatFr}` : etape.nomFr;
  // Pas de libellé français publié pour cette étape : on reste muet plutôt que d'improviser.
  return null;
}

/** La dernière étape franchie d'un projet, celle qui dit où il en est vraiment. */
function derniereEtape(projet) {
  const datees = (projet.etapes || []).filter((e) => e.date);
  if (!datees.length) return null;
  return datees.reduce((a, b) => (a.date >= b.date ? a : b));
}

/* ─── Les morceaux de page ────────────────────────────────────────────────── */

const ETOILE = (couleur) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><polygon fill="${couleur}" points="12,1.5 14.9,8.6 22.5,9.1 16.6,14 18.5,21.5 12,17.4 5.5,21.5 7.4,14 1.5,9.1 9.1,8.6"></polygon></svg>`;
const CHEVRON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6"></path></svg>';

function entete(t, racine, page) {
  // Les onglets de la maquette, numérotés. Chacun mène à une page qui existe : un onglet
  // qui promet une section vide vaut moins que pas d'onglet du tout.
  const onglets = t.onglets
    .map(({ num, nom, vers }) => {
      const adresse = vers === '' ? racine : `${racine}${vers}`;
      const courant = (page || '') === vers;
      return `    <a class="nb-onglet" href="${adresse}"${courant ? ' aria-current="page"' : ''}>`
        + `<span class="nb-num">${num}</span>${nom}</a>`;
    })
    .join('\n');

  return `  <header class="nb-entete">
    <a class="nb-marque" href="${racine || '/'}">
      <span style="width:22px;height:22px;display:inline-flex">${ETOILE('var(--nb-jaune)')}</span>
      Dossier<em>NBrunswick</em>
    </a>
${onglets}
    <button class="nb-bouton-carre" type="button" data-nb-theme aria-pressed="false" title="${t.theme}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>
      <span class="nb-invisible">${t.theme}</span>
    </button>
    <div class="nb-zoom" role="group" aria-label="${t.textePlus}">
      <button type="button" data-nb-zoom="moins" title="${t.texteMoins}">A−</button>
      <output data-nb-zoom-valeur>100%</output>
      <button type="button" data-nb-zoom="plus" title="${t.textePlus}">A+</button>
    </div>
    <a class="nb-onglet" data-nb-autre-langue="${t.autre}" href="${t.autre === 'en' ? '/en/' : '/'}" hreflang="${t.autre}" rel="alternate">${t.autreNom}</a>
  </header>`;
}

function affiche(t, chiffres, leg, ses) {
  return `  <section class="nb-affiche">
    <div class="nb-affiche-titre">
      <span class="nb-etoile-fond">${ETOILE('var(--nb-jaune)')}</span>
      <p class="nb-surtitre">${t.surtitre(leg, ses)}</p>
      <h1>${t.h1}</h1>
      <p class="nb-sous-titre">${t.sousTitre}</p>
    </div>
    <div class="nb-affiche-texte">
      <p class="nb-chapo">${t.chapo}</p>
      <div class="nb-actions">
        <a class="nb-btn nb-btn-rouge" href="#projets">${t.explorer}</a>
        <a class="nb-btn nb-btn-ligne" href="#deputes">${t.deputesBtn}</a>
      </div>
    </div>
    <div class="nb-chiffres">
      ${chiffres.map((c) => `<p class="nb-chiffre"><b>${c.valeur}</b><span>${c.libelle}</span></p>`).join('\n      ')}
    </div>
  </section>`;
}

function avisSeance(t, langue) {
  const prochaine = calendrierFichier?.prochaineSeance;
  if (!prochaine) return `  <p class="nb-avis">${t.pasDeSeance}</p>`;
  const d = dateLisible(prochaine.date, langue);
  return `  <p class="nb-avis">${t.prochaineSeance(d, heureLisible(prochaine.heure, langue))}</p>`;
}

function rangeeProjet(projet, t, langue) {
  const titre = projet.titre[langue] || projet.titre.en || projet.titre.fr;
  const etape = derniereEtape(projet);
  const statut = statutLisible(projet, langue)
    || (etape ? etapeLisible(etape.nom, langue) : null);
  const rejete = /defeated|rejet/i.test(projet.statut || '');
  const lien = projet.source?.[langue] || projet.source?.en || '#';
  return `        <a class="nb-projet" href="${echapper(lien)}" rel="noopener">
          <span class="nb-projet-num">${langue === 'en' ? 'No.' : 'Nᵒ'} ${projet.numero}</span>
          <span class="nb-projet-titre">${echapper(titre)}</span>
          ${statut ? `<span class="nb-etape${rejete ? ' rejete' : ''}">${echapper(statut)}</span>` : '<span></span>'}
          <span class="nb-projet-fleche">${CHEVRON}</span>
        </a>`;
}

function sectionProjets(t, langue) {
  const projets = [...projetsFichier.projets].sort((a, b) => b.numero - a.numero);
  return `  <section class="nb-section" id="projets">
    <div class="nb-section-tete">
      <h2>${t.projetsTitre}</h2>
      <a class="nb-voir-tout" href="${projetsFichier.source}" rel="noopener">${t.projetsVoir}</a>
    </div>
    <p class="nb-section-note">${t.projetsNote}</p>
    <div class="nb-projets">
${projets.map((p) => rangeeProjet(p, t, langue)).join('\n')}
    </div>
  </section>`;
}

function sectionActivite(t, langue) {
  // Les derniers actes réels : chaque étape datée de chaque projet, du plus récent au plus ancien.
  const actes = [];
  for (const p of projetsFichier.projets) {
    for (const e of p.etapes || []) {
      if (!e.date) continue;
      const titre = p.titre[langue] || p.titre.en;
      const quoi = langue === 'fr' ? (e.nomFr || e.nom) : e.nom;
      const sort = langue === 'fr' ? e.resultatFr : (e.resultat ? e.resultat.en : null);
      actes.push({ date: e.date, texte: `${langue === 'en' ? 'Bill' : 'Projet'} ${p.numero} — ${titre} · ${quoi}${sort ? ` (${sort})` : ''}` });
    }
  }
  // Les votes nominatifs sont des actes de la Chambre comme les autres : ils entrent dans
  // le même fil, à leur date, plutôt que dans une colonne à part.
  for (const v of votesFichier?.votes || []) {
    const quoi = v.objet.genre === 'bill'
      ? `${langue === 'en' ? 'Bill' : 'le projet de loi n°'} ${v.objet.numero}`
      : v.objet.genre === 'motion'
        ? `${langue === 'en' ? 'Motion' : 'la motion'} ${v.objet.numero}`
        : (langue === 'en' ? 'a question before the House' : 'une question soumise à la Chambre');
    const amend = v.objet.surAmendement
      ? (langue === 'en' ? ' (on an amendment)' : ' (sur un amendement)')
      : '';
    const phrase = langue === 'en'
      ? `Recorded vote on ${quoi}${amend}: ${v.pour.total} yeas, ${v.contre.total} nays.`
      : `Vote nominatif sur ${quoi}${amend} : ${v.pour.total} pour, ${v.contre.total} contre.`;
    actes.push({ date: v.date, texte: phrase });
  }

  actes.sort((a, b) => (a.date < b.date ? 1 : -1));
  const derniers = actes.slice(0, 7);

  return `  <section class="nb-neuf">
    <div>
      <p class="nb-surtitre">${t.neufSurtitre}</p>
      <h2>${t.neufTitre}</h2>
      <p class="nb-neuf-intro">${t.neufIntro}</p>
    </div>
    <div class="nb-fil">
${derniers.map((a) => `      <div><time datetime="${a.date}">${dateLisible(a.date, langue)}</time><span>${echapper(a.texte)}</span></div>`).join('\n')}
    </div>
  </section>`;
}

/**
 * La mission, en trois colonnes : ce que fait le site officiel, et ce que celui-ci essaie
 * de faire. Les deux côte à côte, sans dire que l'un vaut mieux que l'autre — legnb.ca
 * reste la source, et le dire franchement est la première preuve de sérieux.
 */
function sectionMission(t) {
  return `  <section class="nb-mission3">
    <div>
      <p class="nb-surtitre">${t.missionSurtitre}</p>
      <h2>${t.missionTitre}</h2>
    </div>
    <div>
      <p class="nb-colonne-titre officiel">${t.missionOfficiel}</p>
      <ul>
${t.missionListeOfficiel.map((l) => `        <li>${l}</li>`).join('\n')}
      </ul>
    </div>
    <div>
      <p class="nb-colonne-titre nous">${t.missionNous}</p>
      <ul>
${t.missionListeNous.map((l) => `        <li>${l}</li>`).join('\n')}
      </ul>
    </div>
  </section>`;
}

function pied(t, langue, racine) {
  const lu = dateLisible((projetsFichier.luLe || '').slice(0, 10), langue);
  const liens = t.piedLiens
    .map(([nom, vers]) => `<a href="${racine}${vers}">${nom}</a>`)
    .join('\n    ');
  return `  <footer class="nb-pied">
    <p><strong>${t.piedNonOfficiel}.</strong> ${t.piedSources} ${t.piedAvis}</p>
    <p>${lu ? t.luLe(lu) : ''}</p>
  </footer>
  <div class="nb-tricolore" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="nb-pied-liens">
    <span>${t.piedNonOfficiel} — ${t.piedSources}</span>
    ${liens}
    <a data-nb-autre-langue="${t.autre}" href="${t.autre === 'en' ? '/en/' : '/'}" hreflang="${t.autre}" rel="alternate">${t.autreNom}</a>
  </div>`;
}

/* ─── La page ─────────────────────────────────────────────────────────────── */

function page(langue) {
  const t = T[langue];
  const leg = projetsFichier.legislature;
  const ses = projetsFichier.session;
  const racine = langue === 'en' ? '/en/' : '/';
  const canonique = langue === 'en' ? `${SITE}/en/` : `${SITE}/`;
  const autre = langue === 'en' ? `${SITE}/` : `${SITE}/en/`;

  const chiffres = [
    { valeur: deputesFichier?.sieges ?? '—', libelle: t.chiffreDeputes },
    { valeur: projetsFichier.projets.length, libelle: t.chiffreProjets },
    { valeur: votesFichier?.votes?.length ?? 0, libelle: t.chiffreVotes },
  ];

  const ticker = `  <div class="nb-ticker" aria-hidden="true"><div class="nb-ticker-piste">`
    + `<span><span class="nb-etoile">★</span> ${t.ticker}</span>`.repeat(3)
    + `</div></div>`;

  return `<!DOCTYPE html>
<html lang="${langue}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(t.titreOnglet)}</title>
<meta name="description" content="${echapper(t.description)}">
<meta name="theme-color" content="#0033a0">
<link rel="canonical" href="${canonique}">
<link rel="alternate" hreflang="${t.autre}" href="${autre}">
<link rel="alternate" hreflang="${langue}" href="${canonique}">
<link rel="alternate" hreflang="x-default" href="${SITE}/">
<link rel="icon" href="/commun/nb.svg" type="image/svg+xml">
<link rel="stylesheet" href="/commun/industry.css">
<link rel="stylesheet" href="/commun/nb.css">
<script>
// Le thème avant le premier pixel : sans ça, une page sombre s'ouvre en blanc puis clignote.
try { var m = localStorage.getItem('dnb:theme'); if (m === 'dark') document.documentElement.setAttribute('data-theme', 'dark'); } catch (e) {}
</script>
</head>
<body>
<div class="nb-page">
${ticker}
${entete(t, racine, '')}
${affiche(t, chiffres, leg, ses)}
${avisSeance(t, langue)}
${sectionProjets(t, langue)}
${sectionActivite(t, langue)}
${sectionMission(t)}
${pied(t, langue, racine)}
</div>
<script src="/commun/nb.js" defer></script>
</body>
</html>
`;
}

/* ─── Écriture ────────────────────────────────────────────────────────────── */

writeFileSync('index.html', page('fr'), 'utf8');
mkdirSync('en', { recursive: true });
writeFileSync('en/index.html', page('en'), 'utf8');

// Le sitemap que robots.txt annonce. Chaque adresse déclare ses deux langues : c'est comme
// ça qu'un moteur sait que /en/ n'est pas une page concurrente de /, mais la même page dans
// l'autre langue officielle.
const LANGUES = [['fr', `${SITE}/`], ['en', `${SITE}/en/`]];
const jour = new Date().toISOString().slice(0, 10);
const alternatives = LANGUES
  .map(([code, adresse]) => `    <xhtml:link rel="alternate" hreflang="${code}" href="${adresse}"/>`)
  .join('\n');

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...LANGUES.map(([, adresse]) => [
    '  <url>',
    `    <loc>${adresse}</loc>`,
    alternatives,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}/"/>`,
    `    <lastmod>${jour}</lastmod>`,
    '  </url>',
  ].join('\n')),
  '</urlset>',
  '',
].join('\n');

writeFileSync('sitemap.xml', sitemap, 'utf8');


console.log(`écrit index.html, en/index.html et sitemap.xml`);
console.log(`  ${projetsFichier.projets.length} projets de loi, session ${projetsFichier.legislature}-${projetsFichier.session}`);
console.log(`  ${deputesFichier?.sieges ?? "?"} sièges, ${conseilFichier?.membres?.length ?? "?"} membres du Conseil exécutif`);
console.log(`  ${votesFichier?.votes?.length ?? 0} votes nominatifs`);
console.log(`  prochaine séance : ${calendrierFichier?.prochaineSeance?.date ?? "aucune annoncée"}`);
