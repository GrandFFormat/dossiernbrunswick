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
    recentsTitre: 'Projets de loi récemment actifs',
    recentsNote: 'Les quatre derniers projets à avoir bougé. Le premier est ouvert : son dépôt, son dernier vote nominatif quand il y en a un, et qui l\'a déposé.',
    sourceOfficielle: 'Source officielle : legnb.ca',
    ouvrirFiche: 'Ouvrir la fiche →', dernierVote: 'Dernier vote',
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
      // Les député·e·s vivent sur la page des ministres, à la suite, comme sur DossierQuébec.
      { num: '04', nom: 'Député·e·s', vers: 'ministres#assemblee' },
      { num: '05', nom: 'Lexique', vers: 'lexique' },
    ],
    monDossier: 'Mon dossier', monDossierVers: 'mon-dossier',

    /* La bande des villes, sous l'en-tête. */
    bandeVilles: 'Villes',
    bandeVillesNote: 'Conseils municipaux : aucune ville couverte pour l\'instant',
    villes: ['Moncton', 'Saint John', 'Fredericton', 'Dieppe', 'Bathurst'],

    /* Suivre un projet de loi, sans compte. */
    suivre: 'Suivre', suivi: 'Suivi', suivreTitre: (n) => `Suivre le projet de loi nᵒ ${n}`,

    /* La carte « Mon dossier ». */
    compteSurtitre: 'Sans compte',
    compteTitre: 'Suivez les projets qui vous touchent',
    compteTexte: 'Rien à créer, aucun courriel, aucun mot de passe : le bouton <b>Suivre</b> d\'un projet de loi garde votre choix dans ce navigateur seulement. Rien n\'est envoyé au site, et ce site n\'a pas de compte à offrir.',
    compteBtn: 'Ouvrir mon dossier',
    monDossierTitre: 'Mon dossier',
    monDossierSurtitre: 'Gardé dans ce navigateur',
    monDossierNote: 'Les projets de loi que vous suivez. La liste vit dans ce navigateur, sur cet appareil : elle ne part pas sur un serveur, et elle disparaît si vous effacez les données du site. Un autre appareil ne la verra pas.',
    monDossierVide: 'Vous ne suivez encore aucun projet de loi. Le bouton <b>Suivre</b>, sur chaque projet, l\'ajoute ici.',
    monDossierDescription: 'Les projets de loi de l\'Assemblée législative du Nouveau-Brunswick que vous suivez, gardés dans votre navigateur, sans compte.',
    monDossierTous: 'Voir tous les projets de loi →',

    /* Le bloc « signaler un projet ». */
    agirSurtitre: 'Agir sur un projet de loi',
    agirTitre: 'Pas de pétition en ligne au Nouveau-Brunswick',
    agirIntro: 'L\'Assemblée n\'accepte que les pétitions <b>sur papier</b>, signées à la main et déposées par un·e député·e. Aucun bouton, ici ou ailleurs, n\'a de valeur officielle. Voici les trois chemins qui en ont.',
    agirCompteur: 'Compteur citoyen : pas encore ouvert. Il demandera une base de données, et il ne s\'affichera pas avant d\'avoir de vrais chiffres à montrer.',
    agirChemins: [
      ['Écrire à votre député·e', 'C\'est le seul chemin qui marche toujours. Chaque député·e a une adresse à l\'Assemblée.', 'https://www.legnb.ca/fr/parlementaires/actuel', 'La liste officielle →'],
      ['Faire déposer une pétition papier', 'Signée à la main, puis remise à votre député·e, qui la dépose à la Chambre. Le ministre doit répondre par écrit dans les deux semaines — mais cette réponse n\'est pas publiée.', 'lexique', 'Ce que dit le lexique →'],
      ['Se faire entendre en comité', 'Certains comités tiennent des audiences publiques. Leurs avis et leurs dates passent par cette page.', 'https://www.legnb.ca/fr/comit%C3%A9s', 'Les comités →'],
    ],

    /* Le bloc commandite. */
    commanditeSurtitre: 'Commandite',
    commanditeTitre: 'Commanditez votre ville',
    commanditeTexte: 'Le suivi d\'un conseil municipal — ordres du jour, votes et résolutions en langage clair — demande du travail de lecture par ville. Une commandite locale en financerait une pendant un an.',
    commanditeAvis: 'Aucune ville n\'est couverte, et aucun prix n\'est fixé pour le Nouveau-Brunswick. Il n\'y a donc rien à vendre aujourd\'hui : c\'est une intention, pas une offre.',
    commanditeBtn: null,
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
    piedLiens: [],
    surtitreSession: (l, s) => `${l}ᵉ législature · ${s}ᵉ session`,
    projetsDescription: 'Tous les projets de loi de la session en cours à l\'Assemblée législative du Nouveau-Brunswick, avec leurs étapes datées et leurs textes officiels.',
    documents: 'Textes officiels :', texteFr: 'français (HTML)', texteEn: 'anglais (HTML)',
    textePdf: 'PDF bilingue', amendement: 'amendement (PDF)',
    voirOfficiel: 'Voir la fiche officielle sur legnb.ca →',
    deputesTitre: 'Les député·e·s',
    deputesSurtitre: (n) => `${n} sièges`,
    deputesNote: 'Classés par parti, du plus nombreux au moins nombreux. Les courriels ne sont pas repris ici : l\'Assemblée les protège derrière un mécanisme anti-robots, et on ne le contourne pas. Chaque nom mène à sa fiche officielle, qui porte l\'adresse.',
    deputesDescription: 'Les 49 député·e·s de l\'Assemblée législative du Nouveau-Brunswick, par parti et par circonscription.',
    ministresTitre: 'Le Conseil exécutif',
    ministresSurtitre: (n) => `${n} ministres`,
    ministreCirconscription: 'Circonscription', ministreProjets: 'Projets de loi déposés',
    ministreFiche: 'Fiche officielle →', ministrePortefeuilles: 'Portefeuilles',
    suivreMinistre: (n) => `Suivre ${n}`,
    monDossierProjets: 'Projets de loi suivis', monDossierMinistres: 'Ministres suivis',
    monDossierDeputes: 'Député·e·s suivi·e·s',
    ministresNote: 'La liste tenue par l\'Assemblée législative. La page du gouvernement a déjà été en retard sur celle-ci : en cas de divergence, c\'est celle-ci qui fait foi ici.',
    ministresDescription: 'Les ministres du Nouveau-Brunswick et leurs portefeuilles, selon l\'Assemblée législative.',
    lexiqueTitre: 'Le lexique',
    lexiqueSurtitre: 'Le jargon, en clair',
    lexiqueNote: 'Les mots que l\'Assemblée emploie, expliqués simplement. Rien ici n\'a de valeur officielle : c\'est une aide à la lecture.',
    lexiqueDescription: 'Le vocabulaire de l\'Assemblée législative du Nouveau-Brunswick expliqué en langage clair.',
    lexique: [
      ['Première lecture', 'Le dépôt. Le projet de loi est présenté à la Chambre et imprimé. Il n\'est pas encore débattu, et personne ne vote sur son contenu.'],
      ['Deuxième lecture', 'Le débat sur le principe. On discute de l\'idée du projet, pas encore du détail de ses articles. C\'est l\'étape où un projet peut être rejeté d\'un coup.'],
      ['Étude en comité', 'L\'examen article par article, par un comité de député·e·s. C\'est là que le texte peut être amendé. Au Nouveau-Brunswick, un projet d\'intérêt privé passe en comité <b>avant</b> sa deuxième lecture : l\'ordre n\'est pas toujours le même.'],
      ['Troisième lecture', 'Le dernier vote de la Chambre. Après, le texte ne change plus.'],
      ['Sanction royale', 'La signature de la lieutenante-gouverneure, qui fait du projet une loi. <b>Attention :</b> une loi sanctionnée n\'est pas forcément en vigueur — beaucoup attendent une proclamation, parfois des mois plus tard.'],
      ['Projet de loi d\'initiative ministérielle', 'Un projet déposé par un ou une ministre, au nom du gouvernement. C\'est la grande majorité des projets adoptés.'],
      ['Projet de loi d\'intérêt public et d\'initiative parlementaire', 'Un projet déposé par un·e député·e qui n\'est pas ministre. Il aboutit rarement.'],
      ['Projet de loi d\'intérêt privé', 'Un projet qui vise une personne, une entreprise ou un organisme précis — par exemple modifier la loi constitutive d\'une université ou d\'un ordre professionnel.'],
      ['Vote nominatif', 'Un vote où le nom de chaque député·e est inscrit au Journal. Ils sont <b>rares</b> : la plupart des projets de loi sont adoptés de vive voix, sans que les positions individuelles soient consignées. L\'absence de vote nominatif ne veut donc pas dire « unanime ».'],
      ['Journal', 'Le compte rendu officiel des décisions de la Chambre, publié chaque jour de séance. C\'est le seul endroit où figurent les votes nominatifs du Nouveau-Brunswick.'],
      ['Hansard', 'Le compte rendu des débats, mot à mot. Il paraît plusieurs mois après la séance.'],
      ['Feuilleton', 'L\'ordre du jour de la Chambre : ce qui est à l\'étude et dans quel ordre.'],
      ['Pétition', 'Au Nouveau-Brunswick, une pétition est <b>sur papier</b>, signée à la main, et ne peut être déposée que par un·e député·e. Il n\'existe pas de pétition en ligne. Le ministre doit répondre par écrit dans les deux semaines, mais cette réponse n\'est pas publiée.'],
      ['Présidence de l\'Assemblée', 'La personne qui préside les séances. Elle <b>ne vote pas</b> : un vote nominatif ne dépasse donc jamais 48 voix sur 49 sièges.'],
      ['Session', 'Une période de travaux. Chaque nouvelle session renumérote les projets de loi à partir de 1 — un même numéro désigne donc des projets différents d\'une session à l\'autre.'],
    ],
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
    recentsTitre: 'Recently active bills',
    recentsNote: 'The last four bills to have moved. The first is open: when it was tabled, its latest recorded vote where there is one, and who introduced it.',
    sourceOfficielle: 'Official source: legnb.ca',
    ouvrirFiche: 'Open the bill →', dernierVote: 'Latest vote',
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
      { num: '04', nom: 'Members', vers: 'ministers#assemblee' },
      { num: '05', nom: 'Glossary', vers: 'glossary' },
    ],
    monDossier: 'My file', monDossierVers: 'my-file',

    bandeVilles: 'Cities',
    bandeVillesNote: 'City councils: no city is covered yet',
    villes: ['Moncton', 'Saint John', 'Fredericton', 'Dieppe', 'Bathurst'],

    suivre: 'Follow', suivi: 'Following', suivreTitre: (n) => `Follow Bill ${n}`,

    compteSurtitre: 'No account',
    compteTitre: 'Follow the bills that affect you',
    compteTexte: 'Nothing to create, no email, no password: the <b>Follow</b> button on a bill keeps your choice in this browser only. Nothing is sent to the site, and this site has no account to offer.',
    compteBtn: 'Open my file',
    monDossierTitre: 'My file',
    monDossierSurtitre: 'Kept in this browser',
    monDossierNote: 'The bills you follow. The list lives in this browser, on this device: it is never sent to a server, and it disappears if you clear the site\'s data. Another device will not see it.',
    monDossierVide: 'You are not following any bill yet. The <b>Follow</b> button on each bill adds it here.',
    monDossierDescription: 'The bills of the Legislative Assembly of New Brunswick you follow, kept in your browser, with no account.',
    monDossierTous: 'See every bill →',

    agirSurtitre: 'Acting on a bill',
    agirTitre: 'There is no online petition in New Brunswick',
    agirIntro: 'The Assembly only accepts petitions <b>on paper</b>, signed by hand and presented by a member. No button, here or anywhere else, carries official weight. These three routes do.',
    agirCompteur: 'A citizen counter is not open yet. It needs a database, and it will not appear before it has real numbers to show.',
    agirChemins: [
      ['Write to your member', 'The one route that always works. Every member has an address at the Assembly.', 'https://www.legnb.ca/en/members/current', 'The official list →'],
      ['Have a paper petition presented', 'Signed by hand, then handed to your member, who presents it in the House. A minister must reply in writing within two weeks — but that reply is not published.', 'glossary', 'What the glossary says →'],
      ['Be heard in committee', 'Some committees hold public hearings. Their notices and dates go through this page.', 'https://www.legnb.ca/en/committees', 'The committees →'],
    ],

    commanditeSurtitre: 'Sponsorship',
    commanditeTitre: 'Sponsor your city',
    commanditeTexte: 'Following a city council — agendas, votes and resolutions in plain language — takes reading work for each city. A local sponsorship would pay for one city for a year.',
    commanditeAvis: 'No city is covered, and no price is set for New Brunswick. There is nothing to sell today: this is an intention, not an offer.',
    commanditeBtn: null,
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
    piedLiens: [],
    surtitreSession: (l, s) => `Legislature ${l} · Session ${s}`,
    projetsDescription: 'Every bill of the current session of the Legislative Assembly of New Brunswick, with dated stages and official texts.',
    documents: 'Official texts:', texteFr: 'French (HTML)', texteEn: 'English (HTML)',
    textePdf: 'bilingual PDF', amendement: 'amendment (PDF)',
    voirOfficiel: 'See the official page on legnb.ca →',
    deputesTitre: 'The members',
    deputesSurtitre: (n) => `${n} seats`,
    deputesNote: 'Grouped by party, largest first. Email addresses are not repeated here: the Assembly protects them behind an anti-robot mechanism, and we do not work around it. Each name links to the official page, which carries the address.',
    deputesDescription: 'The 49 members of the Legislative Assembly of New Brunswick, by party and riding.',
    ministresTitre: 'The Executive Council',
    ministresSurtitre: (n) => `${n} ministers`,
    ministreCirconscription: 'Riding', ministreProjets: 'Bills introduced',
    ministreFiche: 'Official page →', ministrePortefeuilles: 'Portfolios',
    suivreMinistre: (n) => `Follow ${n}`,
    monDossierProjets: 'Bills you follow', monDossierMinistres: 'Ministers you follow',
    monDossierDeputes: 'Members you follow',
    ministresNote: 'The list kept by the Legislative Assembly. The government\'s own page has lagged behind it before: where the two differ, this site follows the Assembly.',
    ministresDescription: 'New Brunswick\'s ministers and their portfolios, as listed by the Legislative Assembly.',
    lexiqueTitre: 'The glossary',
    lexiqueSurtitre: 'The jargon, in plain words',
    lexiqueDescription: 'The vocabulary of the Legislative Assembly of New Brunswick, explained in plain language.',
    lexiqueNote: 'The words the Assembly uses, explained simply. Nothing here is official: it is a reading aid.',
    lexique: [
      ['First reading', 'The tabling. The bill is introduced and printed. It is not debated yet, and nobody votes on its content.'],
      ['Second reading', 'The debate on the principle. The House discusses the idea of the bill, not yet its clauses. This is the stage where a bill can be defeated outright.'],
      ['Committee', 'Clause-by-clause study by a committee of members. This is where the text can be amended. In New Brunswick a private bill goes to committee <b>before</b> its second reading: the order is not always the same.'],
      ['Third reading', 'The House\'s final vote. After it, the text no longer changes.'],
      ['Royal assent', 'The Lieutenant-Governor\'s signature, which turns a bill into an Act. <b>Careful:</b> an Act that has received assent is not necessarily in force — many wait on a proclamation, sometimes months later.'],
      ['Government bill', 'A bill introduced by a minister, on behalf of the government. These are the vast majority of bills that pass.'],
      ['Private member\'s public bill', 'A bill introduced by a member who is not a minister. It rarely becomes law.'],
      ['Private bill', 'A bill aimed at one person, company or body — amending a university\'s founding Act, for instance, or a professional association\'s.'],
      ['Recorded division', 'A vote where every member\'s name is entered in the Journal. They are <b>rare</b>: most bills pass on a voice vote, with no individual positions recorded. No recorded vote therefore does not mean "unanimous".'],
      ['Journal', 'The official record of the decisions of the House, published each sitting day. It is the only place New Brunswick\'s recorded votes appear.'],
      ['Hansard', 'The word-for-word record of debate. It appears several months after the sitting.'],
      ['Order paper', 'The agenda of the House: what is before it, and in what order.'],
      ['Petition', 'In New Brunswick a petition is <b>on paper</b>, signed by hand, and can only be presented by a member. There is no online petition system. A minister must reply in writing within two weeks, but that reply is not published.'],
      ['Speaker', 'The member who presides over sittings. The Speaker <b>does not vote</b>: a recorded division therefore never exceeds 48 of the 49 seats.'],
      ['Session', 'A period of business. Every new session renumbers bills from 1 — the same number means different bills in different sessions.'],
    ],
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
  // Le mieux : le statut que l'Assemblée écrit elle-même en français sur la fiche du projet
  // (« Étape de la deuxième lecture franchie »).
  if (projet.statutFr) return projet.statutFr;
  // À défaut, l'étape et son sort, pris eux aussi sur la page française.
  const etape = derniereEtape(projet);
  if (etape?.nomFr) return etape.resultatFr ? `${etape.nomFr} · ${etape.resultatFr}` : etape.nomFr;
  // Rien de publié en français : on reste muet plutôt que d'improviser une traduction.
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

