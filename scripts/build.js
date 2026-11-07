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
// Les fiches individuelles donnent les fonctions dans les deux langues. Elles sont lues
// une fois par semaine : sans elles, le site se bâtit quand même, en moins riche.
const fichesFichier = lireJson('data/fiches.json');
// Les dépenses payées aux député·e·s, lues dans les tableaux PDF de l'Assemblée.
const financesFichier = lireJson('data/finances.json');

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
    signature: 'Une réalisation de DAFR Solution',
    piedAvis: 'La version imprimée des projets de loi reste la version officielle.',
    luLe: (d) => `Données lues le ${d}.`,
    onglets: [
      { num: '01', nom: 'Aperçu', vers: '' },
      // Les ministres et les député·e·s partagent une page : un seul onglet pour les deux.
      { num: '02', nom: 'Ministres', vers: 'ministres' },
      { num: '03', nom: 'Projets de loi', vers: 'projets-de-loi' },
      { num: '04', nom: 'Lexique', vers: 'lexique' },
    ],
    monDossier: 'Mon dossier', monDossierVers: 'mon-dossier',
    villesPastille: 'Villes',
    villesRepresenter: '+ Repr\u00e9sentez votre ville',
    villesRepresenterVers: 'https://dossierquebec.ca/represente-ta-ville',


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
    deputesSurtitre: (n) => `${n} député·e·s`,
    deputesNote: '<b>Les député·e·s qui ne sont pas ministres.</b> Les membres du Conseil exécutif sont plus haut, avec leurs portefeuilles. Classés par parti, du plus nombreux au moins nombreux. Les courriels ne sont pas repris ici : l\'Assemblée les protège derrière un mécanisme anti-robots, et on ne le contourne pas. Chaque nom mène à sa fiche officielle, qui porte l\'adresse.',
    deputesDescription: 'Les 49 député·e·s de l\'Assemblée législative du Nouveau-Brunswick, par parti et par circonscription.',
    ministresTitre: 'Le Conseil exécutif',
    ministresSousNote: (m, s) => `${m} des ${s} sièges de l'Assemblée. Les ${s - m} autres sont plus bas.`,
    ministresSurtitre: (n) => `${n} ministres`,
    abrevProjets: () => 'PL',
    assembleeTitre: 'Le Conseil exécutif et toute l\'Assemblée',
    assembleeSurtitre: (s, m) => `${s} sièges · ${m} ministres`,
    compositionTitre: (n) => `Composition — ${n} sièges`,
    compositionSurtitre: 'Selon la liste des député·e·s tenue par l\'Assemblée législative',
    ministresSousTitre: 'Les ministres',
    chercheLabel: 'Chercher une personne',
    cherchePlaceholder: 'Nom, circonscription, parti…',
    chercheRien: 'Personne ne correspond à « {q} ».',
    chercheEffacer: 'Effacer',
    ariane: 'Fil d\u2019Ariane', arianeAccueil: 'Accueil',
    ficheResume: (nom, roles, circ, parti) => {
      // Une phrase, faite de ce qu'on sait : ses fonctions, sa circonscription, son parti.
      const quoi = roles.length ? roles.join(', ') : 'd\u00e9put\u00e9\u00b7e';
      // \u00ab du Parti lib\u00e9ral \u00bb : les trois partis du N.-B. s'\u00e9crivent \u00ab Parti\u2026 \u00bb en fran\u00e7ais,
      // donc l'article ne pose pas de probl\u00e8me d'accord.
      return `${nom} est ${quoi}${circ ? `, et repr\u00e9sente la circonscription de ${circ}` : ''}`
        + `${parti ? ` ${/^Parti\b/.test(parti) ? `pour le ${parti}` : `pour ${parti}`}` : ''}.`;
    },
    financesTitre: 'Finances publiques',
    financesExercice: (e) => `Exercice ${e}`,
    financesTotal: 'Total des frais',
    financesBureau: 'Budget du bureau de circonscription',
    financesNote: 'Ce ne sont pas des salaires. L\u2019indemnit\u00e9 de session fait partie de la r\u00e9mun\u00e9ration ; le reste rembourse des frais \u2014 kilom\u00e9trage, avion, comit\u00e9s, d\u00e9placements. Le budget du bureau de circonscription paie un local et son personnel, pas la personne.',
    financesSansFrais: 'Les membres du Conseil ex\u00e9cutif ne figurent pas au tableau des frais de l\u2019Assembl\u00e9e. Seul leur budget de bureau de circonscription y est publi\u00e9.',
    financesAucune: 'L\u2019Assembl\u00e9e ne publie aucun montant pour cette personne \u00e0 cet exercice.',
    financesSource: 'Les tableaux de l\u2019Assembl\u00e9e (PDF bilingues) :',
    financesFrais: 'frais des d\u00e9put\u00e9s', financesCirconscription: 'bureaux de circonscription',
    financesExerciceNote: 'Un exercice commence le 1er avril : celui-ci peut contenir des sommes vers\u00e9es avant la l\u00e9gislature en cours.',
    abrevProjet: 'PL n\u1d52',
    partager: 'Partager', partageCopier: 'Copier l\u2019adresse', partageCopie: 'Adresse copi\u00e9e',
    cheminTitre: 'Le chemin de ce projet de loi', cheminLexique: 'C\u2019est quoi, ces \u00e9tapes ? \u2192 Lexique',
    texteOfficielTitre: 'Le texte officiel',
    texteOfficielNote: 'Les deux versions font \u00e9galement foi. La version imprim\u00e9e par l\u2019Assembl\u00e9e reste la version officielle.',
    projetAucunVote: 'Aucun vote nominatif n\u2019a \u00e9t\u00e9 tenu sur ce projet de loi. Ce n\u2019est pas un signe d\u2019unanimit\u00e9 : au Nouveau-Brunswick, la plupart des projets passent de vive voix, sans que personne soit nomm\u00e9.',
    projetDescription: (n, titre, statut) => `Projet de loi n\u1d52 ${n} \u00e0 l\u2019Assembl\u00e9e l\u00e9gislative du Nouveau-Brunswick : ${titre}.${statut ? ` \u00c9tape : ${statut}.` : ''} Son chemin, son parrain, ses votes nominatifs et ses textes officiels.`,
    session: 'L\u00e9gislature et session',
    lexiqueFamilles: { chemin: 'Le chemin d\u2019un projet', votes: 'Votes', documents: 'Documents', textes: 'Sortes de projets', gens: 'Personnes et droits' },
    ficheEtiquetteMinistre: 'Ministre du Nouveau-Brunswick',
    ficheEtiquetteChef: 'Chef de parti',
    ficheEtiquetteDepute: 'D\u00e9put\u00e9\u00b7e \u00e0 l\u2019Assembl\u00e9e',
    photoCredit: 'Photo : Assembl\u00e9e l\u00e9gislative du Nouveau-Brunswick',
    ficheAucuneFonction: 'Aucune fonction publi\u00e9e par l\u2019Assembl\u00e9e pour cette personne.',
    ficheCoordonnees: 'Coordonn\u00e9es officielles',
    ficheCoordonneesTexte: 'Les adresses courriel des d\u00e9put\u00e9\u00b7e\u00b7s ne sont pas reprises ici : l\u2019Assembl\u00e9e les prot\u00e8ge derri\u00e8re un m\u00e9canisme anti-robots, et on ne le contourne pas. Sa fiche officielle porte l\u2019adresse.',
    fichePresenceAucune: 'Cette personne n\u2019appara\u00eet dans aucun vote nominatif de la session.',
    fichePresenceAvis: 'Un taux bas ne veut pas dire absent par choix : la distance, la maladie ou une fonction officielle expliquent beaucoup d\u2019absences, et le Journal n\u2019en dit jamais la raison. Les votes nominatifs sont rares au Nouveau-Brunswick, et ce taux n\u2019est pas une mesure officielle.',
    ficheRoles: 'Fonctions', ficheParti: 'Parti', ficheProjets: 'Projets de loi déposés cette session',
    projetVotes: 'Votes nominatifs sur ce projet de loi', voteJournal: 'Le Journal de cette séance (PDF) →', ficheAucunProjet: 'Aucun projet de loi déposé cette session.',
    ficheAucunVote: 'Cette personne n\'apparaît dans aucun vote nominatif de la session. Ce n\'est pas une absence : les votes nominatifs sont rares, et la plupart des projets de loi passent de vive voix.',
    ficheVotePour: 'A voté pour', ficheVoteContre: 'A voté contre',
    ficheDescription: (nom, r, c) => `${nom}, ${r}${c ? `, circonscription de ${c}` : ''} : fonctions, circonscription, présence aux votes et projets de loi déposés à l'Assemblée législative du Nouveau-Brunswick.`,
    ficheSansFonction: 'Député·e',
    ficheObjet: (v, langue) => objetLisible(v, langue),
    presenceTitreBoite: 'Lire la présence aux votes',
    presenceLexique: 'Définition complète → Lexique',
    presenceDef: (m, n) => `<b>${m} %</b> : sur les ${n} votes par appel nominal tenus depuis le début de la session, la personne a voté à ${m} % d'entre eux — pour ou contre, peu importe le sens.`,
    presenceVert: 'Vert', presenceJaune: 'Jaune', presenceAucune: 'Sans couleur', presenceND: 'n/d',
    presenceVertTexte: (n, m) => `(${n}) — ${m} % et plus, la médiane de l'Assemblée.`,
    presenceJauneTexte: (n, bas, haut) => `(${n}) — de ${bas} % à ${haut} %, sous la médiane.`,
    presenceAucuneTexte: (n, bas) => `(${n}) — moins de ${bas} %.`,
    presenceNDTexte: (n) => `(${n}) — aucun vote nominatif enregistré pour cette personne. Ce n'est pas une absence : on n'en sait rien.`,
    presencePortee: (n, j, c, bas, haut) => `Chez les ${c} personnes comptées : de ${bas} % à ${haut} %. Le calcul porte sur <b>${n} votes nominatifs</b>, tenus sur ${j} jour${j > 1 ? 's' : ''} de séance.`,
    presenceAvis: [
      '<b>Les votes nominatifs sont rares au Nouveau-Brunswick.</b> La plupart des projets de loi sont adoptés de vive voix, sans que personne soit nommé. Tant que la session en compte peu, ce taux ne mesure presque rien — il se précisera à mesure que les votes s\'accumulent.',
      '<b>La présidence de l\'Assemblée ne vote pas.</b> Elle dirige les débats et reste neutre : son nom ne figure dans aucun vote nominatif, et c\'est normal.',
      '<b>Ce n\'est pas une mesure officielle.</b> L\'Assemblée ne publie aucun taux d\'assiduité. Celui-ci est calculé ici, à partir des noms inscrits dans les Journaux, et un vote manqué n\'en dit jamais la raison.',
    ],
    presenceTitre: (n, total) => `${n} vote${n > 1 ? 's' : ''} sur ${total}`,
    presidenceNeVotePas: 'ne vote pas',
    presidenceInfo: 'La présidence de l\'Assemblée ne vote pas : elle dirige les débats et reste neutre.',
    presidenceLegende: (nom) => `— la présidence de l'Assemblée${nom ? ` (${nom})` : ''} dirige les débats et reste neutre. Son nom ne figure dans aucun vote nominatif, et c'est la règle.`,
    ministreCirconscription: 'Circonscription', ministreProjets: 'Projets de loi déposés',
    ministrePresence: 'Présence aux votes',
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
      ['Première lecture', 'Le dépôt. Le projet de loi est présenté à la Chambre et imprimé. Il n\'est pas encore débattu, et personne ne vote sur son contenu.', 'chemin'],
      ['Deuxième lecture', 'Le débat sur le principe. On discute de l\'idée du projet, pas encore du détail de ses articles. C\'est l\'étape où un projet peut être rejeté d\'un coup.', 'chemin'],
      ['Étude en comité', 'L\'examen article par article, par un comité de député·e·s. C\'est là que le texte peut être amendé. Au Nouveau-Brunswick, un projet d\'intérêt privé passe en comité <b>avant</b> sa deuxième lecture : l\'ordre n\'est pas toujours le même.', 'chemin'],
      ['Troisième lecture', 'Le dernier vote de la Chambre. Après, le texte ne change plus.', 'chemin'],
      ['Sanction royale', 'La signature de la lieutenante-gouverneure, qui fait du projet une loi. <b>Attention :</b> une loi sanctionnée n\'est pas forcément en vigueur — beaucoup attendent une proclamation, parfois des mois plus tard.', 'chemin'],
      ['Projet de loi d\'initiative ministérielle', 'Un projet déposé par un ou une ministre, au nom du gouvernement. C\'est la grande majorité des projets adoptés.', 'textes'],
      ['Projet de loi d\'intérêt public et d\'initiative parlementaire', 'Un projet déposé par un·e député·e qui n\'est pas ministre. Il aboutit rarement.', 'textes'],
      ['Projet de loi d\'intérêt privé', 'Un projet qui vise une personne, une entreprise ou un organisme précis — par exemple modifier la loi constitutive d\'une université ou d\'un ordre professionnel.', 'textes'],
      ['Vote nominatif', 'Un vote où le nom de chaque député·e est inscrit au Journal. Ils sont <b>rares</b> : la plupart des projets de loi sont adoptés de vive voix, sans que les positions individuelles soient consignées. L\'absence de vote nominatif ne veut donc pas dire « unanime ».', 'votes'],
      ['Journal', 'Le compte rendu officiel des décisions de la Chambre, publié chaque jour de séance. C\'est le seul endroit où figurent les votes nominatifs du Nouveau-Brunswick.', 'documents'],
      ['Hansard', 'Le compte rendu des débats, mot à mot. Il paraît plusieurs mois après la séance.', 'documents'],
      ['Feuilleton', 'L\'ordre du jour de la Chambre : ce qui est à l\'étude et dans quel ordre.', 'documents'],
      ['Pétition', 'Au Nouveau-Brunswick, une pétition est <b>sur papier</b>, signée à la main, et ne peut être déposée que par un·e député·e. Il n\'existe pas de pétition en ligne. Le ministre doit répondre par écrit dans les deux semaines, mais cette réponse n\'est pas publiée.', 'gens'],
      ['Présidence de l\'Assemblée', 'La personne qui préside les séances. Elle <b>ne vote pas</b> : un vote nominatif ne dépasse donc jamais 48 voix sur 49 sièges.', 'gens'],
      ['Session', 'Une période de travaux. Chaque nouvelle session renumérote les projets de loi à partir de 1 — un même numéro désigne donc des projets différents d\'une session à l\'autre.', 'chemin'],
      ['Présence aux votes', 'La part des votes nominatifs de la session où le nom d\'une personne est inscrit au Journal, pour ou contre. Ce <b>n\'est pas une mesure officielle</b> : l\'Assemblée n\'en publie aucune, et celle-ci est calculée ici. Elle dit peu de chose tant que la session compte peu de votes nominatifs — et comme ils sont rares au Nouveau-Brunswick, c\'est souvent le cas. « n/d » veut dire qu\'aucun vote nominatif n\'a enregistré cette personne : ce n\'est pas une absence, c\'est une absence d\'information. La présidence de l\'Assemblée, elle, ne vote jamais.', 'votes'],
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
    signature: 'A project by DAFR Solution',
    piedAvis: 'The printed version of a bill remains the official version.',
    luLe: (d) => `Data read on ${d}.`,
    onglets: [
      { num: '01', nom: 'Overview', vers: '' },
      { num: '02', nom: 'Ministers', vers: 'ministers' },
      { num: '03', nom: 'Bills', vers: 'bills' },
      { num: '04', nom: 'Glossary', vers: 'glossary' },
    ],
    monDossier: 'My file', monDossierVers: 'my-file',
    villesPastille: 'Cities',
    villesRepresenter: '+ Represent your city',
    villesRepresenterVers: 'https://dossierquebec.ca/represente-ta-ville?lang=en',


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
    deputesSurtitre: (n) => `${n} members`,
    deputesNote: '<b>The members who are not ministers.</b> Members of the Executive Council are above, with their portfolios. Grouped by party, largest first. Email addresses are not repeated here: the Assembly protects them behind an anti-robot mechanism, and we do not work around it. Each name links to the official page, which carries the address.',
    deputesDescription: 'The 49 members of the Legislative Assembly of New Brunswick, by party and riding.',
    ministresTitre: 'The Executive Council',
    ministresSousNote: (m, s) => `${m} of the Assembly's ${s} seats. The other ${s - m} are below.`,
    ministresSurtitre: (n) => `${n} ministers`,
    abrevProjets: (n) => (n === 1 ? 'bill' : 'bills'),
    assembleeTitre: 'The Executive Council and the whole Assembly',
    assembleeSurtitre: (s, m) => `${s} seats · ${m} ministers`,
    compositionTitre: (n) => `Composition — ${n} seats`,
    compositionSurtitre: 'From the list of members kept by the Legislative Assembly',
    ministresSousTitre: 'The ministers',
    chercheLabel: 'Find a person',
    cherchePlaceholder: 'Name, riding, party…',
    chercheRien: 'Nobody matches “{q}”.',
    chercheEffacer: 'Clear',
    ariane: 'Breadcrumb', arianeAccueil: 'Home',
    ficheResume: (nom, roles, circ, parti) => {
      const quoi = roles.length ? roles.join(', ') : 'a member';
      return `${nom} is ${quoi}${circ ? `, and represents the riding of ${circ}` : ''}${parti ? ` for the ${parti}` : ''}.`;
    },
    financesTitre: 'Public finances',
    financesExercice: (e) => `Fiscal year ${e}`,
    financesTotal: 'Total expenses',
    financesBureau: 'Constituency office budget',
    financesNote: 'These are not salaries. The sessional allowance is part of the pay; the rest reimburses costs \u2014 mileage, air fare, committees, travel. The constituency office budget pays for an office and its staff, not the person.',
    financesSansFrais: 'Members of the Executive Council do not appear in the Assembly\u2019s expense table. Only their constituency office budget is published there.',
    financesAucune: 'The Assembly publishes no amount for this person in this fiscal year.',
    financesSource: 'The Assembly\u2019s tables (bilingual PDFs):',
    financesFrais: 'members\u2019 expenses', financesCirconscription: 'constituency offices',
    financesExerciceNote: 'A fiscal year starts on 1 April: this one may hold amounts paid before the current legislature.',
    abrevProjet: 'Bill',
    partager: 'Share', partageCopier: 'Copy the link', partageCopie: 'Link copied',
    cheminTitre: 'This bill\u2019s path', cheminLexique: 'What are these stages? \u2192 Glossary',
    texteOfficielTitre: 'The official text',
    texteOfficielNote: 'Both versions are equally authoritative. The version printed by the Assembly remains the official one.',
    projetAucunVote: 'No recorded division was held on this bill. That is not a sign of unanimity: in New Brunswick most bills pass on a voice vote, with nobody named.',
    projetDescription: (n, titre, statut) => `Bill ${n} in the Legislative Assembly of New Brunswick: ${titre}.${statut ? ` Stage: ${statut}.` : ''} Its path, its sponsor, its recorded divisions and its official texts.`,
    session: 'Legislature and session',
    lexiqueFamilles: { chemin: 'A bill\u2019s path', votes: 'Votes', documents: 'Documents', textes: 'Kinds of bills', gens: 'People and rights' },
    ficheEtiquetteMinistre: 'Minister of New Brunswick',
    ficheEtiquetteChef: 'Party leader',
    ficheEtiquetteDepute: 'Member of the Assembly',
    photoCredit: 'Photo: Legislative Assembly of New Brunswick',
    ficheAucuneFonction: 'The Assembly publishes no office for this person.',
    ficheCoordonnees: 'Official contact',
    ficheCoordonneesTexte: 'Members\u2019 email addresses are not repeated here: the Assembly protects them behind an anti-robot mechanism, and we do not work around it. Their official page carries the address.',
    fichePresenceAucune: 'This person appears in no recorded division of the session.',
    fichePresenceAvis: 'A low rate does not mean absent by choice: distance, illness or an official duty account for many absences, and the Journal never says why. Recorded divisions are rare in New Brunswick, and this rate is not an official measure.',
    ficheRoles: 'Offices', ficheParti: 'Party', ficheProjets: 'Bills introduced this session',
    projetVotes: 'Recorded divisions on this bill', voteJournal: 'The Journal of that sitting (PDF) →', ficheAucunProjet: 'No bill introduced this session.',
    ficheAucunVote: 'This person appears in no recorded division of the session. That is not an absence: recorded divisions are rare, and most bills pass on a voice vote.',
    ficheVotePour: 'Voted yea', ficheVoteContre: 'Voted nay',
    ficheDescription: (nom, r, c) => `${nom}, ${r}${c ? `, riding of ${c}` : ''}: offices, riding, vote attendance and bills introduced in the Legislative Assembly of New Brunswick.`,
    ficheSansFonction: 'Member',
    ficheObjet: (v, langue) => objetLisible(v, langue),
    presenceTitreBoite: 'Reading the vote attendance',
    presenceLexique: 'Full definition → Glossary',
    presenceDef: (m, n) => `<b>${m} %</b>: of the ${n} recorded divisions held since the session opened, this person voted in ${m} % of them — yea or nay, whichever way.`,
    presenceVert: 'Green', presenceJaune: 'Yellow', presenceAucune: 'No colour', presenceND: 'n/a',
    presenceVertTexte: (n, m) => `(${n}) — ${m} % and above, the Assembly's median.`,
    presenceJauneTexte: (n, bas, haut) => `(${n}) — from ${bas} % to ${haut} %, below the median.`,
    presenceAucuneTexte: (n, bas) => `(${n}) — under ${bas} %.`,
    presenceNDTexte: (n) => `(${n}) — no recorded division on file for this person. That is not an absence: we simply do not know.`,
    presencePortee: (n, j, c, bas, haut) => `Among the ${c} people counted: from ${bas} % to ${haut} %. The figure rests on <b>${n} recorded divisions</b>, held over ${j} sitting day${j > 1 ? 's' : ''}.`,
    presenceAvis: [
      '<b>Recorded divisions are rare in New Brunswick.</b> Most bills pass on a voice vote, with nobody named. While a session holds only a few, this rate measures almost nothing — it sharpens as divisions pile up.',
      '<b>The Speaker does not vote.</b> The Speaker chairs the House and stays neutral: that name appears in no recorded division, and that is as it should be.',
      '<b>This is not an official measure.</b> The Assembly publishes no attendance rate. This one is worked out here, from the names printed in the Journals, and a missed vote never says why.',
    ],
    presenceTitre: (n, total) => `${n} of ${total} divisions`,
    presidenceNeVotePas: 'does not vote',
    presidenceInfo: 'The Speaker does not vote: the Speaker chairs the House and stays neutral.',
    presidenceLegende: (nom) => `— the Speaker of the House${nom ? ` (${nom})` : ''} chairs the sittings and stays neutral. That name appears in no recorded division, and that is the rule.`,
    ministreCirconscription: 'Riding', ministreProjets: 'Bills introduced',
    ministrePresence: 'Vote attendance',
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
      ['First reading', 'The tabling. The bill is introduced and printed. It is not debated yet, and nobody votes on its content.', 'chemin'],
      ['Second reading', 'The debate on the principle. The House discusses the idea of the bill, not yet its clauses. This is the stage where a bill can be defeated outright.', 'chemin'],
      ['Committee', 'Clause-by-clause study by a committee of members. This is where the text can be amended. In New Brunswick a private bill goes to committee <b>before</b> its second reading: the order is not always the same.', 'chemin'],
      ['Third reading', 'The House\'s final vote. After it, the text no longer changes.', 'chemin'],
      ['Royal assent', 'The Lieutenant-Governor\'s signature, which turns a bill into an Act. <b>Careful:</b> an Act that has received assent is not necessarily in force — many wait on a proclamation, sometimes months later.', 'chemin'],
      ['Government bill', 'A bill introduced by a minister, on behalf of the government. These are the vast majority of bills that pass.', 'textes'],
      ['Private member\'s public bill', 'A bill introduced by a member who is not a minister. It rarely becomes law.', 'textes'],
      ['Private bill', 'A bill aimed at one person, company or body — amending a university\'s founding Act, for instance, or a professional association\'s.', 'textes'],
      ['Recorded division', 'A vote where every member\'s name is entered in the Journal. They are <b>rare</b>: most bills pass on a voice vote, with no individual positions recorded. No recorded vote therefore does not mean "unanimous".', 'votes'],
      ['Journal', 'The official record of the decisions of the House, published each sitting day. It is the only place New Brunswick\'s recorded votes appear.', 'documents'],
      ['Hansard', 'The word-for-word record of debate. It appears several months after the sitting.', 'documents'],
      ['Order paper', 'The agenda of the House: what is before it, and in what order.', 'documents'],
      ['Petition', 'In New Brunswick a petition is <b>on paper</b>, signed by hand, and can only be presented by a member. There is no online petition system. A minister must reply in writing within two weeks, but that reply is not published.', 'gens'],
      ['Speaker', 'The member who presides over sittings. The Speaker <b>does not vote</b>: a recorded division therefore never exceeds 48 of the 49 seats.', 'gens'],
      ['Session', 'A period of business. Every new session renumbers bills from 1 — the same number means different bills in different sessions.', 'chemin'],
      ['Vote attendance', 'The share of the session\'s recorded divisions in which a person\'s name is entered in the Journal, yea or nay. It is <b>not an official measure</b>: the Assembly publishes none, and this one is worked out here. It says little while a session holds few recorded divisions — and since they are rare in New Brunswick, that is often the case. "n/a" means no recorded division has this person on file: that is missing information, not an absence. The Speaker never votes.', 'votes'],
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
    <details class="nb-villes">
      <summary>${t.villesPastille}<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 9l6 6 6-6"/></svg></summary>
      <div class="nb-villes-menu">
        <a href="${t.villesRepresenterVers}" rel="noopener">${t.villesRepresenter}</a>
      </div>
    </details>
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
                ${chiffres.length ? '<br>' : ''}<a href="${langue === 'en' ? '/en/bills/' : '/projets-de-loi/'}${slugProjet(projet)}">${t.ouvrirFiche}</a></p>
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
    <article class="nb-appel nb-appel-rouge" id="commandite">
      <p class="nb-surtitre">${t.commanditeSurtitre}</p>
      <h2>${t.commanditeTitre}</h2>
      <p>${t.commanditeTexte}</p>
      <p class="nb-appel-avis">${t.commanditeAvis}</p>
    </article>`;
}

/** Ce sur quoi portait un vote, en une phrase. */
function objetLisible(vote, langue) {
  const o = vote.objet || {};
  const quoi = o.genre === 'bill'
    ? (langue === 'en' ? `Bill ${o.numero}` : `le projet de loi nᵒ ${o.numero}`)
    : o.genre === 'motion'
      ? (langue === 'en' ? `Motion ${o.numero}` : `la motion nᵒ ${o.numero}`)
      : (langue === 'en' ? 'a question before the House' : 'une question soumise à la Chambre');
  const amend = o.surAmendement
    ? (langue === 'en' ? ' (on an amendment)' : ' (sur un amendement)')
    : '';
  return `${quoi}${amend}`;
}

/** Tous les votes nominatifs tenus sur un projet de loi, du plus récent au plus ancien. */
function votesDuProjet(numero) {
  return (votesFichier?.votes || [])
    .filter((v) => v.objet?.genre === 'bill' && Number(v.objet.numero) === Number(numero))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Le dernier vote nominatif consigné sur un projet de loi, s'il y en a un. */
function dernierVoteDe(numero) {
  return votesDuProjet(numero)[0] || null;
}

/**
 * Qui a voté quoi sur un projet de loi. C'est la place de cette information : un vote
 * appartient au texte sur lequel il porte, pas à la fiche de chaque personne.
 *
 * Les Journaux n'écrivent qu'un nom de famille — « Ms. S. Wilson ». On montre le nom
 * complet quand le rapprochement est sûr, et la graphie du Journal sinon : jamais une
 * personne nommée au hasard.
 */
function blocVotes(projet, t, langue) {
  const votes = votesDuProjet(projet.numero);
  if (!votes.length) return '';

  const nomComplet = (brut) => {
    const d = PRESENCE_AUX_VOTES.personneDuJournal(brut);
    return d ? lienPersonne(d, t, langue) : echapper(brut);
  };

  return votes.map((v) => `        <div class="nb-vote">
          <p class="nb-vote-tete">
            <time datetime="${v.date}">${dateLisible(v.date, langue)}</time>
            <span>${objetLisible(v, langue)}</span>
            <span class="nb-vote-score"><b class="pour">${v.pour.total}</b> ${t.pour} · <b class="contre">${v.contre.total}</b> ${t.contre}</span>
          </p>
          <div class="nb-camps">
            <div class="nb-camp pour">
              <p>${t.ficheVotePour}</p>
              <ul>${(v.pour.noms || []).map((n) => `<li>${nomComplet(n)}</li>`).join('')}</ul>
            </div>
            <div class="nb-camp contre">
              <p>${t.ficheVoteContre}</p>
              <ul>${(v.contre.noms || []).map((n) => `<li>${nomComplet(n)}</li>`).join('')}</ul>
            </div>
          </div>
          <p class="nb-vote-source"><a href="${echapper(v.journal)}" rel="noopener">${t.voteJournal}</a></p>
        </div>`).join('\n');
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
    <a href="https://dafrsolution.com" rel="noopener">${t.signature}</a>
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
        ${(() => {
          const votes = blocVotes(p, t, langue);
          return votes ? `<div class="nb-fiche-votes">
        <p class="nb-fiche-votes-titre">${t.projetVotes}</p>
