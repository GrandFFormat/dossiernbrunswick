// Scraper — les projets de loi de la session en cours à l'Assemblée législative du N.-B.
//
// Source : legnb.ca, la page « Status of Legislation » d'une session, qui donne pour chaque
// projet ses étapes avec leurs dates réelles, puis la fiche de chaque projet, qui donne le
// type, le parrain, son parti et les liens vers les textes officiels.
//
// Trois choses que le Nouveau-Brunswick nous impose et qui sont écrites dans ce fichier :
//
// 1. LE NUMÉRO N'EST PAS UNE CLÉ. Chaque session repart à 1. La clé est donc
//    « législature-session-numéro » (61-3-14). Le Québec a le même piège.
//
// 2. LES DATES NE SE LISENT QU'EN ANGLAIS. La page anglaise écrit « 11/4/2026 » pour le
//    4 novembre, la française « 04/11/2026 » pour le même jour. Lire les deux donnerait deux
//    dates différentes pour un seul événement. On prend donc toutes les dates sur la page
//    anglaise et on ne garde du français que les titres et les libellés.
//
// 3. LES ÉTAPES NE SE SUIVENT PAS TOUJOURS DANS L'ORDRE. Un projet d'intérêt privé passe en
//    comité AVANT sa deuxième lecture. On publie donc les étapes telles que la page les donne,
//    avec leur date, sans jamais supposer un ordre.
//
//   node scrapers/nb-projets-de-loi.js            la session en cours
//   node scrapers/nb-projets-de-loi.js 61 2       une session précise

import { load } from 'cheerio';
import { lire, texte, dateDepuisAnglais, normaliserChemin, ecrireJson, HOTE } from './nb-commun.js';

const SORTIE = 'data/projets-de-loi.json';

// « Introduced: 11/4/2026 » / « Passed: 6/12/2026 » / « Defeated: 3/26/2026 ». Le mot dit le
// sort de l'étape ; c'est lui qui distingue un projet adopté d'un projet rejeté.
const RESULTATS = {
  Introduced: { fr: 'déposé', en: 'introduced' },
  Passed: { fr: 'adopté', en: 'passed' },
  Defeated: { fr: 'rejeté', en: 'defeated' },
  Received: { fr: 'reçue', en: 'received' },
  Withdrawn: { fr: 'retiré', en: 'withdrawn' },
  Discharged: { fr: 'retiré de l\'ordre du jour', en: 'discharged' },
};

/**
 * La session en cours. L'index des projets de loi est trié du plus récent au plus ancien et
 * chaque projet porte un lien /legislation/bills/{législature}/{session} : on prend la paire
 * la plus haute. On ne lit pas le menu déroulant de cette page — ses valeurs sont des
 * identifiants internes (« LegislativeSessionId=35 »), pas des numéros de session.
 */
