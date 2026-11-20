// Le lexique du conseil de Fredericton, mesuré sur les points votés.
//
//   node scrapers/lexique.js
//
// Même idée qu'à Québec et à Montréal : les DÉFINITIONS sont de nous, les DÉCOMPTES et les EXEMPLES
// viennent des données de la Ville. Aucune requête ici : tout se lit dans data/decisions.json et
// data/votes.json, écrits par scrapers/votes.js. Chaque terme porte une expression régulière ; le
// scraper compte combien de points votés la contiennent (ou, pour les termes de structure, combien
// de séances, de bulletins ou de résultats), et garde un exemple réel.
//
// RÈGLE : une définition dit ce que le mot veut dire dans les documents de la Ville, pas ce que la
// loi en dit. Quand la loi compte (l'abstention, l'inadmissibilité), on décrit ce que le registre
// consigne, sans prêter une raison que le registre ne donne pas.

import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { CATEGORIES_FR, ENTREES_FR } from '../lib/lexique-fr.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const CATEGORIES = {
  instances: 'Who decides',
  vote: 'Voting and results',
  documents: 'Motions and by-laws',
  urbanisme: 'Zoning and development',
  argent: 'Money and property',
};

// sur : 'objet' (la ligne d'ordre du jour), 'instance' (le type de séance), 'vote' (un bulletin),
// 'resultat' (le résultat d'un point).
// N.-B. : les termes des procès-verbaux de Fredericton (19 nov. 2026). sur: 'texte' cherche dans le
// titre ET le texte de la résolution.
const TERMES = [
  { terme: 'City Council', categorie: 'instances', sur: 'instance', recherche: /City Council Meeting/i,
    definition: 'The Mayor and twelve Councillors, one per ward, elected for four years. Council decides by resolution: a member moves it, another seconds it, and Council carries or defeats it.',
    ouVousLeVoyez: 'The meeting type on every card.' },
  { terme: 'Regular meeting', categorie: 'instances', sur: 'instance', recherche: /^Regular City Council Meeting$/i,
    definition: 'A Council meeting held on the regular schedule, usually on Monday evening every two weeks.',
    ouVousLeVoyez: 'Most meetings in the period.' },
  { terme: 'Special meeting', categorie: 'instances', sur: 'instance', recherche: /^Special City Council Meeting$/i,
    definition: 'A Council meeting called outside the regular schedule, for one stated purpose, such as the swearing-in of a new Council.',
    ouVousLeVoyez: 'The minutes open with the purpose of the meeting.' },
  { terme: 'Deputy Mayor', categorie: 'instances', sur: 'texte', recherche: /Deputy Mayor/i,
    definition: 'A Councillor chosen by Council to act for the Mayor when the Mayor is away.',
    ouVousLeVoyez: 'Council appoints the Deputy Mayor by resolution.' },
  { terme: 'Closed Session', categorie: 'instances', sur: 'texte', recherche: /Closed Session/i,
    definition: 'Part of a meeting held without the public, for matters the law allows to be kept private, such as land deals or legal advice. Any decision is then voted on in public.',
    ouVousLeVoyez: 'Cards marked “From the … Closed Session”.' },
  { terme: 'Council-in-Committee', categorie: 'instances', sur: 'texte', recherche: /Council-in-Committee|Committee of the Whole/i,
    definition: 'All members of Council sitting as a committee to study a matter before Council decides it.',
    ouVousLeVoyez: 'Under “Council-in-Committee Reports” in the minutes.' },
  { terme: 'Moved by / Seconded by', categorie: 'vote', sur: 'objet', recherche: /./i,
    definition: 'The member who puts a resolution forward, and the member who supports putting it to a vote. Neither tells you how the others voted.',
    ouVousLeVoyez: 'On every card.' },
  { terme: 'Carried', categorie: 'vote', sur: 'resultat', recherche: /^Carried$/i,
    definition: 'The resolution was adopted. Fredericton’s minutes do not say by how many votes, nor who voted against.',
    ouVousLeVoyez: 'The result on almost every card.' },
  { terme: 'Defeated', categorie: 'vote', sur: 'resultat', recherche: /^Defeated$/i,
    definition: 'The resolution was rejected.',
    ouVousLeVoyez: 'The result on a card, when it happens.' },
  { terme: 'Conflict of interest', categorie: 'vote', sur: 'texte', recherche: /conflict of interest/i,
    definition: 'A member with a personal interest in an item declares it at the start of the meeting and takes no part in that item.',
    ouVousLeVoyez: 'Under “Conflict of Interest Declarations” in the minutes.' },
  { terme: 'Motion to excuse', categorie: 'vote', sur: 'objet', recherche: /Excuse/i,
    definition: 'A resolution by which Council excuses a member’s absence from a meeting.',
    ouVousLeVoyez: 'Near the end of some meetings.' },
  { terme: 'Consent Agenda', categorie: 'documents', sur: 'objet', recherche: /Consent Agenda/i,
    definition: 'A group of routine items adopted together, in a single resolution. Any member can ask for an item to be taken out and voted on separately.',
    ouVousLeVoyez: 'One card per meeting, with every item it covers in the text.' },
  { terme: 'By-law', categorie: 'documents', sur: 'texte', recherche: /By-law/i,
    definition: 'A municipal law adopted by Council. Each one has a letter and a number: Z for zoning, T for traffic, and so on.',
    ouVousLeVoyez: 'Cards titled “By-law No. …”.' },
  { terme: 'First, second and third reading', categorie: 'documents', sur: 'texte', recherche: /(First|Second|Third) Reading/i,
    definition: 'A by-law is read three times before it takes effect. Council often gives first and second reading at one meeting and third reading at a later one.',
    ouVousLeVoyez: 'The same by-law comes back on several cards, a few weeks apart.' },
  { terme: 'Reading by summary', categorie: 'documents', sur: 'texte', recherche: /by summary/i,
    definition: 'Instead of reading a by-law out in full, Council reads a summary of it, as the Local Governance Act allows.',
    ouVousLeVoyez: 'A card just before the third reading of a by-law.' },
  { terme: 'Approval of Agenda', categorie: 'documents', sur: 'objet', recherche: /Approval of Agenda/i,
    definition: 'The first resolution of a meeting: Council adopts its agenda, sometimes with items added.',
    ouVousLeVoyez: 'The first card of each meeting.' },
  { terme: 'Approval of Minutes', categorie: 'documents', sur: 'objet', recherche: /^Minutes of/i,
    definition: 'Council adopts the minutes of an earlier meeting. They become the official record only then.',
    ouVousLeVoyez: 'Cards titled “Minutes of the … Meeting”.' },
  { terme: 'Rezoning', categorie: 'urbanisme', sur: 'texte', recherche: /Rezoning|Zone Amendment|Zoning By-law/i, aussi: 'Zone Amendment',
    definition: 'A change to the zoning by-law (Z-5) that sets what can be built on a property.',
    ouVousLeVoyez: 'Cards titled “By-law No. Z-5.… – Rezoning”.' },
  { terme: 'Public Hearing', categorie: 'urbanisme', sur: 'texte', recherche: /public hearing/i,
    definition: 'Before deciding a rezoning, Council hears anyone who wishes to speak. The Mayor then closes the hearing and Council votes.',
    ouVousLeVoyez: 'The second reading of a zoning by-law.' },
  { terme: 'Terms and conditions', categorie: 'urbanisme', sur: 'texte', recherche: /terms and conditions/i, aussi: 'Section 59',
    definition: 'Conditions Council attaches to a rezoning under section 59 of the Community Planning Act, which the owner must meet.',
    ouVousLeVoyez: 'A card in the series of each rezoning.' },
  { terme: 'PID', categorie: 'urbanisme', sur: 'texte', recherche: /PID/i, aussi: 'Parcel identifier',
    definition: 'The number that identifies a piece of land in Service New Brunswick’s registry.',
    ouVousLeVoyez: 'Land purchases, sales and exchanges.' },
  { terme: 'Funding agreement', categorie: 'argent', sur: 'texte', recherche: /funding|contribution agreement/i,
    definition: 'An agreement under which another government pays part of a City project.',
    ouVousLeVoyez: 'Cards on grants from the province or from Ottawa.' },
  { terme: 'Purchase and sale', categorie: 'argent', sur: 'texte', recherche: /Purchase and Sale|acquisition|disposal|conveyance/i,
    definition: 'The City buys, sells or exchanges land. Council authorizes the Mayor and the City Clerk to sign the documents.',
    ouVousLeVoyez: 'Cards on land and buildings.' },
];

