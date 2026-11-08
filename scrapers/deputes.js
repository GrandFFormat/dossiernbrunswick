// Scraper — les 49 député·e·s de l'Assemblée législative du Nouveau-Brunswick, au format de
// DossierQuébec (name, riding, region, party, partyFull, assnatId).
//
// Source : legnb.ca, « Parlementaires actuels », en anglais ET en français (un appel chacune).
// Chaque carte donne le nom officiel (« Holt, Susan »), le parti, la circonscription et le lien
// vers la fiche, qui porte un numéro stable (/en/members/current/182/holt-susan) : c'est lui qui
// tient lieu d'identifiant (assnatId), comme le numéro d'assnat.qc.ca sur DossierQuébec.
//
// Vérifications, sinon rien n'est écrit (les données de la veille restent) :
//   - le total par parti de l'encadré « Party Standings » = ce qu'on a compté ;
//   - chaque parti est connu (nb-commun.js, PARTIS) : on n'étiquette personne au hasard ;
//   - les pages anglaise et française nomment les mêmes personnes (même numéro de fiche).
//
// La présidence : la page des présidents de l'Assemblée nomme la personne en poste (« 2024 -
// present »). Elle ne vote pas, sauf pour départager : on la marque role: 'speaker'.
//
// Les courriels : legnb.ca les masque (protection de Cloudflare). On ne les décode pas : voir
// depute-emails.js.
//
// La région : l'Assemblée n'en donne pas. Le champ reste vide (null) plutôt que deviné.

import { writeFileSync } from 'node:fs';
import { lirePage, texte, absolue, nomCourant, plierNom, PARTIS, HOTE } from './nb-commun.js';

const PAGE_EN = '/en/members/current';
const PAGE_FR = '/fr/parlementaires/actuel';
const OUT_PATH = 'data/deputes.json';

const numeroFiche = (href) => Number((String(href || '').match(/\/(\d+)\/[^/]*$/) || [])[1]) || null;

function lireCartes($) {
  return $('.member-card').map((_, el) => {
    const $c = $(el);
    const $parti = $c.find('.member-card-description-party').clone();
    $parti.find('div').remove();
    const lien = $c.find('.member-card-description-name a').attr('href');
    return {
      officiel: texte($c.find('.member-card-description-name').html()),
      parti: texte($parti.html()),
      riding: texte($c.find('.member-card-description-riding span').html()),
      fiche: absolue(lien),
      id: numeroFiche(lien),
      photo: absolue($c.find('img').attr('src')),
    };
  }).get().filter((c) => c.officiel && c.id);
}

function lireComposition($, motif) {
  const t = texte($('body').html());
  const bloc = (t.match(motif) || [])[1] || '';
  const total = {};
  for (const m of bloc.matchAll(/(\d+)\s+([A-ZÀ-Ý][^\d]*?)(?=\s+\d+\s|$)/g)) total[m[2].trim()] = Number(m[1]);
  return total;
}

async function main() {
  const $en = await lirePage(PAGE_EN);
  const $fr = await lirePage(PAGE_FR);
  const $pres = await lirePage('/en/members/speakers');

  const en = lireCartes($en);
  const fr = new Map(lireCartes($fr).map((c) => [c.id, c]));

  const erreurs = [];
  if (!en.length) erreurs.push('aucune carte lue sur la page anglaise');
  const inconnus = [...new Set(en.map((c) => c.parti).filter((p) => !PARTIS[p]))];
  if (inconnus.length) erreurs.push(`parti inconnu : ${inconnus.join(', ')} (à ajouter dans nb-commun.js)`);
  const absentsFr = en.filter((c) => !fr.has(c.id));
  if (absentsFr.length || fr.size !== en.length) erreurs.push(`pages anglaise et française différentes (${en.length} / ${fr.size})`);

  const annonce = lireComposition($en, /Party Standings\s+(.*?)\s+Executive Council/);
  const compte = {};
  for (const c of en) compte[c.parti] = (compte[c.parti] || 0) + 1;
  for (const [parti, n] of Object.entries(annonce)) if (compte[parti] !== n) erreurs.push(`${parti} : la page annonce ${n}, j'en compte ${compte[parti] ?? 0}`);
  for (const parti of Object.keys(compte)) if (!(parti in annonce)) erreurs.push(`${parti} : absent de l'encadré « Party Standings »`);

  // La présidence en poste : la première personne de la liste dont le mandat finit par « present ».
  const presidents = texte($pres('main').html() || $pres('body').html());
  const nomPresident = (presidents.match(/Post-Confederation\s+(.+?)\s+Years served\s*:\s*\d{4}\s*-\s*present/i) || [])[1] || null;
  const president = en.find((c) => plierNom(nomCourant(c.officiel)) === plierNom(nomPresident));
  if (!president) erreurs.push(`présidence de l'Assemblée introuvable dans la liste (« ${nomPresident ?? 'aucun nom lu'} »)`);

  if (erreurs.length) {
    console.error(`deputes.js : rien n'est écrit —`);
    for (const e of erreurs) console.error(`  ✗ ${e}`);
    process.exitCode = 1;
    return;
  }

  const deputes = en.map((c) => {
    const p = PARTIS[c.parti];
    const f = fr.get(c.id);
    return {
      name: nomCourant(c.officiel),
      officiel: c.officiel,
      riding: f.riding || c.riding,
      ridingEn: c.riding,
      region: null,
      party: p.code,
      partyFull: p.fr,
      partyFullEn: p.en,
      assnatId: c.id,
      ...(c === president ? { role: 'speaker' } : {}),
      fiche: c.fiche,
      ficheFr: f.fiche,
      photo: c.photo,
    };
  }).sort((a, b) => a.officiel.localeCompare(b.officiel, 'fr'));

  writeFileSync(OUT_PATH, JSON.stringify({
    source: HOTE + PAGE_EN,
    sourceFr: HOTE + PAGE_FR,
    scrapedAt: new Date().toISOString(),
    sieges: en.length,
    count: deputes.length,
    deputes,
  }, null, 2) + '\n');

  console.log(`${deputes.length} député·e·s écrit·e·s dans ${OUT_PATH} — ${Object.entries(compte).map(([p, n]) => `${n} ${p}`).join(', ')} (conforme à la page)`);
  console.log(`  présidence : ${nomCourant(president.officiel)} (${president.riding})`);
}

main().catch((err) => {
  console.error('Échec du scraper deputes.js :', err.message);
  process.exitCode = 1;
});
