// Scraper — le calendrier de l'Assemblée législative du Nouveau-Brunswick.
//
// Source : legnb.ca/en/calendar, dont la colonne « Upcoming Events » donne les prochaines
// séances de la Chambre et les réunions de comité, avec la date, l'heure et le lieu.
//
// POURQUOI C'EST IMPORTANT ICI : la maquette du site annonçait « reprise des travaux le
// 18 novembre 2026 ». Le calendrier officiel dit le 17 — et la Chambre siégeait déjà, donc ce
// n'était pas une reprise. Une date écrite à la main vieillit ou se trompe ; celle-ci se lit.
//
// Les dates sont prises sur la page ANGLAISE, où le mois est écrit en mots
// (« November 17, 2026 ») : aucune ambiguïté possible, contrairement aux dates en chiffres
// du site, qui s'inversent d'une langue à l'autre.
//
//   node scrapers/nb-calendrier.js

import { load } from 'cheerio';
import { lire, texte, ecrireJson, HOTE } from './nb-commun.js';

const SORTIE = 'data/calendrier.json';
const PAGE = '/en/calendar';

const MOIS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/** « November 17, 2026 » -> « 2026-11-17 » */
function dateDepuisMotsAnglais(s) {
  const m = String(s ?? '').match(/([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!m) return null;
  const mois = MOIS.indexOf(m[1]);
  if (mois < 0) return null;
  return `${m[3]}-${String(mois + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}

/** « Legislature 61-3 Daily Sitting 13 » -> { legislature: 61, session: 3, seance: 13 } */
function lireNumeroDeSeance(titre) {
  const m = String(titre).match(/Legislature\s+(\d+)-(\d+)\s+Daily Sitting\s+(\d+)/i);
  if (!m) return null;
  return { legislature: Number(m[1]), session: Number(m[2]), seance: Number(m[3]) };
}

async function main() {
  const $ = load(await lire(PAGE));
  const evenements = [];

  $('.upcoming-calendar-event-date').each((_, jour) => {
    const date = dateDepuisMotsAnglais(texte($(jour).find('h4').html()));
    if (!date) return;
    $(jour).find('.upcoming-calendar-event').each((__, ev) => {
      const $ev = $(ev);
      const lignes = $ev.find('.upcoming-calendar-event-description li')
        .map((___, li) => texte($(li).html()))
        .get()
        .filter(Boolean);
      const titre = lignes[0] || null;
      if (!titre) return;
      const heure = lignes.find((l) => /\b(AM|PM)\b/.test(l)) || null;
      const lieu = lignes.slice(1).find((l) => l !== heure) || null;
      const chemin = $ev.find('a').attr('href') || null;
      evenements.push({
        date,
        heure,
        titre,
        lieu,
        genre: texte($ev.find('.upcoming-calendar-event-type').html()) || null,
        seance: lireNumeroDeSeance(titre),
        source: chemin ? HOTE + chemin : null,
      });
    });
  });

  if (!evenements.length) {
    // Entre deux sessions, la colonne peut légitimement être vide : ce n'est pas une panne.
    console.warn('aucun événement à venir annoncé par le calendrier (la Chambre ne siège peut-être pas)');
  }

  const seances = evenements.filter((e) => e.seance);
  const prochaineSeance = seances[0] || null;
  const aujourdhui = new Date().toISOString().slice(0, 10);

  console.log(`${evenements.length} événements à venir, dont ${seances.length} séances de la Chambre`);
  if (prochaineSeance) {
    console.log(`prochaine séance : ${prochaineSeance.date} à ${prochaineSeance.heure}`
      + ` (séance ${prochaineSeance.seance.seance} de la session`
      + ` ${prochaineSeance.seance.legislature}-${prochaineSeance.seance.session})`);
  }

  ecrireJson(SORTIE, {
    luLe: new Date().toISOString(),
    lueLeJour: aujourdhui,
    source: HOTE + PAGE,
    prochaineSeance,
    evenements,
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
