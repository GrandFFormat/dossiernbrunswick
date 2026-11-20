// Source de la Ville de Fredericton : le pendant de lib/van.js à Vancouver (N.-B.).
//
// Fredericton ne publie AUCUN registre de votes en données ouvertes (le portail
// data-fredericton.opendata.arcgis.com n'a que les quartiers et un budget de 2017). La seule
// source du conseil, ce sont les procès-verbaux publiés sur eSCRIBE, en anglais (Minutes) et en
// français (Procès-verbal), un PDF par séance.
//
// eSCRIBE est derrière Cloudflare : un robot reçoit un 403. On ne contourne rien. Les PDF sont
// téléchargés à la main dans pv-a-la-main/ (nommés fredericton-pv-AAAA-MM-JJ-<DocumentId>.pdf,
// avec -fr pour la version française), et scrapers/votes.js les lit sur le disque.
//
// CE QUE LES PROCÈS-VERBAUX DISENT : chaque résolution, qui l'a proposée, qui l'a appuyée, et le
// résultat (CARRIED / DEFEATED). Ce qu'ils NE disent PAS : qui a voté pour ou contre. Fredericton
// ne note pas de vote nominal ; les listes pour/contre restent donc vides et les pages le disent.
// Les présences, elles, sont au procès-verbal (« Members of Council Present ») : un membre absent
// de cette liste est noté absent pour toute la séance.
//
// CONDITIONS — fredericton.ca n'accorde pas de licence ouverte sur ces documents. Martin
// (19 nov. 2026) : on publie et on demande l'autorisation à la Ville ensuite ; si elle refuse,
// le volet est retiré.

export const PORTAIL = 'https://pub-fredericton.escribemeetings.com/';
export const JEU = 'escribe-minutes';
export const PAGE_JEU = PORTAIL;
export const LICENCE = {
  nom: 'Procès-verbaux du conseil municipal de Fredericton (eSCRIBE)',
  version: '',
  url: PORTAIL,
  luLe: '2026-11-19',
};
export const ATTRIBUTION = 'Source: City of Fredericton, minutes of City Council meetings (eSCRIBE).';
export const USER_AGENT = 'DossierNBrunswick/0.1 (veille citoyenne; https://dossiernbrunswick.ca/fredericton/)';

// Le lien public d'un PDF eSCRIBE.
export const lienDocument = (id) => `${PORTAIL}filestream.ashx?DocumentId=${encodeURIComponent(id)}`;

export const INSTANCES = {
  'Regular City Council Meeting': { cle: 'RC', explication: 'A regular meeting of the full Council: the Mayor and the twelve Ward Councillors.' },
  'Special City Council Meeting': { cle: 'SC', explication: 'A Council meeting called outside the regular schedule, usually for one matter.' },
};
export function cleInstance(nom) {
  if (INSTANCES[nom]) return INSTANCES[nom].cle;
  return String(nom ?? 'X').replace(/[^A-Za-z]+/g, ' ').trim().split(' ').map((m) => m[0]?.toUpperCase() ?? '').join('') || 'X';
}