function entete(t, racine, page, autreChemin = '') {
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
    <a class="nb-onglet nb-onglet-etoile" href="${racine}${t.monDossierVers}"${(page || '') === t.monDossierVers ? ' aria-current="page"' : ''}>
      <span class="nb-etoile-petite" aria-hidden="true">★</span>${t.monDossier}<span class="nb-compteur-suivis" data-nb-compteur hidden></span></a>
    <button class="nb-bouton-carre" type="button" data-nb-theme aria-pressed="false" title="${t.theme}">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>
      <span class="nb-invisible">${t.theme}</span>
    </button>
    <div class="nb-zoom" role="group" aria-label="${t.textePlus}">
      <button type="button" data-nb-zoom="moins" title="${t.texteMoins}">A−</button>
      <output data-nb-zoom-valeur>100%</output>
      <button type="button" data-nb-zoom="plus" title="${t.textePlus}">A+</button>
    </div>
    <a class="nb-onglet" data-nb-autre-langue="${t.autre}" href="${t.autre === 'en' ? '/en/' : '/'}${autreChemin}" hreflang="${t.autre}" rel="alternate">${t.autreNom}</a>
  </header>`;
}

/**
 * La bande des villes de la maquette, sous l'en-tête. Les noms ne sont pas des liens :
 * aucun conseil municipal n'est lu, et un lien qui ne mène nulle part vaudrait moins
 * que du texte qui dit la vérité. La bande annonce elle-même qu'elle ne couvre rien.
 */
function bandeVilles(t) {
  return `  <div class="nb-bande-villes">
    <span class="nb-bande-titre">${t.bandeVilles}</span>
    ${t.villes.map((v) => `<span>${echapper(v)}</span>`).join('\n    ')}
    <span class="nb-bande-note">${t.bandeVillesNote}</span>
  </div>`;
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
        <a class="nb-btn nb-btn-ligne" href="${t.langue === 'en' ? '/en/ministers#assemblee' : '/ministres#assemblee'}">${t.deputesBtn}</a>
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

/** Ce qu'un projet de loi montre une fois ouvert : son dépôt, son dernier vote, son parrain. */
function detailProjet(projet, t, langue) {
  const depot = (projet.etapes || []).find((e) => e.date);
  const vote = dernierVoteDe(projet.numero);
  const parrain = projet.parrain;
  const lien = projet.source?.[langue] || projet.source?.en || '#';
  const chiffres = [
    depot ? `<b>${t.deposeLe}</b> · ${dateLisible(depot.date, langue)}` : null,
    vote ? `<b>${t.dernierVote}</b> · ${vote.pour.total} ${t.pour} · ${vote.contre.total} ${t.contre}` : null,
  ].filter(Boolean);

  return `            <div class="nb-projet-detail">
              <div>
                ${parrain?.nom ? `<p>${t.parrainePar} <b>${echapper(parrain.nom)}</b>`
                  + `${parrain.parti ? ` · <span class="nb-parti"${parrain.couleurParti ? ` style="--parti:${echapper(parrain.couleurParti)}"` : ''}>${echapper(parrain.parti)}</span>` : ''}`
                  + `${parrain.circonscription ? ` · ${echapper(parrain.circonscription)}` : ''}.</p>` : ''}
              </div>
              <p class="nb-projet-chiffres">${chiffres.join('<br>')}
                ${chiffres.length ? '<br>' : ''}<a href="${echapper(lien)}" rel="noopener">${t.ouvrirFiche}</a></p>
            </div>`;
}

/**
 * Une rangée de projet de loi. Le clic ouvre le projet là où il est, au lieu de partir
 * sur legnb.ca — le lien officiel reste à l'intérieur, une fois ouvert. C'est un
 * <details> et pas un bouton maison : il s'ouvre au clavier, se cherche avec Ctrl+F,
 * et marche même si le JavaScript ne se charge pas.
 */
function rangeeProjet(projet, t, langue, { ouvert = false } = {}) {
  const titre = projet.titre[langue] || projet.titre.en || projet.titre.fr;
  const etape = derniereEtape(projet);
  const statut = statutLisible(projet, langue)
    || (etape ? etapeLisible(etape.nom, langue) : null);
  const rejete = /defeated|rejet/i.test(projet.statut || '');

  // La rangée porte son numéro de projet : c'est par là que « Mon dossier » la retrouve.
  return `        <div class="nb-rangee" data-nb-projet="${projet.numero}">
          <details class="nb-projet-bloc"${ouvert ? ' open' : ''}>
            <summary class="nb-projet">
              <span class="nb-projet-num">${langue === 'en' ? 'No.' : 'Nᵒ'} ${projet.numero}</span>
              <span class="nb-projet-titre">${echapper(titre)}</span>
              ${statut ? `<span class="nb-etape${rejete ? ' rejete' : ''}">${echapper(statut)}</span>` : '<span></span>'}
              <span class="nb-projet-fleche">${CHEVRON}</span>
            </summary>
${detailProjet(projet, t, langue)}
          </details>
          <button class="nb-suivre" type="button" data-nb-suivre="${projet.numero}"
            data-nb-suivre-mots="${echapper(t.suivre)}|${echapper(t.suivi)}"
            aria-pressed="false" title="${echapper(t.suivreTitre(projet.numero))}">${t.suivre}</button>
        </div>`;
}

/**
 * Les projets de loi, en rangées. L'accueil n'en montre que quelques-uns (choix de Martin,
 * 7 novembre 2026) ; la page complète les montre tous.
 */
function sectionProjets(t, langue, limite = null) {
  const tous = [...projetsFichier.projets].sort((a, b) => b.numero - a.numero);
  const projets = limite ? tous.slice(0, limite) : tous;
  const reste = tous.length - projets.length;
  const racine = langue === 'en' ? '/en/' : '/';
  const vers = langue === 'en' ? 'bills' : 'projets-de-loi';
  return `  <section class="nb-section" id="projets">
    <div class="nb-section-tete">
      <h2>${t.projetsTitre}</h2>
      <a class="nb-voir-tout" href="${racine}${vers}">${t.projetsVoir}${reste > 0 ? ` (${tous.length})` : ''}</a>
    </div>
    <p class="nb-section-note">${t.projetsNote}</p>
    <div class="nb-projets">
${projets.map((p) => rangeeProjet(p, t, langue)).join('\n')}
    </div>
  </section>`;
}

/**
 * Agir sur un projet de loi. Le bloc de la maquette, sans son compteur : un compteur
 * citoyen demande une base de données, et des chiffres inventés ne valent rien. Ce qui
 * reste est ce qui sert vraiment — les trois chemins qui ont une valeur officielle.
 */
function sectionAgir(t, langue) {
  const racine = langue === 'en' ? '/en/' : '/';
  const cartes = t.agirChemins.map(([titre, texte, lien, libelle]) => {
    const externe = lien.startsWith('http');
    const adresse = externe ? lien : `${racine}${lien}`;
    return `      <article class="nb-chemin">
        <h3>${titre}</h3>
        <p>${texte}</p>
        <a href="${echapper(adresse)}"${externe ? ' rel="noopener"' : ''}>${libelle}</a>
      </article>`;
  }).join('\n');

  return `  <section class="nb-section nb-agir">
    <p class="nb-surtitre nb-surtitre-rouge">${t.agirSurtitre}</p>
    <div class="nb-section-tete rouge"><h2>${t.agirTitre}</h2></div>
    <p class="nb-agir-intro">${t.agirIntro}</p>
    <div class="nb-chemins">
${cartes}
    </div>
    <p class="nb-section-note">${t.agirCompteur}</p>
  </section>`;
}

/**
 * Les deux cartes de la maquette : suivre des projets, et commanditer une ville. Chacune
 * dit exactement ce qu'elle fait — la première marche, la seconde annonce qu'il n'y a
 * rien à vendre aujourd'hui.
 */
function cartesAppel(t, langue) {
  const racine = langue === 'en' ? '/en/' : '/';
  return `    <article class="nb-appel nb-appel-bleu">
      <p class="nb-surtitre">${t.compteSurtitre}</p>
      <h2>${t.compteTitre}</h2>
      <p>${t.compteTexte}</p>
      <a class="nb-btn nb-btn-jaune" href="${racine}${t.monDossierVers}">${t.compteBtn}</a>
    </article>
    <article class="nb-appel nb-appel-rouge">
      <p class="nb-surtitre">${t.commanditeSurtitre}</p>
      <h2>${t.commanditeTitre}</h2>
      <p>${t.commanditeTexte}</p>
      <p class="nb-appel-avis">${t.commanditeAvis}</p>
    </article>`;
}

/** Le dernier vote nominatif consigné sur un projet de loi, s'il y en a un. */
function dernierVoteDe(numero) {
  const votes = (votesFichier?.votes || [])
    .filter((v) => v.objet?.genre === 'bill' && Number(v.objet.numero) === Number(numero));
  return votes.sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
}

/**
 * Les projets de loi récemment actifs, avec le premier déjà ouvert : son dépôt, son
 * dernier vote nominatif quand il y en a un, et qui l'a déposé. À droite, les deux cartes.
 * Pas de résumé « en clair » tant qu'il n'y en a pas de vrai à montrer.
 */
function sectionRecents(t, langue) {
  const racine = langue === 'en' ? '/en/' : '/';
  const vers = langue === 'en' ? 'bills' : 'projets-de-loi';
  const tous = [...projetsFichier.projets].sort((a, b) => b.numero - a.numero);
  // Le premier est ouvert d'avance : une liste de quatre volets tous fermés ne montre
  // pas ce qu'un clic apporte.
  const rangees = tous.slice(0, 4)
    .map((p, i) => rangeeProjet(p, t, langue, { ouvert: i === 0 }))
    .join('\n');

  return `  <section class="nb-section nb-recents" id="projets">
    <div>
      <div class="nb-section-tete">
        <h2>${t.recentsTitre}</h2>
        <a class="nb-voir-tout" href="${racine}${vers}">${t.projetsVoir} (${tous.length})</a>
      </div>
      <p class="nb-section-note">${t.recentsNote}</p>
      <div class="nb-projets">
${rangees}
      </div>
      <p class="nb-source-officielle">${t.sourceOfficielle}</p>
    </div>
    <aside class="nb-colonne-appels">
${cartesAppel(t, langue)}
    </aside>
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

function pied(t, langue, racine, versAutre = '') {
  const lu = dateLisible((projetsFichier.luLe || '').slice(0, 10), langue);
  const racineAutre = langue === 'en' ? '/' : '/en/';
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
    <a data-nb-autre-langue="${t.autre}" href="${racineAutre}${versAutre}" hreflang="${t.autre}" rel="alternate">${t.autreNom}</a>
  </div>`;
}

/* ─── La coquille, commune à toutes les pages ─────────────────────────────── */

/**
 * L'enveloppe d'une page : le bandeau, l'en-tête, le pied, et les balises de langue.
 * Toutes les pages du site passent par ici, pour que l'en-tête et le pied ne divergent
 * jamais d'une page à l'autre.
 *
 * @param {object} o
 * @param {'fr'|'en'} o.langue
 * @param {string} o.vers      le chemin de la page sans la racine (« » pour l'accueil)
 * @param {string} o.versAutre le même chemin dans l'autre langue
 * @param {string} o.titre     le titre de l'onglet du navigateur
 * @param {string} o.description
 * @param {string} o.corps     le HTML des sections
 */
function coquille({ langue, vers, versAutre, titre, description, corps, horsIndex = false }) {
  const t = T[langue];
  const racine = langue === 'en' ? '/en/' : '/';
  const racineAutre = langue === 'en' ? '/' : '/en/';
  const canonique = `${SITE}${racine}${vers}`;
  const autre = `${SITE}${racineAutre}${versAutre}`;

  const ticker = `  <div class="nb-ticker" aria-hidden="true"><div class="nb-ticker-piste">`
    + `<span><span class="nb-etoile">★</span> ${t.ticker}</span>`.repeat(3)
    + `</div></div>`;

  return `<!DOCTYPE html>
<html lang="${langue}" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titre)}</title>
<meta name="description" content="${echapper(description)}">
${horsIndex ? '<meta name="robots" content="noindex,follow">\n' : ''}<meta name="theme-color" content="#0033a0">
<link rel="canonical" href="${canonique}">
<link rel="alternate" hreflang="${t.autre}" href="${autre}">
<link rel="alternate" hreflang="${langue}" href="${canonique}">
<link rel="alternate" hreflang="x-default" href="${SITE}/${vers}">
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
${entete(t, racine, vers, versAutre)}
${bandeVilles(t)}
${corps}
${pied(t, langue, racine, versAutre)}
</div>
<script src="/commun/nb.js" defer></script>
</body>
</html>
`;
}

/* ─── L'accueil ───────────────────────────────────────────────────────────── */

function page(langue) {
  const t = T[langue];
  const leg = projetsFichier.legislature;
  const ses = projetsFichier.session;
  const racine = langue === 'en' ? '/en/' : '/';

  const chiffres = [
    { valeur: deputesFichier?.sieges ?? '—', libelle: t.chiffreDeputes },
    { valeur: projetsFichier.projets.length, libelle: t.chiffreProjets },
    { valeur: votesFichier?.votes?.length ?? 0, libelle: t.chiffreVotes },
  ];

  return coquille({
    langue,
    vers: '',
    versAutre: '',
    titre: t.titreOnglet,
    description: t.description,
    corps: [
      affiche(t, chiffres, leg, ses),
      avisSeance(t, langue),
      sectionAgir(t, langue),
      // Quatre projets au plus sur l'accueil (choix de Martin, 7 novembre 2026) : la page
      // des projets de loi les montre tous.
      sectionRecents(t, langue),
      sectionActivite(t, langue),
      sectionMission(t),
    ].join('\n'),
  });
}

/* ─── Les pages de section ────────────────────────────────────────────────── */

/** Une tête de section, avec son surtitre rouge et son titre en capitales. */
const teteDeSection = (surtitre, titre, note) => `  <section class="nb-section">
    <p class="nb-surtitre nb-surtitre-rouge">${surtitre}</p>
    <div class="nb-section-tete"><h1>${titre}</h1></div>
    ${note ? `<p class="nb-section-note">${note}</p>` : ''}
  </section>`;

/** La page de tous les projets de loi, avec leurs étapes datées. */
function pageProjets(langue) {
  const t = T[langue];
  const projets = [...projetsFichier.projets].sort((a, b) => b.numero - a.numero);

  const cartes = projets.map((p) => {
    const titre = p.titre[langue] || p.titre.en;
    const parrain = p.parrain;
    const etapes = (p.etapes || []).map((e) => {
      const nom = langue === 'fr' ? (e.nomFr || e.nom) : e.nom;
      const sort = langue === 'fr' ? e.resultatFr : (e.resultat ? e.resultat.en : null);
      const quand = e.date ? dateLisible(e.date, langue) : null;
      return `        <li class="${e.date ? 'faite' : 'a-venir'}">`
        + `<span>${echapper(nom)}</span>`
        + `<span>${quand ? `${sort ? `${echapper(sort)} · ` : ''}${quand}` : '—'}</span></li>`;
    }).join('\n');

    const docs = [];
    if (p.documents?.htmlFr) docs.push(`<a href="${echapper(p.documents.htmlFr)}" rel="noopener">${t.texteFr}</a>`);
    if (p.documents?.htmlEn) docs.push(`<a href="${echapper(p.documents.htmlEn)}" rel="noopener">${t.texteEn}</a>`);
    if (p.documents?.pdfBilingue) docs.push(`<a href="${echapper(p.documents.pdfBilingue)}" rel="noopener">${t.textePdf}</a>`);
    for (const a of p.documents?.amendements || []) {
      docs.push(`<a href="${echapper(a)}" rel="noopener">${t.amendement}</a>`);
    }

    return `      <article class="nb-fiche">
        <header>
          <span class="nb-projet-num">${langue === 'en' ? 'No.' : 'Nᵒ'} ${p.numero}</span>
          <h2>${echapper(titre)}</h2>
          ${(langue === 'fr' ? p.typeFr : p.type) ? `<p class="nb-fiche-type">${echapper(langue === 'fr' ? p.typeFr : p.type)}</p>` : ''}
        </header>
        ${parrain?.nom ? `<p class="nb-fiche-parrain">${t.parrainePar} <b>${echapper(parrain.nom)}</b>`
          + `${parrain.parti ? ` · <span class="nb-parti"${parrain.couleurParti ? ` style="--parti:${echapper(parrain.couleurParti)}"` : ''}>${echapper(parrain.parti)}</span>` : ''}`
          + `${parrain.circonscription ? ` · ${echapper(parrain.circonscription)}` : ''}</p>` : ''}
        <ol class="nb-etapes">