${votes}
        </div>` : '';
        })()}
        ${docs.length ? `<p class="nb-fiche-docs">${t.documents} ${docs.join(' · ')}</p>` : ''}
        <p class="nb-fiche-source"><a href="${langue === 'en' ? '/en/bills/' : '/projets-de-loi/'}${slugProjet(p)}">${t.ouvrirFiche}</a>
          · <a href="${echapper(p.source?.[langue] || p.source?.en || '#')}" rel="noopener">${t.voirOfficiel}</a></p>
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

/**
 * La présence aux votes nominatifs, personne par personne.
 *
 * LE PROBLÈME : les Journaux du Nouveau-Brunswick n'inscrivent que le nom de famille —
 * « Ms. S. Wilson », « Mr. J. LeBlanc ». Quatre noms de famille sont portés par deux
 * député·e·s (Chiasson, Johnson, LeBlanc, Wilson), et c'est l'initiale du Journal qui les
 * départage. Quand elle ne suffirait pas, on n'attribue RIEN : un vote mal attribué ferait
 * dire à quelqu'un le contraire de ce qu'il a fait. Le build échoue alors, pour que ça se voie.
 *
 * CE QUE LE TAUX NE DIT PAS : les votes nominatifs sont rares ici. La plupart des projets
 * de loi passent de vive voix, sans que personne soit nommé. Une personne qui n'apparaît
 * dans aucun vote n'est donc pas « absente » : on n'en sait rien, et la page écrit « n/d ».
 * La présidence de l'Assemblée, elle, ne vote jamais.
 */
const PRESENCE_AUX_VOTES = (() => {
  const votes = votesFichier?.votes || [];
  const deputes = deputesFichier?.deputes || [];
  const total = votes.length;

  const sansAccent = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const famille = (d) => sansAccent((d.nomOfficiel || '').split(',')[0] || d.nomAffiche.split(' ').pop()).replace(/[^a-z]/g, '');
  const prenom = (d) => sansAccent((d.nomOfficiel || '').split(',')[1] || d.nomAffiche.split(' ')[0]).trim();

  const presents = new Map();
  const positions = new Map();   // qui a voté quoi, division par division
  for (const vote of votes) {
    for (const [sens, noms] of [['pour', vote.pour?.noms || []], ['contre', vote.contre?.noms || []]]) {
    for (const brut of noms) {
      const m = brut.match(/^(?:Hon\.\s+)?(?:Mr|Ms|Mrs)\.\s+(?:([A-ZÀ-Ÿ])\.\s+)?(.+)$/);
      if (!m) throw new Error(`vote du ${vote.date} : « ${brut} » n'a pas la forme d'un nom de votant.`);
      const initiale = m[1] ? sansAccent(m[1]) : null;
      const nom = sansAccent(m[2]).replace(/[^a-z]/g, '');
      let candidats = deputes.filter((d) => famille(d) === nom);
      if (initiale) candidats = candidats.filter((d) => prenom(d).startsWith(initiale));
      if (candidats.length !== 1) {
        throw new Error(
          `vote du ${vote.date} : « ${brut} » correspond à ${candidats.length} député·e·s. `
          + 'Rien n\'est publié : un vote attribué au hasard ferait dire à quelqu\'un le contraire '
          + 'de ce qu\'il a voté.'
        );
      }
      const cle = sansAccent(candidats[0].nomAffiche).replace(/[^a-z]/g, '');
      presents.set(cle, (presents.get(cle) || 0) + 1);
      if (!positions.has(cle)) positions.set(cle, []);
      positions.get(cle).push({ vote, sens });
    }
    }
  }

  const taux = [...presents.values()].map((n) => Math.round((n / total) * 100)).sort((a, b) => a - b);
  const mediane = taux.length
    ? (taux.length % 2 ? taux[(taux.length - 1) / 2] : Math.round((taux[taux.length / 2 - 1] + taux[taux.length / 2]) / 2))
    : null;

  const couleur = (t) => (t >= mediane ? 'vert' : t >= mediane - 6 ? 'jaune' : 'aucune');
  const compte = { vert: 0, jaune: 0, aucune: 0 };
  for (const t of taux) compte[couleur(t)] += 1;

  return {
    total,
    seances: new Set(votes.map((v) => v.date)).size,
    mediane,
    plancher: taux[0] ?? null,
    plafond: taux[taux.length - 1] ?? null,
    comptes: taux.length,
    sansDonnee: deputes.length - presents.size,
    compte,
    // La clé est le nom réduit à ses lettres : la page du Conseil exécutif et celle des
    // député·e·s n'écrivent pas toujours un nom pareil, et un ministre est un·e député·e.
    de(personne) {
      const n = presents.get(sansAccent(personne.nomAffiche).replace(/[^a-z]/g, ''));
      if (n === undefined || !total) return null;
      const t = Math.round((n / total) * 100);
      return { votes: n, total, taux: t, couleur: couleur(t) };
    },
    /** Division par division : ce que cette personne a voté, et quand. */
    positionsDe(personne) {
      return positions.get(sansAccent(personne.nomAffiche).replace(/[^a-z]/g, '')) || [];
    },
    /** La personne derrière un nom de Journal (« Ms. S. Wilson »), ou rien si c'est douteux. */
    personneDuJournal(brut) {
      const m = String(brut).match(/^(?:Hon\.\s+)?(?:Mr|Ms|Mrs)\.\s+(?:([A-ZÀ-Ÿ])\.\s+)?(.+)$/);
      if (!m) return null;
      const initiale = m[1] ? sansAccent(m[1]) : null;
      const nom = sansAccent(m[2]).replace(/[^a-z]/g, '');
      let candidats = deputes.filter((d) => famille(d) === nom);
      if (initiale) candidats = candidats.filter((d) => prenom(d).startsWith(initiale));
      return candidats.length === 1 ? candidats[0] : null;
    },
  };
})();

/**
 * Ce sur quoi la recherche d'une personne porte : son nom, sa circonscription, son parti
 * et ses portefeuilles. Sans accents ni majuscules — on cherche « theriault » et on trouve
 * « Thériault ». Les étiquettes de la page n'y sont pas : chercher « présence » ne doit pas
 * ramener les 49 personnes.
 */
/**
 * Le nom d'une personne : un lien vers sa page quand elle en a une, du texte sinon. On ne
 * fabrique pas de lien vers une page qui n'existe pas — c'est la règle du site.
 */
function lienPersonne(p, t, langue) {
  const nom = echapper(p.nomAffiche);
  if (!A_UNE_PAGE.has(normaliserNom(p.nomAffiche))) return nom;
  const racine = langue === 'en' ? '/en/ministers/' : '/ministres/';
  return `<a href="${racine}${slugPersonne(p.nomAffiche)}">${nom}</a>`;
}

const motsDeRecherche = (p) => {
  // Une personne enrichie porte ses libellés dans les deux langues ({ fr, en }) ; une
  // personne brute n'en a qu'un. On cherche dans tout ce qui existe : quelqu'un qui tape
  // « justice » doit trouver le ministre, que la page soit en français ou en anglais.
  const plat = (v) => (v == null ? [] : Array.isArray(v) ? v.flatMap(plat) : typeof v === 'object' ? Object.values(v).flatMap(plat) : [String(v)]);
  return [p.nomAffiche, ...plat(p.circonscription), ...plat(p.parti), ...plat(p.roles)]
    .filter(Boolean).join(' ')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase();
};

/** L'identifiant d'un ministre : celui que l'Assemblée emploie dans l'adresse de sa fiche. */
const identifiantMinistre = (m) => {
  // Une personne enrichie porte sa fiche dans les deux langues ; une personne brute n'a
  // que l'anglaise. L'identifiant suit toujours l'adresse anglaise, pour qu'un suivi
  // gardé en français se retrouve en anglais.
  const fiche = typeof m.fiche === 'string' ? m.fiche : m.fiche?.en || m.fiche?.fr || null;
  return fiche ? fiche.split('/').filter(Boolean).pop() : normaliserNom(m.nomAffiche).replace(/ /g, '-');
};

/**
 * Une carte de ministre, dans la forme de DossierQuébec : la pastille du parti, le nom,
 * les portefeuilles, puis les chiffres de la personne. Ce qui n'existe pas au
 * Nouveau-Brunswick n'y figure pas — pas de présence en Chambre, pas de courriel (l'Assemblée
 * le protège derrière un mécanisme anti-robots, et on ne le contourne pas).
 */
function carteMinistre(brut, t, langue, { genre = 'ministre' } = {}) {
  const m = enrichir(brut);
  const roles = m.roles?.[langue] || m.roles?.en || m.roles || [];
  // Le test de la présidence porte sur l'anglais : il ne bouge pas, et il évite de
  // dépendre d'une apostrophe typographique côté français.
  const rolesOfficiels = m.roles?.en || m.roles || [];
  const parti = m.parti?.[langue] || m.parti || null;
  const circonscription = m.circonscription?.[langue] || m.circonscription || null;
  const id = identifiantMinistre(brut);
  const projets = PROJETS_PAR_PARRAIN.get(normaliserNom(m.nomAffiche)) || 0;
  const presence = PRESENCE_AUX_VOTES.de(m);
  const ficheOfficielle = m.fiche?.[langue] || m.fiche?.en || m.fiche || null;

  return `      <article class="nb-carte-ministre" data-nb-${genre}="${echapper(id)}" data-nb-chercher="${echapper(motsDeRecherche(m))}"${m.couleurParti ? ` style="--parti:${echapper(m.couleurParti)}"` : ''}>
        <div class="nb-carte-tete">
          ${parti ? `<span class="nb-pastille-parti">${echapper(parti)}</span>` : '<span></span>'}
          <button class="nb-suivre" type="button" data-nb-suivre="${echapper(id)}" data-nb-suivre-genre="${genre}"
            data-nb-suivre-mots="${echapper(t.suivre)}|${echapper(t.suivi)}"
            aria-pressed="false" title="${echapper(t.suivreMinistre(m.nomAffiche))}">${t.suivre}</button>
        </div>
        <h2>${lienPersonne(m, t, langue)}${m.titre ? `<span class="nb-titre">${echapper(m.titre)}</span>` : ''}</h2>
        ${roles.length ? `<p class="nb-roles">${roles.map((r) => echapper(r)).join(' · ')}</p>` : ''}
        <dl class="nb-carte-donnees">
          <div><dt>${t.ministreCirconscription}</dt><dd>${echapper(circonscription || '—')}</dd></div>
          <div><dt>${t.ministreProjets}</dt><dd>${projets}</dd></div>
          <div><dt>${t.ministrePresence}</dt><dd>${presence
            ? `<span class="nb-taux ${presence.couleur}" title="${echapper(t.presenceTitre(presence.votes, presence.total))}">${presence.taux} %</span>`
            : estPresidence(rolesOfficiels)
              ? `<span class="nb-taux preside" title="${echapper(t.presidenceInfo)}">${t.presidenceNeVotePas}</span>`
              : `<span class="nb-taux nd">${t.presenceND}</span>`}</dd></div>
        </dl>
        ${ficheOfficielle ? `<p class="nb-carte-pied"><a href="${echapper(ficheOfficielle)}" rel="noopener">${t.ministreFiche}</a></p>` : ''}
      </article>`;
}

/**
 * Une ligne de député·e. Les ministres ont des boîtes, l'Assemblée a des lignes : c'est la
 * forme de DossierQuébec, et elle tient : 49 cartes feraient défiler une page entière.
 */
function ligneDepute(brut, t, langue) {
  const d = enrichir(brut);
  const roles = d.roles?.[langue] || d.roles?.en || d.roles || [];
  const rolesOfficiels = d.roles?.en || d.roles || [];
  const circonscription = d.circonscription?.[langue] || d.circonscription || null;
  const id = identifiantMinistre(brut);
  const projets = PROJETS_PAR_PARRAIN.get(normaliserNom(d.nomAffiche)) || 0;
  const presence = PRESENCE_AUX_VOTES.de(d);

  return `      <div class="nb-ligne-depute" data-nb-depute="${echapper(id)}" data-nb-chercher="${echapper(motsDeRecherche(d))}"${d.couleurParti ? ` style="--parti:${echapper(d.couleurParti)}"` : ''}>
        <p class="nb-ligne-nom"><b>${lienPersonne(d, t, langue)}${d.titre ? `<span class="nb-titre">${echapper(d.titre)}</span>` : ''}</b>
          <span>${echapper(circonscription || '')}${roles.length ? ` · <em>${echapper(roles.join(' · '))}</em>` : ''}</span></p>
        <p class="nb-ligne-chiffres">
          ${presence
            ? `<span class="nb-taux ${presence.couleur}" title="${echapper(t.presenceTitre(presence.votes, presence.total))}">${presence.taux} %</span>`
            : estPresidence(rolesOfficiels)
              ? `<span class="nb-taux preside" title="${echapper(t.presidenceInfo)}">${t.presidenceNeVotePas}</span>`
              : `<span class="nb-taux nd">${t.presenceND}</span>`}
          <span class="nb-ligne-pl">${projets} ${t.abrevProjets(projets)}</span>
        </p>
        <p class="nb-ligne-liens"><a href="${echapper(d.fiche || '#')}" rel="noopener">${t.ministreFiche}</a></p>
        <button class="nb-suivre" type="button" data-nb-suivre="${echapper(id)}" data-nb-suivre-genre="depute"
          data-nb-suivre-mots="${echapper(t.suivre)}|${echapper(t.suivi)}"
          aria-pressed="false" title="${echapper(t.suivreMinistre(d.nomAffiche))}">${t.suivre}</button>
      </div>`;
}

/**
 * La composition de l'Assemblée : une barre à l'échelle des sièges, puis la pastille de
 * chaque parti avec son compte. Rien n'est arrondi — les largeurs sont le nombre de sièges
 * sur le total, et les comptes sont ceux de la liste officielle.
 */
function sectionComposition(t, groupes, sieges) {
  if (!groupes.length) return '';
  const total = groupes.reduce((n, [, gens]) => n + gens.length, 0) || 1;

  return `  <section class="nb-section">
    <p class="nb-surtitre nb-surtitre-rouge">${t.compositionSurtitre}</p>
    <div class="nb-section-tete"><h2>${t.compositionTitre(sieges)}</h2></div>
    <div class="nb-barre-sieges" role="img" aria-label="${echapper(groupes.map(([p, g]) => `${p} ${g.length}`).join(', '))}">
