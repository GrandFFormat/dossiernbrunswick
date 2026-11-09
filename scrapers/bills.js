// Scraper — les projets de loi de la législature en cours, au format de DossierQuébec.
//
// Source : legnb.ca, page « État des projets de loi » de chaque session (étapes et dates réelles),
// en anglais ET en français, puis la fiche de chaque projet dans les deux langues (type, parrain,
// textes officiels). Rien n'est traduit : le titre français, le type français et les libellés
// viennent des pages françaises de l'Assemblée.
//
// Pièges du Nouveau-Brunswick, réglés ici :
//   1. LE NUMÉRO N'EST PAS UNE CLÉ : chaque session repart à 1. La clé est législature + session
//      + numéro, et l'identifiant numérique (id) en est tiré.
//   2. LES DATES NE SE LISENT QU'EN ANGLAIS : « 11/4/2026 » (m/j) en anglais, « 04/11/2026 » (j/m)
//      en français pour le même jour. Toutes les dates viennent de la page anglaise.
//   3. L'ADRESSE FRANÇAISE NE SE DEVINE PAS : la fiche française et le texte français (-f.htm) se
//      lisent sur la page française, jamais déduits de l'anglaise.
//   4. LA PAGE ANNONCE SON TOTAL (« Total Bills: 14 ») : on le compare au nôtre ; un écart arrête
//      tout, les données de la veille restent.
//
// Statuts (ceux de DossierQuébec, commun/dq.js) :
//   - 'sanctionne'     : sanction royale reçue ;
//   - 'encours'        : session en cours, pas encore sanctionné ;
//   - 'laisse_de_cote' : d'une session antérieure de la législature, jamais sanctionné — mort à la
//                        prorogation (fait lu sur la page, pas une supposition), ou rejeté / retiré
//                        quand la page le dit (la note le précise).
//
// Une fiche ne change que quand une étape avance : on ne la relit que pour un projet nouveau ou
// dont les étapes ont changé depuis le dernier passage (_signature).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { lirePage, texte, dateAnglaise, absolue, plierNom, HOTE } from './nb-commun.js';

const OUT_PATH = 'data/bills.json';

// Les étapes de la page, sur l'échelle de DossierQuébec (1 présentation … 5 sanction). Le site
// affiche trois cases (displayStep, commun/dq.js) : 1, puis 2 à 4, puis 5. Comme en Saskatchewan,
// la 3e lecture va dans la dernière case (« Troisième lecture / Sanction »).
const ETAPES = [
  { re: /^1\s*st Reading/i, cle: 'premiere', step: 1 },
  { re: /^2\s*nd Reading/i, cle: 'deuxieme', step: 2 },
  { re: /^Committee/i, cle: 'comite', step: 3 },
  { re: /^3\s*rd Reading/i, cle: 'troisieme', step: 5 },
  { re: /^Royal Assent/i, cle: 'sanction', step: 5 },
];

/** La législature la plus récente et ses sessions, lues dans le menu de la page des projets. */
async function sessionsEnCours() {
  const $ = await lirePage('/en/legislation/bills');
  const vues = new Set();
  const paires = [];
  for (const m of texte($('body').html()).matchAll(/(\d+)(?:st|nd|rd|th) Legislature - (\d+)(?:st|nd|rd|th) Session/g)) {
    if (vues.has(`${m[1]}-${m[2]}`)) continue;
    vues.add(`${m[1]}-${m[2]}`);
    paires.push({ leg: Number(m[1]), ses: Number(m[2]) });
  }
  if (!paires.length) throw new Error('aucune session lue sur /en/legislation/bills');
  const leg = Math.max(...paires.map((p) => p.leg));
  return { leg, sessions: paires.filter((p) => p.leg === leg).map((p) => p.ses).sort((a, b) => a - b) };
}

/** La liste d'une session : titre, lien vers la fiche, étapes (datées sur la page anglaise). */
function lireListe($, enAnglais) {
  const projets = new Map();
  $('li.bill-item').each((_, el) => {
    const $el = $(el);
    const num = Number(texte($el.find('.bill-item-number').html()));
    const $lien = $el.find('.bill-item-title a').first();
    if (!num) return;
    const etapes = $el.find('.bill-steps .step').map((__, pas) => {
      const spans = $(pas).find('span').map((___, s) => texte($(s).html())).get();
      return { nom: spans[0] || '', brut: spans[1] || '' };
    }).get();
    projets.set(num, {
      num,
      titre: texte($lien.html()) || null,
      fiche: absolue($lien.attr('href')),
      amende: $el.find('.bill-amendment-count').length > 0,   // la pastille « Amended » de la page
      lu: enAnglais ? lireDates(etapes) : null,
    });
  });
  return projets;
}