${etapes}
        </ol>
        ${docs.length ? `<p class="nb-fiche-docs">${t.documents} ${docs.join(' · ')}</p>` : ''}
        <p class="nb-fiche-source"><a href="${echapper(p.source?.[langue] || p.source?.en || '#')}" rel="noopener">${t.voirOfficiel}</a></p>
      </article>`;
  }).join('\n');

  return coquille({
    langue,
    vers: langue === 'en' ? 'bills' : 'projets-de-loi',
    versAutre: langue === 'en' ? 'projets-de-loi' : 'bills',
    titre: `${t.projetsTitre} — DossierNBrunswick`,
    description: t.projetsDescription,
    corps: `${teteDeSection(t.surtitreSession(projetsFichier.legislature, projetsFichier.session), t.projetsTitre, t.projetsNote)}
  <section class="nb-section nb-fiches">
${cartes}
  </section>`,
  });
}


/**
 * Les noms ne s'écrivent pas pareil d'une page à l'autre de l'Assemblée : « Hon. Robert
 * MCKEE, K.C. » au bas d'un projet de loi, « Robert McKee » dans la liste des ministres.
 * On compare donc les noms réduits à leurs lettres, sans titre, sans accent et sans casse.
 */
const normaliserNom = (nom) => String(nom ?? '')
  .replace(/^(Hon\.|Mr\.|Ms\.|Mrs\.|Dr\.)\s+/i, '')
  .replace(/,\s*(K\.C\.|Q\.C\.)\.?$/i, '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z]+/g, ' ').trim();

/** Combien de projets de loi chaque personne a déposés cette session. */
const PROJETS_PAR_PARRAIN = (() => {
  const compte = new Map();
  for (const p of projetsFichier.projets) {
    const nom = p.parrain?.nom;
    if (!nom) continue;
    const cle = normaliserNom(nom);
    compte.set(cle, (compte.get(cle) || 0) + 1);
  }
  return compte;
})();

/** L'identifiant d'un ministre : celui que l'Assemblée emploie dans l'adresse de sa fiche. */
const identifiantMinistre = (m) => (m.fiche ? m.fiche.split('/').filter(Boolean).pop() : normaliserNom(m.nomAffiche).replace(/ /g, '-'));

/**
 * Une carte de ministre, dans la forme de DossierQuébec : la pastille du parti, le nom,
 * les portefeuilles, puis les chiffres de la personne. Ce qui n'existe pas au
 * Nouveau-Brunswick n'y figure pas — pas de présence en Chambre, pas de courriel (l'Assemblée
 * le protège derrière un mécanisme anti-robots, et on ne le contourne pas).
 */
function carteMinistre(m, t, langue, { genre = 'ministre' } = {}) {
  const id = identifiantMinistre(m);
  const projets = PROJETS_PAR_PARRAIN.get(normaliserNom(m.nomAffiche)) || 0;

  return `      <article class="nb-carte-ministre" data-nb-${genre}="${echapper(id)}"${m.couleurParti ? ` style="--parti:${echapper(m.couleurParti)}"` : ''}>
        <div class="nb-carte-tete">
          ${m.parti ? `<span class="nb-pastille-parti">${echapper(m.parti)}</span>` : '<span></span>'}
          <button class="nb-suivre" type="button" data-nb-suivre="${echapper(id)}" data-nb-suivre-genre="${genre}"
            data-nb-suivre-mots="${echapper(t.suivre)}|${echapper(t.suivi)}"
            aria-pressed="false" title="${echapper(t.suivreMinistre(m.nomAffiche))}">${t.suivre}</button>
        </div>
        <h2>${echapper(m.nomAffiche)}</h2>
        ${(m.roles || []).length ? `<p class="nb-roles">${m.roles.map((r) => echapper(r)).join(' · ')}</p>` : ''}
        <dl class="nb-carte-donnees">
          <div><dt>${t.ministreCirconscription}</dt><dd>${echapper(m.circonscription || '—')}</dd></div>
          <div><dt>${t.ministreProjets}</dt><dd>${projets}</dd></div>
        </dl>
        ${m.fiche ? `<p class="nb-carte-pied"><a href="${echapper(m.fiche)}" rel="noopener">${t.ministreFiche}</a></p>` : ''}
      </article>`;
}

/**
 * Le Conseil exécutif, puis toute l'Assemblée — une seule page, comme sur DossierQuébec.
 * Les ministres sont aussi des député·e·s : ils reparaissent plus bas, dans leur parti.
 */
function pageMinistres(langue) {
  const t = T[langue];
  const membres = conseilFichier?.membres || [];
  const deputes = deputesFichier?.deputes || [];

  // Le parti le plus nombreux en premier : c'est l'ordre que l'Assemblée elle-même annonce.
  const parPartis = new Map();
  for (const d of deputes) {
    if (!parPartis.has(d.parti)) parPartis.set(d.parti, []);
    parPartis.get(d.parti).push(d);
  }
  const groupes = [...parPartis.entries()].sort((a, b) => b[1].length - a[1].length);

  const assemblee = groupes.map(([parti, gens]) => {
    const couleur = gens[0]?.couleurParti;
    return `  <section class="nb-section">
    <div class="nb-section-tete"${couleur ? ` style="border-bottom-color:${echapper(couleur)}"` : ''}>
      <h3>${echapper(parti)}</h3>
      <span class="nb-compte">${gens.length}</span>
    </div>
    <div class="nb-grille-ministres">