${groupes.map(([parti, gens]) => `      <i style="width:${(gens.length / total) * 100}%;background:${echapper(gens[0]?.couleurParti || 'var(--ink3)')}" title="${echapper(parti)} — ${gens.length}"></i>`).join('\n')}
    </div>
    <ul class="nb-legende-partis">
${groupes.map(([parti, gens]) => `      <li><i style="background:${echapper(gens[0]?.couleurParti || 'var(--ink3)')}"></i>${echapper(parti)} — <b>${gens.length}</b></li>`).join('\n')}
    </ul>
  </section>`;
}

/**
 * L'encadré qui explique le taux, en haut de l'Assemblée — comme sur DossierQuébec. Il porte
 * les vrais chiffres de la session, et dit franchement ce que le taux ne mesure pas.
 */
function encadrePresence(t) {
  const p = PRESENCE_AUX_VOTES;
  if (!p.total) return '';
  const mediane = p.mediane ?? 0;
  return `  <section class="nb-section">
    <div class="nb-encadre">
      <div class="nb-encadre-tete">
        <h3>${t.presenceTitreBoite}</h3>
        <a class="nb-voir-tout" href="${t.langue === 'en' ? '/en/glossary' : '/lexique'}">${t.presenceLexique}</a>
      </div>
      <p class="nb-encadre-def">${t.presenceDef(mediane, p.total)}</p>
      <div class="nb-echelle" aria-hidden="true">
        <span class="nb-echelle-barre"><i style="width:${mediane}%"></i></span>
        <span class="nb-echelle-bornes"><span>0 %</span><span>100 %</span></span>
      </div>
      <ul class="nb-legende">
        <li><span class="nb-taux vert">${t.presenceVert}</span> ${t.presenceVertTexte(p.compte.vert, mediane)}</li>
        <li><span class="nb-taux jaune">${t.presenceJaune}</span> ${t.presenceJauneTexte(p.compte.jaune, Math.max(0, mediane - 6), mediane - 1)}</li>
        <li><span class="nb-taux">${t.presenceAucune}</span> ${t.presenceAucuneTexte(p.compte.aucune, Math.max(0, mediane - 6))}</li>
        <li><span class="nb-taux nd">${t.presenceND}</span> ${t.presenceNDTexte(p.sansDonnee - (PRESIDENCE ? 1 : 0))}</li>
        ${PRESIDENCE ? `<li><span class="nb-taux preside">${t.presidenceNeVotePas}</span> ${t.presidenceLegende(PRESIDENCE.nomAffiche)}</li>` : ''}
      </ul>
      <p class="nb-encadre-portee">${t.presencePortee(p.total, p.seances, p.comptes, p.plancher ?? 0, p.plafond ?? 0)}</p>
      <ul class="nb-encadre-avis">
