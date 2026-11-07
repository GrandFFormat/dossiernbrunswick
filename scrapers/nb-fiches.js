// Scraper — la fiche de chaque député·e, dans les deux langues.
//
// POURQUOI UNE LECTURE PAR PERSONNE. La liste des député·e·s ne donne ni les fonctions ni
// les titres : elle ne porte que le nom, le parti et la circonscription. Les fonctions —
// « première ministre », « chef de l'opposition officielle », « leader parlementaire » —
// ne figurent que sur la fiche individuelle. C'est la seule source pour savoir qui dirige
// un parti, et la seule qui donne les portefeuilles EN FRANÇAIS.
//
// L'ADRESSE FRANÇAISE NE SE DEVINE PAS. La fiche anglaise de la première ministre est
// /en/members/current/182/holt-susan, la française /fr/parlementaires/actuel/182/susan-holt :
// le nom est retourné. On lit donc le lien « Français » sur la page anglaise, on ne
// fabrique jamais l'adresse.
//
// LE COÛT. 49 personnes × 2 langues = 98 lectures, une toutes les dix secondes comme
// legnb.ca le demande : seize minutes. Les fonctions changent rarement — ce scraper tourne
// une fois par semaine, pas tous les jours.
//
//   node scrapers/nb-fiches.js

import { load } from 'cheerio';
import { lire, texte, ecrireJson, HOTE, existe } from './nb-commun.js';
import { readFileSync } from 'node:fs';

const SORTIE = 'data/fiches.json';
const SOURCE = 'data/deputes.json';

/** Les fonctions, le parti et la circonscription, tels que la fiche les écrit. */
function lireFiche(html) {
  const $ = load(html);
  const meta = $('.member-details-meta span').map((_, e) => texte($(e).html())).get();
  return {
    nom: texte($('#member-profile-header h1').html()) || null,
    roles: $('.member-details-positions li').map((_, e) => texte($(e).html())).get().filter(Boolean),
    parti: meta[0] || null,
    circonscription: meta[1] || null,
  };
}

async function main() {
  if (!existe(SOURCE)) {
    throw new Error(`${SOURCE} manque — lancer scrapers/nb-deputes.js d'abord.`);
  }
  const { deputes } = JSON.parse(readFileSync(SOURCE, 'utf8'));
  console.log(`Fiches des député·e·s — ${deputes.length} personnes, deux langues chacune`);
  console.log('une lecture toutes les dix secondes : comptez une quinzaine de minutes');

  const fiches = [];
  for (const d of deputes) {
    if (!d.fiche) throw new Error(`${d.nomAffiche} n'a pas de fiche officielle dans ${SOURCE}.`);

    const htmlEn = await lire(d.fiche);
    const en = lireFiche(htmlEn);

    // Le lien « Français » de la fiche anglaise : la seule adresse française qui soit sûre.
    const $ = load(htmlEn);
    const versFr = $('a[href^="/fr/"]').first().attr('href');
    if (!versFr) throw new Error(`${d.nomAffiche} : la fiche anglaise ne porte pas de lien vers le français.`);
    const fr = lireFiche(await lire(HOTE + versFr));

    // Un garde-fou : les deux fiches doivent parler de la même personne. Les adresses se
    // ressemblent trop pour qu'une erreur de lien se voie autrement.
    //
    // Les honorifiques se traduisent, eux aussi : « Hon. Robert McKee, K.C. » devient
    // « l'hon. Robert McKee, c.r. » — conseiller du roi. On les retire des deux côtés avant
    // de comparer, sinon le garde-fou crie au loup sur une fiche parfaitement bonne.
    const memeNom = (a, b) => {
      const net = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().trim()
        // L'honorifique est EN TÊTE : « l'hon. », « hon. », « m. », « mme ». On ne l'enlève
        // que là, pour ne pas croquer une initiale au milieu d'un nom.
        .replace(/^(l'hon\.?|hon\.?|mme|mlle|m\.|mr\.?|ms\.?|mrs\.?|dr\.?)\s+/, '')
        // Le titre professionnel est EN QUEUE, après une virgule : « , K.C. », « , c.r. ».
        .replace(/,\s*[a-z.\s]{1,6}$/, '')
        .replace(/[^a-z]+/g, '');
      return net(a) === net(b);
    };
    if (!memeNom(en.nom, fr.nom)) {
      throw new Error(`${d.nomAffiche} : la fiche anglaise dit « ${en.nom} » et la française « ${fr.nom} ». Lien suivi de travers, rien n'est publié.`);
    }

    fiches.push({
      nomAffiche: d.nomAffiche,
      roles: { en: en.roles, fr: fr.roles },
      parti: { en: en.parti, fr: fr.parti },
      circonscription: { en: en.circonscription, fr: fr.circonscription },
      fiche: { en: d.fiche, fr: HOTE + versFr },
    });

    const quoi = en.roles.length ? en.roles.join(' · ') : 'aucune fonction publiée';
    console.log(`  ${String(fiches.length).padStart(2)}/${deputes.length}  ${d.nomAffiche} — ${quoi}`);
  }

  const chefs = fiches.filter((f) => f.roles.en.some((r) => /\bleader\b/i.test(r)));
  console.log(`\n${fiches.length} fiches lues`);
  console.log(`chefs et leaders repérés : ${chefs.length ? chefs.map((c) => c.nomAffiche).join(', ') : 'aucun'}`);

  ecrireJson(SORTIE, { luLe: new Date().toISOString(), source: `${HOTE}/en/members/current`, fiches });
}

main().catch((e) => { console.error(e.message); process.exit(1); });