${gens.map((d) => carteMinistre(d, t, langue, { genre: 'depute' })).join('\n')}
    </div>
  </section>`;
  }).join('\n');

  return coquille({
    langue,
    vers: langue === 'en' ? 'ministers' : 'ministres',
    versAutre: langue === 'en' ? 'ministres' : 'ministers',
    titre: `${t.ministresTitre} — DossierNBrunswick`,
    description: t.ministresDescription,
    corps: `${teteDeSection(t.ministresSurtitre(membres.length), t.ministresTitre, t.ministresNote)}
  <section class="nb-section">
    <div class="nb-grille-ministres">
${membres.map((m) => carteMinistre(m, t, langue)).join('\n')}
    </div>
  </section>
  <section class="nb-section" id="assemblee">
    <p class="nb-surtitre nb-surtitre-rouge">${t.deputesSurtitre(deputesFichier?.sieges ?? deputes.length)}</p>
    <div class="nb-section-tete"><h2>${t.deputesTitre}</h2></div>
    <p class="nb-section-note">${t.deputesNote}</p>
  </section>
${assemblee}`,
  });
}

/** Le lexique : le jargon de l'Assemblée, en langage clair. */
function pageLexique(langue) {
  const t = T[langue];
  const entrees = t.lexique.map(([terme, definition]) => `      <div class="nb-terme">
        <dt>${echapper(terme)}</dt>
        <dd>${definition}</dd>
      </div>`).join('\n');

  return coquille({
    langue,
    vers: langue === 'en' ? 'glossary' : 'lexique',
    versAutre: langue === 'en' ? 'lexique' : 'glossary',
    titre: `${t.lexiqueTitre} — DossierNBrunswick`,
    description: t.lexiqueDescription,
    corps: `${teteDeSection(t.lexiqueSurtitre, t.lexiqueTitre, t.lexiqueNote)}
  <section class="nb-section">
    <dl class="nb-lexique">