${t.presenceAvis.map((a) => `        <li>${a}</li>`).join('\n')}
      </ul>
    </div>
  </section>`;
}

/**
 * Le Conseil exécutif, puis toute l'Assemblée — une seule page, comme sur DossierQuébec.
 * Les ministres sont aussi des député·e·s : ils reparaissent plus bas, dans leur parti.
 */
function pageMinistres(langue) {
  const t = T[langue];
  const membres = conseilFichier?.membres || [];
  const deputes = deputesFichier?.deputes || [];

  // Un ministre a sa boîte plus haut : il ne revient pas dans la liste. Les deux blocs se
  // partagent les 49 sièges, ils ne les répètent pas.
  const estMinistre = new Set(membres.map((m) => normaliserNom(m.nomAffiche)));
  const autres = deputes.filter((d) => !estMinistre.has(normaliserNom(d.nomAffiche)));

  // Le parti le plus nombreux en premier : c'est l'ordre que l'Assemblée elle-même annonce.
  const parPartis = new Map();
  for (const d of autres) {
    if (!parPartis.has(d.parti)) parPartis.set(d.parti, []);
    parPartis.get(d.parti).push(d);
  }
  // L'ordre des partis suit leurs SIÈGES, pas le nombre de lignes listées : le parti au
  // pouvoir a le plus de ministres, donc le moins de lignes ici, et il resterait en bas
  // d'une liste qui se classerait sur ce qu'elle montre.
  const sieges = new Map();
  for (const d of deputes) sieges.set(d.parti, (sieges.get(d.parti) || 0) + 1);
  const groupes = [...parPartis.entries()]
    .sort((a, b) => (sieges.get(b[0]) || 0) - (sieges.get(a[0]) || 0));

  // Dans chaque parti, la personne qui le dirige passe en tête : la première ministre chez
  // les libéraux, le chef de l'opposition chez les conservateurs, et ainsi de suite. Le
  // reste garde l'ordre de l'Assemblée, qui est alphabétique.
  const rang = (d) => {
    const roles = enrichir(d).roles?.en || [];
    if (roles.some((r) => /^premier\b/i.test(r))) return 0;
    if (estChefDeParti(roles)) return 1;
    return 2;
  };
  for (const [, gens] of groupes) gens.sort((a, b) => rang(a) - rang(b));

  const assemblee = groupes.map(([parti, gens]) => {
    const couleur = gens[0]?.couleurParti;
    return `  <section class="nb-section" data-nb-groupe>
    <div class="nb-section-tete"${couleur ? ` style="border-bottom-color:${echapper(couleur)}"` : ''}>
      <h3>${echapper(parti)}</h3>
      <span class="nb-compte" data-nb-compte-groupe>${gens.length}</span>
    </div>
    <div class="nb-lignes-deputes">