async function lireJson(chemin) {
  try { return JSON.parse(await readFile(chemin, 'utf8')); } catch { return null; }
}

async function main() {
  const decisions = await lireJson('data/decisions.json');
  const votes = await lireJson('data/votes.json');
  if (!decisions || !votes) throw new Error('data/decisions.json ou data/votes.json manquant — lancer d’abord scrapers/votes.js');

  const points = decisions.decisions;
  const bulletins = [];
  for (const v of votes.votes) {
    for (const [statut, liste] of [['In Favour', v.pour], ['In Opposition', v.contre], ['Abstain', v.abstentions], ['Absent', v.absents], ['Declared Conflict', v.conflits], ['Ineligible', v.inadmissibles], ['No Vote', v.sansVote]]) {
      for (const membre of liste ?? []) bulletins.push({ statut, membre });
    }
  }
  const seances = decisions.seances ?? [];

  const entrees = TERMES.map((t) => {
    let occurrences;
    let exemple = null;
    if (t.sur === 'texte') {   // N.-B.
      const trouves = points.filter((p) => t.recherche.test(`${p.objet ?? ''} ${p.texte ?? ''}`));
      occurrences = { points: trouves.length, surTotal: points.length };
      if (trouves[0]) exemple = { numero: trouves[0].numero, objet: trouves[0].objet, date: trouves[0].date, instance: trouves[0].instance };
    } else if (t.sur === 'objet') {
      const trouves = points.filter((p) => t.recherche.test(p.objet ?? ''));
      occurrences = { points: trouves.length, surTotal: points.length };
      if (trouves[0]) exemple = { numero: trouves[0].numero, objet: trouves[0].objet, date: trouves[0].date, instance: trouves[0].instance };
    } else if (t.sur === 'instance') {
      const s = seances.filter((x) => t.recherche.test(x.instance ?? ''));
      const p = points.filter((x) => t.recherche.test(x.instance ?? ''));
      occurrences = { seances: s.length, points: p.length, surTotal: points.length };
      if (p[0]) exemple = { numero: p[0].numero, objet: p[0].objet, date: p[0].date, instance: p[0].instance };
    } else if (t.sur === 'vote') {
      const b = bulletins.filter((x) => t.recherche.test(x.statut));
      occurrences = { bulletins: b.length, surTotal: bulletins.length };
      const p = votes.votes.find((v) => ({ 'In Favour': v.pour, 'In Opposition': v.contre, Abstain: v.abstentions, Absent: v.absents, 'Declared Conflict': v.conflits, Ineligible: v.inadmissibles, 'No Vote': v.sansVote }[b[0]?.statut] ?? []).length);
      if (p) exemple = { numero: p.numero, objet: p.objet, date: p.date, instance: p.instance };
    } else if (t.sur === 'resultat') {
      const p = points.filter((x) => t.recherche.test(x.resultat ?? ''));
      occurrences = { points: p.length, surTotal: points.length };
      if (p[0]) exemple = { numero: p[0].numero, objet: p[0].objet, date: p[0].date, instance: p[0].instance };
    } else if (t.sur === 'bulletin') {
      const b = bulletins.filter((x) => t.recherche.test(x.membre));
      occurrences = { bulletins: b.length, membres: new Set(b.map((x) => x.membre)).size, surTotal: bulletins.length };
    }
    return {
      terme: t.terme,
      categorie: t.categorie,
      ...(t.aussi ? { aussi: t.aussi } : {}),
      recherche: t.recherche.source,
      definition: t.definition,
      ouVousLeVoyez: t.ouVousLeVoyez,
      occurrences: { ...occurrences, periode: `${decisions.parametres.depuis} → ${decisions.parametres.jusqua}` },
      exemple,
    };
  });

  const sortie = {
    generatedAt: new Date().toISOString(),
    source: decisions.source,
    avertissement: 'The definitions in this glossary are written by DossierNBrunswick — they are not the City of Fredericton’s texts nor legal definitions. What comes from the minutes is the count of occurrences and the example under each term.',
    categories: CATEGORIES,
    parametres: decisions.parametres,
    nombre: entrees.length,
    entrees,
  };
  await writeFile('data/lexique.json.tmp', JSON.stringify(sortie, null, 1), 'utf8');
  await rename('data/lexique.json.tmp', 'data/lexique.json');
  // La version française : les mêmes termes, superposés par la page quand le français est choisi.
  const manquants = entrees.filter((e) => !ENTREES_FR[e.terme]).map((e) => e.terme);
  if (manquants.length) console.warn(`⚠ sans traduction française : ${manquants.join(', ')}`);
  const fr = { generatedAt: sortie.generatedAt, avertissement: 'Les définitions de ce lexique sont écrites par DossierNBrunswick — ce ne sont ni des textes de la Ville de Fredericton ni des définitions juridiques. Ce qui vient des procès-verbaux, c’est le nombre d’occurrences et l’exemple sous chaque terme.', categories: CATEGORIES_FR, entrees: ENTREES_FR };
  await writeFile('data/lexique-fr.json.tmp', JSON.stringify(fr, null, 1), 'utf8');
  await rename('data/lexique-fr.json.tmp', 'data/lexique-fr.json');
  const zero = entrees.filter((e) => !Object.values(e.occurrences).some((v) => typeof v === 'number' && v > 0 && v !== e.occurrences.surTotal));
  console.log(`${entrees.length} termes dans data/lexique.json ; ${zero.length} sans occurrence sur la fenêtre : ${zero.map((e) => e.terme).join(', ') || 'aucun'}.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
