// CONFIGURATION DU VOLET FREDERICTON pour le moteur commun des villes (20 nov. 2026).
// Le code est dans /commun/ville/moteur.js, COPIÉ de dossierquebec par son scripts/synchro-moteur.js :
// on ne le modifie jamais ici. La liste des clés est en tête de montreal/assets/ville.js (dossierquebec)
// et, pour les volets anglophones, dans la section « VOLETS ANGLOPHONES » à la fin du moteur.
//
// Fredericton : les procès-verbaux (anglais, et français quand la Ville le publie) téléchargés à la main
// sur eSCRIBE. Pas de vote nominal : la fiche dit qui a proposé, appuyé, qui était absent ; les points
// d'ordre du jour d'une séance sans procès-verbal et les informations sont comptés à part. Pas de
// page Contrats.
import { libelleEn, themeEn, libelleFr, themeFr, INSTANCES_FR } from './libelles-en.js';

globalThis.VILLE = {
  nom: 'Fredericton',
  province: 'DossierNBrunswick',
  pages: {
    decisions: 'decisions-of-fredericton-city-council',
    conseil: 'fredericton-city-council',
  },
  // Copies locales : la langue (anglais par défaut, français en option) et l'impression des séances.
  chemins: { langue: '/fredericton/assets/langue.js', imprimer: '/fredericton/assets/imprimer-seance.js' },
  langueDefaut: 'en',
  mesure: 'https://dossierquebec.ca/commun/mesure.js',
  libelles: { libelleEn, themeEn, libelleFr, themeFr },
  regexMaire: /mayor/i,
  anglophone: true,
  date1er: true,
  textes: true,
  fichePV: true,
  objetFr: true,
  absencesSurSeances: true,
  fenetre: {
    points: ['résolutions', 'resolutions'],
    affichees: ['résolution(s) affichée(s)', 'resolution(s) shown'],
    seances: ['séances du conseil', 'Council meetings'],
    point: ['résolution', 'résolutions', 'resolution', 'resolutions'],
  },
  vocabulaire: {
    lienSource: ['Procès-verbal officiel (PDF) ↗', 'Official minutes (PDF) ↗'],
    titreFil: ['Récemment au conseil', 'Recently at Council'],
  },
  besoins: {
    accueil: ['decisions', 'votes', 'elus'],
    decisions: ['decisions', 'votes-decisions', 'votes'],
    votes: ['votes'],
    conseil: ['elus', 'votes', 'decisions'],
    lexique: ['lexique'],
    sources: ['decisions', 'votes', 'elus', 'seances', 'robots'],
  },
  porteeDe: (instance, tr, etat, EN) => (EN ? null : INSTANCES_FR[instance]) ?? etat.decisions?.instances?.[instance] ?? null,
  // Pas de vote nominal à Fredericton : le fil montre toutes les décisions de fond.
  filSansResume: () => true,
  // Le chiffre parlant : les résolutions qui portent sur un arrêté municipal.
  chiffreVotes: (etat, tr, nombreFr) => ({ n: nombreFr(etat.votes.votes.filter((v) => /By-law No\./.test(v.objet ?? '')).length), quoi: tr('résolutions sur un arrêté municipal', 'resolutions on a by-law') }),
  compteElus: ({ n, maires, conseillers, p }, tr, dateFr) => tr(
    `${n} membres : ${maires.length ? 'le maire, élu par toute la ville, et ' : ''}${conseillers.length} conseillers et conseillères, un par quartier. Absences comptées du ${dateFr(p.depuis)} au ${dateFr(p.jusqua)}.`,
    `${n} members: ${maires.length ? 'the Mayor, elected by the whole city, and ' : ''}${conseillers.length} Councillors, one per ward. Absences counted from ${dateFr(p.depuis)} to ${dateFr(p.jusqua)}.`
  ),
  lignesSources(ajouter, { etat, tr, nombreFr }) {
    ajouter(tr('Résolutions (procès-verbaux lus)', 'Resolutions (minutes read)'), etat.decisions, etat.decisions ? `${nombreFr(etat.decisions.nombre)}` : '');
    ajouter(tr('Membres du conseil', 'Council members'), etat.elus, etat.elus ? `${etat.elus.nombre}` : '');
    ajouter(tr('Séances (procès-verbaux lus)', 'Meetings (minutes read)'), etat.seances, etat.seances ? `${etat.seances.nombre}` : '');
  },
  // Pas de robots.txt lu : les procès-verbaux sont téléchargés à la main.
  noteSources: (etat, tr) => (etat.robots ? `<p class="compte">${tr('Les procès-verbaux sont téléchargés à la main sur eSCRIBE, puis lus par le programme : aucune requête automatique à la Ville.', 'The minutes are downloaded by hand from eSCRIBE, then read by the program: no automatic request to the City.')}</p>` : ''),
};