${entrees}
    </dl>
  </section>`,
  });
}

/**
 * Mon dossier : les projets de loi suivis. Sans compte et sans serveur — la page porte
 * les rangées de tous les projets, et le navigateur masque celles que vous ne suivez pas.
 * Le site ne sait donc rien de ce que vous suivez, et n'a rien à perdre ou à revendre.
 */
function pageMonDossier(langue) {
  const t = T[langue];
  const projets = [...projetsFichier.projets].sort((a, b) => b.numero - a.numero);
  const membres = conseilFichier?.membres || [];
  const racine = langue === 'en' ? '/en/' : '/';
  const vers = langue === 'en' ? 'bills' : 'projets-de-loi';
  const versMinistres = langue === 'en' ? 'ministers' : 'ministres';

  return coquille({
    langue,
    vers: t.monDossierVers,
    versAutre: T[t.autre].monDossierVers,
    titre: `${t.monDossierTitre} — DossierNBrunswick`,
    description: t.monDossierDescription,
    // Une page personnelle, qui ne montre rien à qui n'a rien suivi : elle n'a pas sa
    // place dans l'index d'un moteur, et elle reprendrait la liste des projets de loi.
    horsIndex: true,
    corps: `${teteDeSection(t.monDossierSurtitre, t.monDossierTitre, t.monDossierNote)}
  <section class="nb-section">
    <p class="nb-vide" data-nb-dossier-vide hidden>${t.monDossierVide}</p>
  </section>
  <section class="nb-section" data-nb-bloc-dossier="projet" hidden>
    <div class="nb-section-tete"><h2>${t.monDossierProjets}</h2></div>
    <div class="nb-projets" data-nb-dossier="projet">