${gens.map((d) => ligneDepute(d, t, langue)).join('\n')}
    </div>
  </section>`;
  }).join('\n');

  return coquille({
    langue,
    vers: langue === 'en' ? 'ministers' : 'ministres',
    versAutre: langue === 'en' ? 'ministres' : 'ministers',
    titre: `${t.ministresTitre} — DossierNBrunswick`,
    description: t.ministresDescription,
    // Les deux tableaux de lecture ouvrent la page, avant les personnes : la composition
    // de l'Assemblée, puis ce que vaut le taux de présence. C'est l'ordre de DossierQuébec,
    // et il tient — on lit la règle avant de lire les chiffres qu'elle explique.
    corps: `${teteDeSection(
      t.assembleeSurtitre(deputesFichier?.sieges ?? deputes.length, membres.length),
      t.assembleeTitre,
      t.ministresNote,
    )}
  <section class="nb-section">
    <form class="nb-cherche" role="search" data-nb-cherche hidden>
      <label class="nb-invisible" for="nb-cherche-champ">${t.chercheLabel}</label>
      <span class="nb-cherche-loupe" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>
      </span>
      <input id="nb-cherche-champ" type="search" autocomplete="off" placeholder="${echapper(t.cherchePlaceholder)}">
      <button type="reset">${t.chercheEffacer}</button>
    </form>
    <p class="nb-vide" data-nb-cherche-rien="${echapper(t.chercheRien)}" hidden></p>
  </section>