async function sessionEnCours() {
  const html = await lire('/en/legislation/bills');
  const paires = [...html.matchAll(/\/legislation\/bills\/(\d+)\/(\d+)[/"]/g)]
    .map((m) => ({ leg: Number(m[1]), ses: Number(m[2]) }));
  if (!paires.length) throw new Error('aucune session trouvée sur /en/legislation/bills');
  paires.sort((a, b) => b.leg - a.leg || b.ses - a.ses);
  return paires[0];
}

/** Les projets d'une session, avec leurs étapes datées, depuis la page anglaise. */
function lireListe($, leg, ses) {
  const projets = [];
  $('li.bill-item').each((_, el) => {
    const $el = $(el);
    const numero = Number(texte($el.find('.bill-item-number').html()));
    const $lien = $el.find('.bill-item-title a').first();
    const titre = texte($lien.html());
    if (!numero || !titre) return;

    const etapes = [];
    $el.find('.bill-steps .step').each((__, pas) => {
      const $pas = $(pas);
      const spans = $pas.find('span').map((___, s) => texte($(s).html())).get();
      const nom = spans[0];
      if (!nom) return;
      // Une étape non franchie n'a qu'un libellé, sans date : on la garde pour montrer
      // le chemin qui reste, mais sans rien inventer.
      const brut = spans[1] || '';
      const motResultat = (brut.match(/^([A-Za-z]+)/) || [])[1];
      etapes.push({
        nom,
        franchie: $pas.hasClass('status-passed') || Boolean(brut),
        resultat: RESULTATS[motResultat] || (motResultat ? { fr: motResultat, en: motResultat } : null),
        date: dateDepuisAnglais(brut),
      });
    });

    projets.push({
      cle: `${leg}-${ses}-${numero}`,
      legislature: leg,
      session: ses,
      numero,
      titre: { fr: null, en: titre },
      cheminFiche: $lien.attr('href') || null,
      etapes,
    });
  });
  return projets;
}

/** Les titres français, pris sur la page française de la même session. */
function lireTitresFrancais($) {
  const parNumero = new Map();
  $('li.bill-item').each((_, el) => {
    const $el = $(el);
    const numero = Number(texte($el.find('.bill-item-number').html()));
    const titre = texte($el.find('.bill-item-title a').first().html());
    if (numero && titre) parNumero.set(numero, titre);
  });
  return parNumero;
}

/**
 * La fiche d'un projet : type, parrain, parti, circonscription, documents.
 * La page présente ces champs comme des paires étiquette / valeur ; on les lit par leur
 * étiquette anglaise plutôt que par leur position, qui change d'un projet à l'autre
 * (un projet sans amendement n'a pas la même liste de documents).
 */
function lireFiche(html) {
  const $ = load(html);
  const fiche = { type: null, statut: null, parrain: null, documents: { amendements: [] } };

  // Chaque propriété est un <span class="property-label">Étiquette</span> suivi de sa valeur,
  // en simple nœud texte, dans le même conteneur. On lit par l'étiquette et non par la
  // position : la liste des propriétés varie d'un projet à l'autre.
  const valeurDe = (etiquette) => {
    let v = null;
    $('span.property-label').each((_, el) => {
      if (texte($(el).html()) !== etiquette) return;
      const $parent = $(el).parent().clone();
      $parent.find('span.property-label').remove();
      const t = texte($parent.html());
      if (t) v = t;
    });
    return v;
  };
  fiche.type = valeurDe('Bill Type');
  fiche.statut = valeurDe('Status');

  // Le parrain vit dans une carte de député·e, qui porte aussi la couleur officielle de son
  // parti (en bordure gauche) : on la prend ici plutôt que d'aller la chercher ailleurs.
  const $carte = $('.member-card').first();
  if ($carte.length) {
    const $parti = $carte.find('.member-card-description-party').clone();
    $parti.find('div').remove(); // la pastille de couleur
    fiche.parrain = {
      nom: texte($carte.find('.member-card-description-name').html()) || null,
      parti: texte($parti.html()) || null,
      circonscription: texte($carte.find('.member-card-description-riding span').html()) || null,
      couleurParti: (($carte.attr('style') || '').match(/#[0-9A-Fa-f]{6}/) || [])[0] || null,
      portrait: (() => {
        const src = normaliserChemin($carte.find('img').attr('src'));
        return src ? (src.startsWith('http') ? src : HOTE + src) : null;
      })(),
    };
  }

  // Les documents. Le PDF est bilingue (deux colonnes) ; les HTML sont une langue chacun.
  $('a[href]').each((_, el) => {
    const href = normaliserChemin($(el).attr('href'));
    if (!/\/content\/house_business\//i.test(href)) return;
    const abs = href.startsWith('http') ? href : HOTE + href;
    if (/-e\.html?$/i.test(href)) fiche.documents.htmlEn = abs;
    else if (/-f\.html?$/i.test(href)) fiche.documents.htmlFr = abs;
    else if (/SectionArticle\d+\.pdf$/i.test(href)) fiche.documents.amendements.push(abs);
    else if (/\.pdf$/i.test(href)) fiche.documents.pdfBilingue = abs;
  });

  return fiche;
}

async function main() {
  const [argLeg, argSes] = process.argv.slice(2).map(Number);
  const { leg, ses } = argLeg && argSes ? { leg: argLeg, ses: argSes } : await sessionEnCours();
  console.log(`Session lue : ${leg}e législature, ${ses}e session`);

  const htmlEn = await lire(`/en/legislation/bills/${leg}/${ses}`);
  const $en = load(htmlEn);
  const projets = lireListe($en, leg, ses);
  if (!projets.length) throw new Error(`aucun projet de loi trouvé pour ${leg}-${ses}`);

  // Le site affiche lui-même ses totaux : on les compare aux nôtres plutôt que de les croire
  // sur parole. Un écart veut dire que la page a changé de forme et que le scraper doit être relu.
  const annonce = Number((texte($en.html()).match(/Total Bills:\s*(\d+)/) || [])[1]);
  if (annonce && annonce !== projets.length) {
    throw new Error(`la page annonce ${annonce} projets de loi, j'en ai lu ${projets.length} — le gabarit a changé, scraper à relire`);
  }
  console.log(`${projets.length} projets de loi, conformes au total annoncé par le site`);

  const titresFr = lireTitresFrancais(load(await lire(`/fr/l%C3%A9gislation/projets-de-loi/${leg}/${ses}`)));
  for (const p of projets) p.titre.fr = titresFr.get(p.numero) || null;
  const sansFr = projets.filter((p) => !p.titre.fr).map((p) => p.numero);
  if (sansFr.length) console.warn(`sans titre français : ${sansFr.join(', ')}`);

  for (const p of projets) {
    if (!p.cheminFiche) continue;
    const fiche = lireFiche(await lire(p.cheminFiche));
    p.type = fiche.type;
    p.statut = fiche.statut;
    p.parrain = fiche.parrain;
    p.documents = fiche.documents;
    p.source = {
      en: HOTE + p.cheminFiche,
      fr: `${HOTE}/fr/l%C3%A9gislation/projets-de-loi/${leg}/${ses}/${p.numero}/x`,
    };
    delete p.cheminFiche;
    console.log(`  no ${String(p.numero).padStart(2)} ${p.statut || '—'} · ${p.parrain?.nom || 'sans parrain'}`);
  }

  ecrireJson(SORTIE, {
    legislature: leg,
    session: ses,
    luLe: new Date().toISOString(),
    source: `${HOTE}/en/legislation/bills/${leg}/${ses}`,
    avis: 'La version imprimée reste la version officielle (avis de l\'Assemblée législative du N.-B.).',
    projets,
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