function lireDates(etapes) {
  const dates = {};
  const issues = {};
  for (const e of etapes) {
    const def = ETAPES.find((x) => x.re.test(e.nom));
    if (!def || !e.brut) continue;
    const d = dateAnglaise(e.brut);
    if (d) dates[def.cle] = d;
    const mot = (e.brut.match(/^([A-Za-z]+)/) || [])[1] || null;
    if (mot) issues[def.cle] = mot;   // Introduced, Passed, Defeated, Withdrawn…
  }
  return { dates, issues };
}

/** La fiche : type, parrain, textes. On lit par étiquette, jamais par position. */
function lireFiche($) {
  const valeur = (...etiquettes) => {
    let v = null;
    $('.property-label').each((_, el) => {
      if (v || !etiquettes.includes(texte($(el).html()))) return;
      const $p = $(el).parent().clone();
      $p.find('.property-label').remove();
      v = texte($p.html()) || null;
    });
    return v;
  };
  const docs = { htmlEn: null, htmlFr: null, pdf: null };
  $('a[href]').each((_, a) => {
    const href = absolue($(a).attr('href'));
    if (!/\/content\/house_business\//i.test(href)) return;
    if (/-e\.html?$/i.test(href)) docs.htmlEn ??= href;
    else if (/-f\.html?$/i.test(href)) docs.htmlFr ??= href;
    else if (/\.pdf$/i.test(href) && !/SectionArticle/i.test(href)) docs.pdf ??= href;
  });
  const carte = $('.member-card').first();
  return {
    type: valeur('Bill Type', 'Type de projet de loi'),
    parrain: carte.length ? texte(carte.find('.member-card-description-name').html()) || null : null,
    parrainFiche: carte.length ? absolue(carte.find('.member-card-description-name a').attr('href')) : null,
    docs,
  };
}

function statutEtNote(dates, issues, ses, sessionFinie) {
  const rejet = Object.entries(issues).find(([, mot]) => /^Defeated$/i.test(mot));
  const retrait = Object.entries(issues).find(([, mot]) => /^(Withdrawn|Discharged)$/i.test(mot));
  if (dates.sanction) return ['sanctionne', `Sanctionné le ${dates.sanction}`, `Received Royal Assent on ${dates.sanction}`];
  if (rejet) return ['laisse_de_cote', `Rejeté le ${dates[rejet[0]] ?? '(date non publiée)'}`, `Defeated on ${dates[rejet[0]] ?? '(date not published)'}`];
  if (retrait) return ['laisse_de_cote', `Retiré le ${dates[retrait[0]] ?? '(date non publiée)'}`, `Withdrawn on ${dates[retrait[0]] ?? '(date not published)'}`];
  const derniere = Object.values(dates).sort().pop() ?? null;
  if (sessionFinie) {
    return ['laisse_de_cote',
      `Mort au Feuilleton à la fin de la session ${ses}${derniere ? `, dernière activité le ${derniere}` : ''}`,
      `Died on the Order Paper at the end of session ${ses}${derniere ? `, last activity on ${derniere}` : ''}`];
  }
  if (dates.troisieme) return ['encours', `Adopté en troisième lecture le ${dates.troisieme}, en attente de la sanction royale`, `Passed third reading on ${dates.troisieme}, awaiting Royal Assent`];
  if (dates.comite) return ['encours', `Étude en comité terminée le ${dates.comite}`, `Committee stage completed on ${dates.comite}`];
  if (dates.deuxieme) return ['encours', `Adopté en deuxième lecture le ${dates.deuxieme}`, `Passed second reading on ${dates.deuxieme}`];
  return ['encours', `Déposé le ${dates.premiere ?? '(date non publiée)'}`, `Introduced on ${dates.premiere ?? '(date not published)'}`];
}

// « Hon. Susan HOLT » → « Holt, Susan » : seulement si la fiche du parrain ne se rapproche pas
// de la liste des député·e·s (ancien·ne député·e, par exemple).
function officielDepuisFiche(nom) {
  // « Robert MCKEE, K.C. » : le titre professionnel tombe avec la virgule.
  const propre = String(nom || '').replace(/^(Hon\.|Honourable|L['’]hon\.)\s+/i, '').replace(/,\s*([A-Z]\.)+\s*$/i, '').trim();
  const mots = propre.split(/\s+/);
  const i = mots.findIndex((m) => /^[A-ZÀ-Ý][A-ZÀ-Ý'’-]+$/.test(m) && m.length > 1);
  if (i <= 0) return propre || null;
  const famille = mots.slice(i).join(' ').toLowerCase().replace(/(^|[\s'’-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  return `${famille}, ${mots.slice(0, i).join(' ')}`;
}

// Les résumés en langage clair déjà écrits (data/resumes.json : faits le 7 nov. 2026 par la
// version précédente du site, une passe par langue depuis le texte officiel de cette langue).
// Au format de DossierQuébec : une puce par ligne (« - … »), marqués comme écrits par une IA.
// Un projet purement procédural (sansContenu) n'a pas de résumé : on n'affiche rien de creux.
const RESUMES = existsSync('data/resumes.json') ? JSON.parse(readFileSync('data/resumes.json', 'utf-8')) : null;
function resumeDe(leg, ses, num) {
  const vide = { summary: null, summaryEn: null };
  if (!RESUMES) return vide;
  // Clé « 61-2-45-fr » (scrapers/nb-resumes.js, toutes sessions, 8 nov. 2026), sinon l'ancienne
  // clé « 14-fr » des résumés du 7 nov., valable pour la législature et la session du fichier.
  const entree = (langue) => RESUMES.resumes[`${leg}-${ses}-${num}-${langue}`]
    ?? (RESUMES.legislature === leg && RESUMES.session === ses ? RESUMES.resumes[`${num}-${langue}`] : null);
  const lire = (langue) => {
    const r = entree(langue);
    if (!r || r.sansContenu || !r.puces?.length) return null;
    // Texte trop long, lu en partie seulement : la fiche le dit (règle 2 du guide).
    const tronque = r.tronque ? [langue === 'en'
      ? '(Summary based on the start of the official text only: the bill is too long to be read in full.)'
      : '(Résumé tiré du début du texte officiel seulement : le projet est trop long pour être lu en entier.)'] : [];
    return [...r.puces, ...tronque].map((p) => `- ${p}`).join('\n');
  };
  const summary = lire('fr');
  const summaryEn = lire('en');
  if (!summary && !summaryEn) return vide;
  return {
    summary, summaryEn,
    summaryAiGenerated: true,
    summarySource: 'texte officiel tel que déposé, une passe par langue',
    summaryGeneratedAt: entree('fr')?.faitLe ?? RESUMES.luLe ?? null,
  };
}

async function main() {
  const { leg, sessions } = await sessionsEnCours();
  console.log(`${leg}e législature, sessions ${sessions.join(', ')}`);
  const derniereSession = Math.max(...sessions);

  const avant = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf-8')) : { bills: [] };
  const avantParId = new Map((avant.bills || []).filter((b) => b.legislature === leg).map((b) => [b.id, b]));
  const deputes = existsSync('data/deputes.json') ? JSON.parse(readFileSync('data/deputes.json', 'utf-8')).deputes || [] : [];
  const deputeParId = new Map(deputes.map((d) => [Number(d.assnatId), d]));
  const idDeFiche = (url) => Number((String(url || '').match(/\/members\/[^/]+\/(\d+)\//) || [])[1]) || null;
  // « Famille, Prénom » (les titres comme « K.C. » retirés) → une seule personne, ou rien.
  const cleNom = (officiel) => {
    const [famille, ...reste] = String(officiel || '').split(',').map((s) => s.trim());
    const prenom = reste.filter((p) => !/^([A-Z]\.)+$/i.test(p)).join(' ');
    return plierNom(`${prenom} ${famille}`);
  };
  const deputeParNom = (officiel) => {
    const trouves = deputes.filter((d) => cleNom(d.officiel) === cleNom(officiel));
    return trouves.length === 1 ? trouves[0] : null;
  };

  const bills = [];
  let fichesLues = 0;
  for (const ses of sessions) {
    const $en = await lirePage(`/en/legislation/bills/${leg}/${ses}`);
    const page = texte($en('body').html());
    if (!new RegExp(`Status Of Bills for : ${leg}\\w* Legislature - ${ses}\\w* Session`, 'i').test(page)) {
      throw new Error(`la page ${leg}/${ses} ne dit pas « législature ${leg}, session ${ses} » — adresse ou gabarit changé`);
    }
    const en = lireListe($en, true);
    const annonce = Number((page.match(/Total Bills:\s*(\d+)/) || [])[1]);
    if (annonce !== en.size) throw new Error(`session ${leg}-${ses} : la page annonce ${annonce} projets, j'en lis ${en.size}`);
    const frListe = lireListe(await lirePage(`/fr/l%C3%A9gislation/projets-de-loi/${leg}/${ses}`), false);
    if (frListe.size !== en.size) throw new Error(`session ${leg}-${ses} : ${en.size} projets en anglais, ${frListe.size} en français`);
    console.log(`  session ${ses} : ${en.size} projets, conformes au total annoncé`);

    for (const p of en.values()) {
      const pf = frListe.get(p.num);
      const id = leg * 100000 + ses * 1000 + p.num;
      const signature = JSON.stringify(p.lu);
      const ancien = avantParId.get(id);
      let fiche = ancien && ancien._signature === signature ? ancien._fiche : null;
      if (!fiche) {
        const ficheEn = lireFiche(await lirePage(p.fiche));
        const ficheFr = pf?.fiche ? lireFiche(await lirePage(pf.fiche)) : null;
        fichesLues++;
        fiche = {
          type: ficheEn.type, typeFr: ficheFr?.type ?? null,
          parrain: ficheEn.parrain, parrainId: idDeFiche(ficheEn.parrainFiche),
          htmlEn: ficheEn.docs.htmlEn, htmlFr: ficheFr?.docs.htmlFr ?? null,
          pdf: ficheEn.docs.pdf ?? ficheFr?.docs.pdf ?? null,
        };
        process.stdout.write(`    ${ses}-${p.num} `);
      }

      // Le parrain sous la forme officielle « Famille, Prénom » de la liste des député·e·s. La carte
      // du parrain, sur la fiche d'un projet, n'a pas de lien vers sa fiche de député·e : on la
      // rapproche par le numéro de fiche s'il existe, sinon par le prénom ET le nom de famille
      // (« Hon. Aaron KENNEDY » → « Kennedy, Aaron »), et seulement si une seule personne correspond.
      const depute = deputeParId.get(fiche.parrainId) ?? deputeParNom(officielDepuisFiche(fiche.parrain));
      const sponsor = depute?.officiel ?? officielDepuisFiche(fiche.parrain);
      const { dates, issues } = p.lu;
      const [status, note, noteEn] = statutEtNote(dates, issues, ses, ses !== derniereSession);
      const step = Math.max(0, ...Object.keys(dates).map((k) => ETAPES.find((e) => e.cle === k)?.step ?? 0)) || null;
      bills.push({
        id,
        num: p.num,
        legislature: leg,
        introSession: ses,
        type: fiche.typeFr || fiche.type,
        typeEn: fiche.type,
        title: pf?.titre || p.titre,
        titleEn: p.titre,
        titleFrOfficiel: Boolean(pf?.titre),
        status,
        step,
        note,
        noteEn,
        presentedOn: dates.premiere ?? null,
        lastActivity: Object.values(dates).sort().pop() ?? null,
        dates,
        amende: p.amende,
        url: pf?.fiche ?? p.fiche,
        urlEn: p.fiche,
        sponsor,
        sponsorId: depute ? depute.assnatId : null,
        texteHtmlFr: fiche.htmlFr,
        texteHtmlEn: fiche.htmlEn,
        presentationPdfUrl: fiche.pdf,
        ...resumeDe(leg, ses, p.num),
        _signature: signature,
        _fiche: fiche,
      });
    }
  }
  if (fichesLues) process.stdout.write('\n');

  bills.sort((a, b) => String(b.lastActivity ?? '').localeCompare(String(a.lastActivity ?? '')) || b.id - a.id);
  writeFileSync(OUT_PATH, JSON.stringify({
    source: `${HOTE}/en/legislation/bills`,
    legislature: leg,
    scrapedAt: new Date().toISOString(),
    avis: 'La version imprimée reste la version officielle (avis de l\'Assemblée législative du Nouveau-Brunswick).',
    count: bills.length,
    bills,
  }, null, 2) + '\n');

  const compte = (s) => bills.filter((b) => b.status === s).length;
  console.log(`${bills.length} projets écrits dans ${OUT_PATH} (${fichesLues} fiches lues) — sanctionnés ${compte('sanctionne')}, en cours ${compte('encours')}, laissés de côté ${compte('laisse_de_cote')}`);
  const manque = (f) => bills.filter(f).map((b) => `${b.introSession}-${b.num}`).join(', ');
  if (manque((b) => !b.sponsor)) console.log(`  ⚠ sans parrain lu : ${manque((b) => !b.sponsor)}`);
  if (manque((b) => !b.sponsorId)) console.log(`  ⚠ parrain hors de la liste actuelle : ${manque((b) => !b.sponsorId)}`);
  if (manque((b) => !b.titleFrOfficiel)) console.log(`  ⚠ sans titre français : ${manque((b) => !b.titleFrOfficiel)}`);
  const rejetes = bills.filter((b) => /^(Rejeté|Retiré)/.test(b.note));
  if (rejetes.length) console.log(`  rejetés ou retirés : ${rejetes.map((b) => `${b.introSession}-${b.num} (${b.note})`).join(', ')}`);
}

main().catch((err) => {
  console.error('\nÉchec du scraper bills.js :', err.message);
  process.exitCode = 1;
});