${sectionComposition(t, groupes, deputesFichier?.sieges ?? deputes.length)}
${encadrePresence(t)}
  <section class="nb-section" data-nb-groupe>
    <div class="nb-section-tete"><h2>${t.ministresSousTitre}</h2><span class="nb-compte" data-nb-compte-groupe>${membres.length}</span></div>
    <p class="nb-section-note">${t.ministresSousNote(membres.length, deputesFichier?.sieges ?? deputes.length)}</p>
    <div class="nb-grille-ministres">
${membres.map((m) => carteMinistre(m, t, langue)).join('\n')}
    </div>
  </section>
  <section class="nb-section" id="assemblee">
    <p class="nb-surtitre nb-surtitre-rouge">${t.deputesSurtitre(autres.length)}</p>
    <div class="nb-section-tete"><h2>${t.deputesTitre}</h2></div>
    <p class="nb-section-note">${t.deputesNote}</p>
  </section>
${assemblee}`,
  });
}

/** Le lexique : le jargon en cartes, et les charges indépendantes qui veillent sur l'Assemblée. */
function pageLexique(langue) {
  const t = T[langue];

  // Chaque terme porte sa famille : le chemin d'un projet, les votes, les documents, les
  // personnes. C'est l'étiquette de DossierQuébec, et elle aide à chercher des yeux.
  const cartes = t.lexique.map(([terme, definition, famille]) => `      <article class="nb-terme-carte">
        <header>
          <h2>${echapper(terme)}</h2>
          ${famille ? `<span class="nb-famille ${famille}">${t.lexiqueFamilles[famille]}</span>` : ''}
        </header>
        <p>${definition}</p>
      </article>`).join('\n');


  return coquille({
    langue,
    vers: langue === 'en' ? 'glossary' : 'lexique',
    versAutre: langue === 'en' ? 'lexique' : 'glossary',
    titre: `${t.lexiqueTitre} — DossierNBrunswick`,
    description: t.lexiqueDescription,
    corps: `${teteDeSection(t.lexiqueSurtitre, t.lexiqueTitre, t.lexiqueNote)}
  <section class="nb-section">
    <div class="nb-lexique-grille">
${cartes}
    </div>
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
    <div class="nb-lignes-deputes" data-nb-dossier="depute">
${(deputesFichier?.deputes || []).map((d) => ligneDepute(d, t, langue)).join('\n')}
    </div>
    <p class="nb-carte-pied"><a href="${racine}${versMinistres}#assemblee">${t.deputesTitre} →</a></p>
  </section>`,
  });
}


/* ─── Partager ────────────────────────────────────────────────────────── */

/**
 * Les six réseaux de DossierQuébec, plus un bouton pour copier l'adresse. Chaque lien est
 * une simple adresse de partage : aucun script des réseaux n'est chargé ici, donc personne
 * n'est pisté depuis ce site.
 */
const RESEAUX = [
  ['X', 'https://twitter.com/intent/tweet?text={t}&url={u}', '<path d="M18.9 2H22l-7.1 8.1L23 22h-6.3l-4.9-6.4L6 22H3l7.6-8.7L2 2h6.4l4.5 5.9zm-1.1 18h1.7L7.3 3.8H5.5z"/>'],
  ['Facebook', 'https://www.facebook.com/sharer/sharer.php?u={u}', '<path d="M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z"/>'],
  ['LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url={u}', '<path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.1c.5-1 1.8-2 3.7-2 4 0 4.7 2.6 4.7 6V21h-4v-5.6c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9z"/>'],
  ['Reddit', 'https://www.reddit.com/submit?url={u}&title={t}', '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm5.2 9.2a1.4 1.4 0 0 1-.6 1.2v.4c0 2.2-2.5 4-5.6 4s-5.6-1.8-5.6-4v-.4a1.4 1.4 0 1 1 1.6-2.3 6.9 6.9 0 0 1 3.5-1.1l.7-3.1 2.4.5a1.1 1.1 0 1 1 .1.8l-1.8-.4-.6 2.2c1.3.1 2.5.5 3.4 1.1a1.4 1.4 0 0 1 2.5.9zM9 13a1.1 1.1 0 1 0 0-2.2A1.1 1.1 0 0 0 9 13zm6 0a1.1 1.1 0 1 0 0-2.2 1.1 1.1 0 0 0 0 2.2zm-.4 2a3.9 3.9 0 0 1-5.2 0 .4.4 0 1 0-.5.5 4.7 4.7 0 0 0 6.2 0 .4.4 0 1 0-.5-.5z"/>'],
  ['Threads', 'https://www.threads.net/intent/post?text={t}%20{u}', '<path d="M16.5 11.3a5.6 5.6 0 0 0-.6-.3c-.1-2-1.2-3.1-3-3.1-1 0-1.9.4-2.4 1.2l1.1.8c.4-.6.9-.7 1.3-.7.9 0 1.5.5 1.6 1.5h-.9c-2.3 0-3.7 1-3.7 2.6 0 1.4 1.1 2.4 2.7 2.4 1.5 0 2.5-.9 2.8-2.3.5.3.8.8.8 1.4 0 1.3-1.4 2.5-3.9 2.5-2.8 0-4.6-1.8-4.6-5.3S8.5 6.7 11.3 6.7c2 0 3.4.8 4.1 2.3l1.3-.6C15.8 6.3 13.9 5.2 11.3 5.2 7.5 5.2 5.4 7.8 5.4 12s2.1 6.8 5.9 6.8c3.3 0 5.4-1.8 5.4-4 0-1.3-.6-2.4-1.6-3.1zm-3.9 2.9c-.7 0-1.2-.4-1.2-.9 0-.7.7-1.1 1.9-1.1h.9c-.1 1.3-.7 2-1.6 2z"/>'],
  ['Bluesky', 'https://bsky.app/intent/compose?text={t}%20{u}', '<path d="M12 10.8C10.9 8.7 8 4.7 5.3 2.9 2.7 1.1 1.7 1.4 1 1.7.2 2.1 0 3.3 0 4s.4 6 .7 7c.9 3.3 4.4 4.4 7.6 4-4.8.7-9 2.5-3.4 8.7 6.1 6.4 8.4-1.4 9.6-5.3 1.2 3.9 2.5 11.4 9.5 5.3 5.2-5.3 1.5-8-3.3-8.7 3.2.4 6.7-.7 7.6-4 .3-1 .7-6.4.7-7 0-.7-.2-1.9-1-2.3-.7-.3-1.7-.6-4.3 1.2C16.1 4.7 13.1 8.7 12 10.8z" transform="scale(.85) translate(2 2)"/>'],
];

/**
 * La barre de partage. Le texte et l'adresse sont posés dans l'attribut, pas construits en
 * JavaScript : les liens marchent même si le script ne se charge pas, et le bouton « copier »
 * est le seul morceau qui en a besoin.
 */
function barrePartage(titre, adresse, t) {
  const u = encodeURIComponent(adresse);
  const txt = encodeURIComponent(titre);
  const liens = RESEAUX.map(([nom, gabarit, chemin]) => {
    const href = gabarit.replace('{u}', u).replace('{t}', txt);
    return `      <a class="nb-reseau" href="${href}" rel="noopener nofollow" target="_blank" title="${echapper(nom)}" aria-label="${echapper(nom)}">`
      + `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="currentColor">${chemin}</svg></a>`;
  }).join('\n');

  return `    <div class="nb-partage">
      <span class="nb-partage-titre">${t.partager}</span>
${liens}
      <button class="nb-reseau nb-copier" type="button" data-nb-copier="${echapper(adresse)}"
        data-nb-copie-faite="${echapper(t.partageCopie)}" title="${echapper(t.partageCopier)}" aria-label="${echapper(t.partageCopier)}">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>
      </button>
    </div>`;
}

/* ─── Une page par projet de loi ─────────────────────────────────────────── */

/** L'adresse d'un projet : son numéro, sa législature et sa session — jamais le numéro seul. */
const slugProjet = (p) => `${p.numero}-${projetsFichier.legislature}-${projetsFichier.session}`;

/**
 * Le chemin d'un projet de loi, en pastilles : les étapes franchies s'allument, celles qui
 * restent attendent. C'est la forme de DossierQuébec, et elle dit d'un coup d'œil où en est
 * un texte — ce qu'une liste de dates ne montre pas.
 */
function cheminEtapes(projet, t, langue) {
  const etapes = projet.etapes || [];
  if (!etapes.length) return '';
  return `    <ol class="nb-chemin">