${projets.map((p) => rangeeProjet(p, t, langue)).join('\n')}
    </div>
    <p class="nb-carte-pied"><a href="${racine}${vers}">${t.monDossierTous}</a></p>
  </section>
  <section class="nb-section" data-nb-bloc-dossier="ministre" hidden>
    <div class="nb-section-tete"><h2>${t.monDossierMinistres}</h2></div>
    <div class="nb-grille-ministres" data-nb-dossier="ministre">
${membres.map((m) => carteMinistre(m, t, langue)).join('\n')}
    </div>
    <p class="nb-carte-pied"><a href="${racine}${versMinistres}">${t.ministresTitre} →</a></p>
  </section>
  <section class="nb-section" data-nb-bloc-dossier="depute" hidden>
    <div class="nb-section-tete"><h2>${t.monDossierDeputes}</h2></div>
    <div class="nb-grille-ministres" data-nb-dossier="depute">
${(deputesFichier?.deputes || []).map((d) => carteMinistre(d, t, langue, { genre: 'depute' })).join('\n')}
    </div>
    <p class="nb-carte-pied"><a href="${racine}${versMinistres}#assemblee">${t.deputesTitre} →</a></p>
  </section>`,
  });
}

/* ─── Écriture ────────────────────────────────────────────────────────────── */

mkdirSync('en', { recursive: true });

// Chaque page existe dans les deux langues, à une adresse qui se lit dans sa langue :
// /projets-de-loi et /en/bills, /deputes et /en/members. Une adresse est la première
// chose qu'on lit d'une page.
const PAGES = [
  { fr: 'index.html', en: 'en/index.html', faire: page },
  { fr: 'projets-de-loi.html', en: 'en/bills.html', faire: pageProjets },
  { fr: 'ministres.html', en: 'en/ministers.html', faire: pageMinistres },
  { fr: 'lexique.html', en: 'en/glossary.html', faire: pageLexique },
  { fr: 'mon-dossier.html', en: 'en/my-file.html', faire: pageMonDossier, horsSitemap: true },
];

for (const { fr, en, faire } of PAGES) {
  writeFileSync(fr, faire('fr'), 'utf8');
  writeFileSync(en, faire('en'), 'utf8');
}

// Le sitemap que robots.txt annonce. Chaque adresse déclare ses deux langues : c'est comme
// ça qu'un moteur sait que /en/ n'est pas une page concurrente de /, mais la même page dans
// l'autre langue officielle.
// Vercel sert les « URL propres » : /projets-de-loi, sans le .html, et / pour l'accueil.
const adresse = (fichier) => `${SITE}/${fichier.replace(/index\.html$/, '').replace(/\.html$/, '')}`;

const jour = new Date().toISOString().slice(0, 10);
const entrees = [];

for (const { fr, en, horsSitemap } of PAGES) {
  if (horsSitemap) continue;
  // Les deux langues d'une même page se déclarent mutuellement : c'est ainsi qu'un moteur
  // sait que /en/bills n'est pas une page concurrente de /projets-de-loi, mais la même
  // page dans l'autre langue officielle.
  const alternatives = [
    `    <xhtml:link rel="alternate" hreflang="fr" href="${adresse(fr)}"/>`,
    `    <xhtml:link rel="alternate" hreflang="en" href="${adresse(en)}"/>`,
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${adresse(fr)}"/>`,
  ].join('\n');
  for (const page of [fr, en]) {
    entrees.push([
      '  <url>',
      `    <loc>${adresse(page)}</loc>`,
      alternatives,
      `    <lastmod>${jour}</lastmod>`,
      '  </url>',
    ].join('\n'));
  }
}

writeFileSync('sitemap.xml', [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ...entrees,
  '</urlset>',
  '',
].join('\n'), 'utf8');


console.log(`écrit index.html, en/index.html et sitemap.xml`);
console.log(`  ${projetsFichier.projets.length} projets de loi, session ${projetsFichier.legislature}-${projetsFichier.session}`);
console.log(`  ${deputesFichier?.sieges ?? "?"} sièges, ${conseilFichier?.membres?.length ?? "?"} membres du Conseil exécutif`);
console.log(`  ${votesFichier?.votes?.length ?? 0} votes nominatifs`);
console.log(`  prochaine séance : ${calendrierFichier?.prochaineSeance?.date ?? "aucune annoncée"}`);