${etapes.map((e) => {
    const nom = langue === 'fr' ? (e.nomFr || e.nom) : e.nom;
    const quand = e.date ? dateLisible(e.date, langue) : null;
    return `      <li class="${e.date ? 'faite' : 'a-venir'}"${quand ? ` title="${echapper(quand)}"` : ''}>`
      + `<span>${echapper(nom)}</span>${quand ? `<time datetime="${e.date}">${quand}</time>` : ''}</li>`;
  }).join('\n')}
    </ol>`;
}

/** La page d'un projet de loi : ce qu'il est, où il en est, qui l'a déposé, et qui a voté. */
function pageProjet(projet, t, langue) {
  const racine = langue === 'en' ? '/en/' : '/';
  const dossier = langue === 'en' ? 'bills' : 'projets-de-loi';
  const autreDossier = langue === 'en' ? 'projets-de-loi' : 'bills';
  const slug = slugProjet(projet);
  const titre = projet.titre[langue] || projet.titre.en;
  const type = langue === 'fr' ? projet.typeFr : projet.type;
  const statut = statutLisible(projet, langue);
  const parrain = projet.parrain;
  const depot = (projet.etapes || []).find((e) => e.date);
  const lien = projet.source?.[langue] || projet.source?.en || '#';

  const docs = [];
  if (projet.documents?.htmlFr) docs.push(`<a href="${echapper(projet.documents.htmlFr)}" rel="noopener">${t.texteFr}</a>`);
  if (projet.documents?.htmlEn) docs.push(`<a href="${echapper(projet.documents.htmlEn)}" rel="noopener">${t.texteEn}</a>`);
  if (projet.documents?.pdfBilingue) docs.push(`<a href="${echapper(projet.documents.pdfBilingue)}" rel="noopener">${t.textePdf}</a>`);
  for (const a of projet.documents?.amendements || []) {
    docs.push(`<a href="${echapper(a)}" rel="noopener">${t.amendement}</a>`);
  }

  // Le parrain mène à sa page quand il en a une : un projet de loi et la personne qui l'a
  // déposé se lisent mieux ensemble.
  // Le parrain est nommé « Hon. Robert MCKEE, K.C. » au bas du projet et « Robert McKee »
  // dans la liste des député·e·s : on retrouve la personne plutôt que de recoudre son nom.
  const personneParrain = parrain?.nom
    ? (deputesFichier?.deputes || []).find((d) => normaliserNom(d.nomAffiche) === normaliserNom(parrain.nom))
    : null;

  const ligneParrain = parrain?.nom
    ? `${t.parrainePar} <b>${lienPersonne(personneParrain || { nomAffiche: parrain.nom }, t, langue)}</b>`
      + `${parrain.parti ? ` · <span class="nb-parti"${parrain.couleurParti ? ` style="--parti:${echapper(parrain.couleurParti)}"` : ''}>${echapper(parrain.parti)}</span>` : ''}`
      + `${parrain.circonscription ? ` · ${echapper(parrain.circonscription)}` : ''}`
    : '';

  const votes = blocVotes(projet, t, langue);
  const adresse = `${SITE}${racine}${dossier}/${slug}`;

  return coquille({
    langue,
    vers: `${dossier}/${slug}`,
    versAutre: `${autreDossier}/${slug}`,
    titre: `${t.abrevProjet} ${projet.numero} — ${titre} — DossierNBrunswick`,
    description: t.projetDescription(projet.numero, titre, statut),
    corps: `  <nav class="nb-ariane" aria-label="${t.ariane}">
    <a href="${racine}">${t.arianeAccueil}</a> <span aria-hidden="true">›</span>
    <a href="${racine}${dossier}">${t.projetsTitre}</a> <span aria-hidden="true">›</span>
    <span aria-current="page">${t.abrevProjet} ${projet.numero}</span>
  </nav>
  <section class="nb-section nb-projet-haut">
    <div>
      <p class="nb-numero-gros">${t.abrevProjet} ${projet.numero}</p>
      <h1>${echapper(titre)}</h1>
      ${type ? `<p class="nb-fiche-type">${echapper(type)}</p>` : ''}
      ${ligneParrain ? `<p class="nb-fiche-parrain">${ligneParrain}</p>` : ''}
    </div>
    <aside class="nb-projet-boite">
      ${statut ? `<p class="nb-etape-grande">${echapper(statut)}</p>` : ''}
      ${depot ? `<p class="nb-boite-ligne"><span>${t.deposeLe}</span><time datetime="${depot.date}">${dateLisible(depot.date, langue)}</time></p>` : ''}
      <p class="nb-boite-ligne"><span>${t.session}</span><b>${projetsFichier.legislature}<sup>${langue === 'en' ? 'th' : 'e'}</sup> · ${projetsFichier.session}</b></p>
      <a class="nb-btn nb-btn-jaune" href="${echapper(lien)}" rel="noopener">${t.voirOfficiel}</a>
${barrePartage(`${t.abrevProjet} ${projet.numero} — ${titre}`, adresse, t)}
    </aside>
  </section>
  <section class="nb-section">
    <div class="nb-section-tete"><h2>${t.cheminTitre}</h2>
      <a class="nb-voir-tout" href="${racine}${langue === 'en' ? 'glossary' : 'lexique'}">${t.cheminLexique}</a></div>
${cheminEtapes(projet, t, langue)}
  </section>
  ${docs.length ? `<section class="nb-section">
    <div class="nb-section-tete"><h2>${t.texteOfficielTitre}</h2></div>
    <p class="nb-texte">${t.texteOfficielNote}</p>
    <p class="nb-carte-pied">${docs.join(' · ')}</p>
  </section>` : ''}
  <section class="nb-section">
    <div class="nb-section-tete"><h2>${t.projetVotes}</h2></div>
    ${votes ? `<div class="nb-fiche-votes">\n${votes}\n    </div>`
      : `<p class="nb-section-note">${t.projetAucunVote}</p>`}
  </section>`,
  });
}

/* ─── Une page par personne ──────────────────────────────────────────────── */

/**
 * Qui dirige un parti. Les fiches de l'Assemblée distinguent deux choses qu'un simple
 * « leader » confondrait : le CHEF d'un parti (« Leader of the Official Opposition »,
 * « Leader of the Green Party ») et le LEADER PARLEMENTAIRE, qui organise les travaux de
 * son groupe en Chambre (« Government House Leader »). Seul le premier nous intéresse ici.
 */
const estChefDeParti = (roles) => (roles || []).some(
  (r) => /\bleader\b/i.test(r) && !/house leader/i.test(r),
);

/**
 * Les personnes qui ont leur propre page : les membres du Conseil exécutif, et les chefs
 * de parti qui n'en font pas partie. Les fiches individuelles donnent les fonctions dans
 * les deux langues ; sans elles, on s'en tient au Conseil exécutif.
 */
const FICHES_PAR_NOM = new Map((fichesFichier?.fiches || []).map((f) => [normaliserNom(f.nomAffiche), f]));

/**
 * Ajoute à une personne ce que sa fiche individuelle apporte : ses fonctions, son parti et
 * sa circonscription dans les deux langues. Sans fiche lue, la personne est rendue telle
 * quelle — le site se bâtit, en moins riche, plutôt que d'échouer.
 */
/**
 * Qui préside l'Assemblée. La présidence NE VOTE PAS : son absence de tous les votes
 * nominatifs n'est pas une donnée manquante, c'est la règle. Sa ligne doit le dire, sinon
 * un « n/d » laisse croire qu'on n'a pas su.
 *
 * Les vice-présidences, elles, votent comme tout le monde quand elles ne président pas :
 * « Deputy Speaker » ne compte pas ici.
 */
function estPresidence(rolesOfficiels) {
  // Le libellé anglais de l'Assemblée, et rien d'autre : « Speaker of the Legislative
  // Assembly ». « Deputy Speaker » commence par Deputy, donc ne passe pas.
  return (rolesOfficiels || []).some((r) => /^speaker\b/i.test(String(r).trim()));
}

/** La présidence en exercice, si les fiches l'ont dit. */
const PRESIDENCE = (fichesFichier?.fiches || []).find((f) => estPresidence(f.roles?.en)) || null;

function enrichir(p) {
  const f = FICHES_PAR_NOM.get(normaliserNom(p.nomAffiche));
  if (!f) return p;
  return { ...p, roles: f.roles, parti: f.parti, circonscription: f.circonscription, fiche: f.fiche };
}

const PERSONNES = (() => {
  const ministres = (conseilFichier?.membres || []).map(enrichir);
  const dejaLa = new Set(ministres.map((m) => normaliserNom(m.nomAffiche)));

  const chefs = (deputesFichier?.deputes || [])
    .map(enrichir)
    .filter((d) => !dejaLa.has(normaliserNom(d.nomAffiche)) && estChefDeParti(d.roles?.en));

  return [...ministres, ...chefs];
})();

/** Le nom des personnes qui ont une page, pour y renvoyer depuis les listes. */
const A_UNE_PAGE = new Set(PERSONNES.map((p) => normaliserNom(p.nomAffiche)));

/** L'adresse d'une personne : son nom, sans accent ni ponctuation. */
const slugPersonne = (nom) => String(nom ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Ce que l'Assemblée a payé à une personne pendant l'exercice. Ce ne sont pas des salaires :
 * une partie rembourse des frais, et le budget de bureau de circonscription paie un local et
 * son personnel. La section le dit, parce qu'un chiffre d'argent sous le nom de quelqu'un se
 * lit vite de travers.
 */
function blocFinances(personne, t, langue) {
  const f = financesFichier;
  if (!f?.personnes?.length) return '';

  const ligne = f.personnes.find((p) => p.siege
    && normaliserNom(p.siege) === normaliserNom(personne.nomAffiche));
  if (!ligne) return '';

  const sous = (n) => new Intl.NumberFormat(langue === 'en' ? 'en-CA' : 'fr-CA',
    { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

  const rangees = [];
  if (ligne.frais) {
    for (const col of f.colonnes) {
      const valeur = ligne.frais[col.cle];
      if (!valeur) continue;   // une colonne à zéro n'apprend rien
      rangees.push(`      <div><dt>${echapper(langue === 'en' ? col.en : col.fr)}</dt><dd>${sous(valeur)}</dd></div>`);
    }
    rangees.push(`      <div class="nb-total"><dt>${t.financesTotal}</dt><dd>${sous(ligne.total)}</dd></div>`);
  }
  if (ligne.bureau != null) {
    rangees.push(`      <div><dt>${t.financesBureau}</dt><dd>${sous(ligne.bureau)}</dd></div>`);
  }
  if (!rangees.length) return '';

  return `  <section class="nb-section">
    <div class="nb-section-tete"><h2>${t.financesTitre}</h2><span class="nb-compte">${echapper(t.financesExercice(f.exercice))}</span></div>
    <dl class="nb-carte-donnees nb-donnees-large nb-finances">
${rangees.join('\n')}
    </dl>
    <p class="nb-section-note">${t.financesNote}${ligne.frais ? '' : ` ${t.financesSansFrais}`} ${t.financesExerciceNote}</p>
    <p class="nb-carte-pied">${t.financesSource}
      <a href="${echapper(f.documents.frais)}" rel="noopener">${t.financesFrais}</a> ·
      <a href="${echapper(f.documents.bureaux)}" rel="noopener">${t.financesCirconscription}</a></p>
  </section>`;
}

/**
 * Le portrait d'une personne, tel qu'on le sert. L'Assemblée publie ces photos pour un
 * usage public non commercial : on les reprend créditées, avec un lien vers la fiche
 * officielle. Pas de fichier téléchargé, pas d'image — jamais un cadre vide.
 */
function portraitLocal(personne) {
  const slug = slugPersonne(personne.nomAffiche);
  if (!existsSync(`photos/${slug}.webp`)) return null;
  return {
    src: `/photos/${slug}.webp`,
    // L'écran à haute densité prend le double ; les autres n'ont rien de plus à charger.
    srcset: existsSync(`photos/${slug}@2x.webp`)
      ? `/photos/${slug}.webp 1x, /photos/${slug}@2x.webp 2x`
      : null,
  };
}

/**
 * La page d'une personne : ses fonctions, les projets de loi qu'elle a déposés, et la
 * façon dont elle a voté à chaque vote nominatif de la session.
 *
 * ON NE RECOPIE PAS SA BIOGRAPHIE. Le texte de présentation appartient à l'Assemblée ; la
 * page renvoie à sa fiche officielle. Ce qu'on publie ici, ce sont des faits — qui a déposé
 * quoi, qui a voté comment — rassemblés d'une façon que legnb.ca ne propose pas.
 */
function pagePersonne(personne, t, langue) {
  const slug = slugPersonne(personne.nomAffiche);
  const racine = langue === 'en' ? '/en/' : '/';
  const dossier = langue === 'en' ? 'ministers' : 'ministres';
  const autreDossier = langue === 'en' ? 'ministres' : 'ministers';

  const roles = personne.roles?.[langue] || personne.roles?.en || personne.roles || [];
  const rolesOfficiels = personne.roles?.en || personne.roles || [];
  const parti = personne.parti?.[langue] || personne.parti || null;
  const circonscription = personne.circonscription?.[langue] || personne.circonscription || null;
  const fiche = personne.fiche?.[langue] || personne.fiche?.en || personne.fiche || null;
  const presence = PRESENCE_AUX_VOTES.de(personne);
  const estDuConseil = (conseilFichier?.membres || [])
    .some((m) => normaliserNom(m.nomAffiche) === normaliserNom(personne.nomAffiche));

  const projets = projetsFichier.projets
    .filter((p) => normaliserNom(p.parrain?.nom) === normaliserNom(personne.nomAffiche))
    .sort((a, b) => b.numero - a.numero);

  const premierRole = roles[0] || t.ficheSansFonction;
  const etiquette = estDuConseil ? t.ficheEtiquetteMinistre
    : estChefDeParti(rolesOfficiels) ? t.ficheEtiquetteChef
      : t.ficheEtiquetteDepute;

  // La photo vient de l'Assemblée, qui la publie pour un usage public non commercial.
  // Elle est créditée et renvoie à la fiche officielle. Pas de photo, pas de cadre vide.
  const photo = portraitLocal(personne);

  return coquille({
    langue,
    vers: `${dossier}/${slug}`,
    versAutre: `${autreDossier}/${slug}`,
    titre: `${personne.nomAffiche}, ${premierRole} — DossierNBrunswick`,
    description: t.ficheDescription(personne.nomAffiche, premierRole, circonscription),
    corps: `  <nav class="nb-ariane" aria-label="${t.ariane}">
    <a href="${racine}">${t.arianeAccueil}</a> <span aria-hidden="true">›</span>
    <a href="${racine}${dossier}">${t.assembleeTitre}</a> <span aria-hidden="true">›</span>
    <span aria-current="page">${echapper(personne.nomAffiche)}</span>
  </nav>
  <section class="nb-section nb-fiche-personne">
    <div class="nb-portrait">
      ${photo ? `<img src="${echapper(photo.src)}"${photo.srcset ? ` srcset="${echapper(photo.srcset)}"` : ''} width="200" alt="${echapper(personne.nomAffiche)}" loading="lazy">` : ''}
      <p class="nb-credit">${t.photoCredit}${fiche ? ` · <a href="${echapper(fiche)}" rel="noopener">legnb.ca</a>` : ''}</p>
    </div>
    <div class="nb-fiche-tete">
      <p class="nb-etiquette"${personne.couleurParti ? ` style="--parti:${echapper(personne.couleurParti)}"` : ''}>${etiquette}</p>
      <h1>${echapper(personne.nomAffiche)}${personne.titre ? `<span class="nb-titre">${echapper(personne.titre)}</span>` : ''}</h1>
      <p class="nb-resume">${t.ficheResume(personne.nomAffiche, roles, circonscription, parti)}</p>
      <button class="nb-suivre" type="button" data-nb-suivre="${echapper(identifiantMinistre(personne))}" data-nb-suivre-genre="${estDuConseil ? 'ministre' : 'depute'}"
        data-nb-suivre-mots="${echapper(t.suivre)}|${echapper(t.suivi)}"
        aria-pressed="false" title="${echapper(t.suivreMinistre(personne.nomAffiche))}">${t.suivre}</button>
    </div>
  </section>
  <section class="nb-section">
    <div class="nb-section-tete"><h2>${t.ficheRoles}</h2></div>
    ${roles.length ? `<ul class="nb-liste-simple">${roles.map((r) => `<li>${echapper(r)}</li>`).join('')}</ul>`
      : `<p class="nb-section-note">${t.ficheAucuneFonction}</p>`}
    <dl class="nb-carte-donnees nb-donnees-large">
      <div><dt>${t.ficheParti}</dt><dd>${echapper(parti || '—')}</dd></div>
      <div><dt>${t.ministreCirconscription}</dt><dd>${echapper(circonscription || '—')}</dd></div>
    </dl>
  </section>
  <section class="nb-section">
    <div class="nb-section-tete"><h2>${t.ficheProjets}</h2><span class="nb-compte">${projets.length}</span></div>
    ${projets.length
      ? `<div class="nb-projets">
${projets.map((p) => rangeeProjet(p, t, langue)).join('\n')}
    </div>`
      : `<p class="nb-section-note">${t.ficheAucunProjet}</p>`}
  </section>
  <section class="nb-section">
    <div class="nb-section-tete"><h2>${t.ministrePresence}</h2></div>
    <p class="nb-presence-ligne">${presence
      ? `<span class="nb-taux ${presence.couleur}">${presence.taux} %</span> <span>${t.presenceTitre(presence.votes, presence.total)}</span>`
      : estPresidence(rolesOfficiels)
        ? `<span class="nb-taux preside">${t.presidenceNeVotePas}</span> <span>${t.presidenceInfo}</span>`
        : `<span class="nb-taux nd">${t.presenceND}</span> <span>${t.fichePresenceAucune}</span>`}</p>
    <p class="nb-section-note">${t.fichePresenceAvis}</p>
  </section>
${blocFinances(personne, t, langue)}
  <section class="nb-section">
    <div class="nb-section-tete"><h2>${t.ficheCoordonnees}</h2></div>
    <p class="nb-texte">${t.ficheCoordonneesTexte}</p>
    ${fiche ? `<p class="nb-carte-pied"><a href="${echapper(fiche)}" rel="noopener">${t.voirOfficiel}</a></p>` : ''}
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

// Une page par personne, pour celles qui portent une fonction : les membres du Conseil
// exécutif, et les chefs de parti qui n'en font pas partie. Chacune rassemble ce que
// legnb.ca éparpille — fonctions, projets déposés, et le détail de ses votes nominatifs.
// Une page par projet de loi, à une adresse qui porte sa session : un numéro repart à 1
// à chaque session, et « /projets-de-loi/12 » désignerait des textes différents selon
// l'année.
mkdirSync('projets-de-loi', { recursive: true });
mkdirSync('en/bills', { recursive: true });
for (const projet of projetsFichier.projets) {
  const slug = slugProjet(projet);
  const fr = `projets-de-loi/${slug}.html`;
  const en = `en/bills/${slug}.html`;
  writeFileSync(fr, pageProjet(projet, T.fr, 'fr'), 'utf8');
  writeFileSync(en, pageProjet(projet, T.en, 'en'), 'utf8');
  PAGES.push({ fr, en });
}

if (PERSONNES.length) {
  mkdirSync('ministres', { recursive: true });
  mkdirSync('en/ministers', { recursive: true });
  for (const personne of PERSONNES) {
    const slug = slugPersonne(personne.nomAffiche);
    const fr = `ministres/${slug}.html`;
    const en = `en/ministers/${slug}.html`;
    writeFileSync(fr, pagePersonne(personne, T.fr, 'fr'), 'utf8');
    writeFileSync(en, pagePersonne(personne, T.en, 'en'), 'utf8');
    PAGES.push({ fr, en });
  }
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
