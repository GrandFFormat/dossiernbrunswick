// Les résolutions du conseil de Fredericton, lues dans les procès-verbaux (N.-B.).
//
//   node scrapers/votes.js            lit tous les PDF de pv-a-la-main/
//
// Même sortie que le scraper de Vancouver (dont ce volet est la copie) : seances.json,
// decisions.json, votes.json, votes-decisions.json, robots.json — même forme, pour que les pages
// n'aient rien à changer. Seule la porte d'entrée diffère : ici, des PDF téléchargés à la main sur
// eSCRIBE (voir lib/fre.js), en anglais et en français.
//
// RÈGLE DU PROJET : jamais de donnée inventée. Les procès-verbaux ne disent pas qui a voté pour ou
// contre : pour/contre restent vides, decomptePour/decompteContre à null, voteEnregistre à false.
// Les absences viennent de la liste « Members of Council Present ». Le nom de qui propose et de qui
// appuie est gardé (proposePar, appuyePar). data/elus.json n'est pas réécrit : il vient de
// fredericton.ca ; on n'y met à jour que le compte des absences.
//
// LE JUMELAGE FR/EN. La version française a les mêmes résolutions dans le même ordre (vérifié le
// 19 nov. 2026 : même nombre de « Moved by » et de « Proposé par » sur les six séances). Si les
// nombres diffèrent, la séance garde l'anglais seul et un avertissement est affiché.

import { readFile, writeFile, rename, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { JEU, PAGE_JEU, LICENCE, ATTRIBUTION, INSTANCES, cleInstance, lienDocument } from '../lib/fre.js';
import { classer, THEMES } from '../lib/themes.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const DOSSIER = 'pv-a-la-main';
const DEBUT_CONSEIL = '2026-06-01';   // assermentation du conseil élu le 11 mai 2026

async function lireJsonLocal(chemin) {
  try { return JSON.parse(await readFile(chemin, 'utf8')); } catch { return null; }
}
async function ecrire(chemin, objet, compact = false) {
  await mkdir('data', { recursive: true });
  const tmp = `${chemin}.tmp`;
  await writeFile(tmp, compact ? JSON.stringify(objet) : JSON.stringify(objet, null, 1), 'utf8');
  await rename(tmp, chemin);
}

async function texteDuPdf(chemin) {
  const { text } = await pdf(await readFile(chemin));
  return text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => !/^\d{1,2}$/.test(l));   // les lignes vides restent : elles séparent les titres
}

const nettoyer = (t) => t.replace(/\s+/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim();
const estTitreMajuscules = (l) => l.length > 3 && l === l.toUpperCase() && /[A-ZÉ]{3}/.test(l);
const enCasse = (l) => l.toLowerCase().replace(/(^|[\s(–-])\p{L}/gu, (m) => m.toUpperCase());

// Les résolutions d'un procès-verbal. Une résolution commence à « Moved by: » (« Proposé par : ») et
// finit au résultat (CARRIED / DEFEATED, ADOPTÉ / REJETÉ). Son titre est la dernière ligne au-dessus
// qui n'est pas un intitulé de section ; à défaut, l'intitulé de section lui-même.
function resolutions(lignes, langue) {
  const P = langue === 'fr'
    ? { propose: /^Propos[ée]e? par\s*:\s*(.*)$/i, appuye: /^Appuy[ée]e? par\s*:\s*(.*)$/i, resultat: /^(?:.*\bdéclarée\s+)?(ADOPTÉE?|REJETÉE?)(?!\p{L})/u }
    : { propose: /^Moved by\s*:?\s*(.*)$/i, appuye: /^Seconded by\s*:?\s*(.*)$/i, resultat: /^(?:.*\bvoted on and\s+)?(CARRIED|DEFEATED|LOST)\b/ };
  const sortie = [];
  // Un vote divisé (« CARRIED ON DIVISION (Councillors X and Y voted 'nay') ») : le procès-verbal nomme
  // alors ceux qui ont voté contre, sur la ligne qui suit le résultat. On les garde (contre).
  let derniere = null, parenthese = '';
  // Le titre d'une résolution : le dernier paragraphe court au-dessus d'elle (un titre peut tenir sur
  // deux lignes), en sautant les étapes à puces, les phrases du procès-verbal et les considérants.
  // Il reste valable pour les résolutions suivantes (2e lecture, 3e lecture…) jusqu'au prochain titre.
  // Un titre hérité ne vaut que pour la suite d'un même arrêté ; ailleurs, la fiche prend le début
  // de sa propre résolution (sinon un emprunt de 9 M$ s'intitulerait « Update on Aquatics »).
  let section = null, titre = null, courante = null, bloc = [], neuf = false;
  const estCandidat = (l) => !/^[\uf0b7•·]/.test(l) && !/^\d+$/.test(l) && !/^(BE IT|WHEREAS|IL EST|ATTENDU|QU’IL|QUE )/.test(l) && !/[.:]$/.test(l) && l.length < 160 && !/^_+$/.test(l);
  for (const l of lignes) {
    // La parenthèse se ferme à « ) », ou à la ligne qui dit « nay » / « voté contre » (la Ville oublie parfois la
    // parenthèse fermante, 19 mai 2026) ; jamais par-dessus une nouvelle résolution.
    if (derniere && (parenthese || /^\(/.test(l)) && !P.propose.test(l)) {
      parenthese += ` ${l}`;
      if (/\)|nay|voté contre/i.test(l) || parenthese.length > 400) {
        if (/nay|voté contre/i.test(parenthese)) {
          derniere.contre = parenthese.replace(/[()]/g, ' ')
            .replace(/voted\s*['‘’"“”]?nay['‘’"“”]?|voting\s*['‘’"“”]?nay['‘’"“”]?|ayant voté contre/gi, ' ')
            .replace(/\b(Deputy Mayor|Mayor|Councillors?|La mairesse adjointe|la mairesse|le maire|les conseillers|la conseillère|le conseiller|conseillères?)\b/gi, ',')
            .split(/,|\band\b|\bet\b/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => /^[A-ZÀ-Ý][\p{L}'’.-]+(\s+[A-ZÀ-Ý][\p{L}'’.-]+)+$/u.test(x));
        }
        derniere = null; parenthese = '';
      }
      continue;
    }
    if (l) derniere = null;
    const mp = l.match(P.propose);
    if (mp) {
      if (courante) sortie.push(courante);
      if (bloc.length) { titre = nettoyer(bloc.join(' ')); bloc = []; neuf = true; }
      courante = { titre: titre ?? (section ? enCasse(section) : null), herite: !neuf && !!titre, section, propose: nettoyer(mp[1]), appuye: null, texte: [], resultat: null };
      neuf = false;
      continue;
    }
    if (courante) {
      if (!l) continue;
      const ma = l.match(P.appuye);
      if (ma && !courante.appuye) { courante.appuye = nettoyer(ma[1]); continue; }
      const mr = l.match(P.resultat);
      if (mr) {
        courante.resultat = mr[1];
        courante.division = /ON DIVISION|SANS UNANIMITÉ/i.test(l);
        sortie.push(courante); derniere = courante; courante = null; continue;
      }
      courante.texte.push(l);
      continue;
    }
    const orpheline = !courante && l.match(P.resultat);
    if (orpheline) {
      const enAttente = [...sortie].reverse().find((r) => !r.resultat);
      if (enAttente) { enAttente.resultat = orpheline[1]; enAttente.division = /ON DIVISION|SANS UNANIMITÉ/i.test(l); derniere = enAttente; continue; }
    }
    if (!l) { if (bloc.length) { titre = nettoyer(bloc.join(' ')); bloc = []; neuf = true; } continue; }
    if (estTitreMajuscules(l)) { section = nettoyer(l); titre = null; bloc = []; neuf = false; }
    else if (estCandidat(l)) bloc.push(l);
    else bloc = [];
  }
  if (courante) sortie.push(courante);
  return sortie.map((r) => {
    const texte = nettoyer(r.texte.join(' '));
    const suiteArrete = /By-law|Arrêté/i.test(r.titre ?? '') && /By-law|arrêté/i.test(texte);
    const faible = /^(Resolution|Résolution) #?s*d+$/i.test(r.titre ?? "");   // « Resolution #1 » ne dit rien
    return { ...r, titre: (r.herite && !suiteArrete) || faible ? debutResolution(texte) ?? r.titre : r.titre, texte };
  });
}

// « BE IT RESOLVED THAT the Council of the City of Fredericton hereby approves … » → « Approves … ».
// ---------- Ce que le procès-verbal rapporte sans le voter (N.-B., 19 nov. 2026) ----------
// Les rapports de comités (le résumé qu'en fait le président au conseil), les déclarations de conflit
// d'intérêts, les présentations, les « autres questions » et le déroulement d'une séance
// extraordinaire (assermentation). Ce ne sont pas des décisions : les fiches sont marquées
// « information », sans résultat. Les résolutions, elles, restent lues par resolutions().
const SECTIONS_INFO = [
  [/^COMMITTEE REPORTS?$|^RAPPORTS? DE(S)? COMITÉS?$/, 'comite'],
  [/^CONFLICT OF INTEREST|^DÉCLARATIONS? DE CONFLIT/, 'conflit'],
  [/^PRESENTATIONS?|^PRÉSENTATIONS?$/, 'presentation'],
  [/^OTHER MATTERS?$|^AUTRES? QUESTIONS?$|^AUTRES POINTS$/, 'autre'],
  [/^(PURPOSE OF THE SPECIAL MEETING|ELECTION DECLARATION|OATHS OF OFFICE|PASSING OF |OBJET DE LA SÉANCE|DÉCLARATION D.ÉLECTION|SERMENTS?|PRESTATION)/, 'ceremonie'],
];
function informations(lignes, langue) {
  const propose = langue === 'fr' ? /^Propos[ée]e? par\s*:/i : /^Moved by\s*:/i;
  const resultat = langue === 'fr' ? /^(ADOPTÉE?|REJETÉE?)(?!\p{L})/u : /^(CARRIED|DEFEATED|LOST)\b/;
  const sortie = [];
  let cle = null, section = null, enMotion = false, courant = null, para = [];
  const fermerPara = () => {
    if (!para.length || !cle) { para = []; return; }
    const t = nettoyer(para.join(' ').replace(/\s*[•]\s*/g, ' • '));
    para = [];
    const court = t.length < 150 && !/[.:;]$/.test(t) && !/^[a-zà-ÿ•]/.test(t);
    if (court && cle !== 'conflit' && cle !== 'ceremonie') { if (courant) sortie.push(courant); courant = { cle, section, titre: t, texte: [] }; return; }
    if (!courant) courant = { cle, section, titre: enCasse(section), texte: [] };
    courant.texte.push(t);
  };
  const fermer = () => { fermerPara(); if (courant) sortie.push(courant); courant = null; };
  for (const l of lignes) {
    if (propose.test(l)) { fermer(); enMotion = true; continue; }
    if (enMotion) { if (resultat.test(l)) enMotion = false; continue; }
    if (estTitreMajuscules(l) && !/^(MINUTES OF|PROCÈS-VERBAL|REGULAR MEETING|SPECIAL MEETING|SÉANCE )/.test(l)) {
      fermer();
      const s = SECTIONS_INFO.find(([re]) => re.test(l));
      // « O CANADA », « GIFT PRESENTED… » : une sous-section d'une cérémonie reste dans la cérémonie.
      if (s) { cle = s[1]; section = nettoyer(l); }
      else if (cle !== 'ceremonie' || /^(MEETING CALLED TO ORDER|COUNCILLORS|ADJOURNMENT|LEVÉE|OUVERTURE)/.test(l)) { cle = null; section = null; }
      else { para.push(`${enCasse(l)} —`); }
      continue;
    }
    if (!l) { fermerPara(); continue; }
    if (cle) para.push(l);
  }
  fermer();
  return sortie
    .map((x) => ({ ...x, texte: x.texte.join('\n') }))
    .filter((x) => x.texte && !/^(There (were|was) no conflicts?|Aucun conflit)/i.test(x.texte) && !/^Agenda items included:?$/i.test(x.texte));
}

function debutResolution(texte) {
  // Le PDF coupe parfois les mots (« R ESOLVED », « Frede ricton ») : les motifs tolèrent une espace.
  const VILLE = String.raw`Fre\s?de\s?ri\s?c\s?ton`;
  let t = texte.replace(/^.*?(BE IT R\s?E\s?SOLVED\s+(THAT\s+)?|IL EST R\s?ÉSOLU QUE\s+)/i, '')
    .replace(new RegExp(String.raw`^(,\s*)?(par la présente,?\s*)?(the (Council|Municipality) (of|for) the City of ${VILLE}|le conseil municipal de ${VILLE})\s*(hereby\s*)?(,?\s*par la présente,?\s*)?`, 'i'), '').trim();
  if (!t) return null;
  if (t.length > 110) t = t.slice(0, 110).replace(/\s+\S*$/, '') + '…';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function entete(lignes) {
  const tete = lignes.slice(0, 60).join(' ');
  const type = /SPECIAL MEETING/i.test(tete) ? 'Special City Council Meeting' : 'Regular City Council Meeting';
  const h = tete.match(/(\d{1,2}):(\d{2})\s*([ap])\.?m/i);
  let heure = null;
  if (h) { let hh = Number(h[1]) % 12; if (h[3].toLowerCase() === 'p') hh += 12; heure = `${String(hh).padStart(2, '0')}h${h[2]}`; }
  // Les présents : entre « Members of Council » et « Staff ».
  const i = lignes.findIndex((l) => /Members of Council/i.test(l));
  const presents = [];
  for (let k = i + 1; i >= 0 && k < lignes.length && !/^Staff/i.test(lignes[k]); k++) {
    const m = lignes[k].match(/^(?:Mayor|Deputy Mayor|Councillor)\s+(.+)$/);
    if (m) presents.push(nettoyer(m[1]));
  }
  return { type, heure, presents };
}

// « Councillor Kelly Murray » → « Kelly Murray » ; FR : « Kelly Murray, conseillère municipale ».
const nomSeul = (s) => (s ?? '').replace(/^(Mayor|Deputy Mayor|Councillor)\s+/, '').replace(/,.*$/, '').trim() || null;

// ---------- Les ordres du jour des séances sans procès-verbal (N.-B., 19 nov. 2026) ----------
// La Ville met ses procès-verbaux en ligne avec environ trois mois de retard (adoptés à une séance
// suivante, puis publiés). Pour les séances d'après, il n'y a que l'ordre du jour : ce qui était
// PRÉSENTÉ au conseil, pas ce qu'il a décidé. Chaque point devient une fiche marquée ordreDuJour,
// sans résultat. Dès qu'un procès-verbal arrive pour la même date, l'ordre du jour est ignoré.
// Les PDF « Agenda (PDF) » d'eSCRIBE sont téléchargés à la main dans odj-a-la-main/ ; leurs premières
// pages donnent l'ordre du jour en anglais, puis en français, avec les mêmes numéros (5.1, 7.3…).
const DOSSIER_ODJ = 'odj-a-la-main';
// Les lignes d'un PDF reconstruites par position : sans ça, « 5.2 » et « 447-449 Northumberland » se collent.
async function lignesPositionnees(chemin, max) {
  const pages = [];
  await pdf(await readFile(chemin), {
    max,
    pagerender: async (page) => {
      const c = await page.getTextContent({ normalizeWhitespace: true });
      const lignes = [];
      for (const it of c.items) {
        const y = Math.round(it.transform[5]);
        let l = lignes.find((x) => Math.abs(x.y - y) <= 2);
        if (!l) lignes.push((l = { y, m: [] }));
        l.m.push({ x: it.transform[4], t: it.str, w: it.width });
      }
      lignes.sort((a, b) => b.y - a.y);
      pages.push(...lignes.map((l) => {
        l.m.sort((a, b) => a.x - b.x);
        let t = '', fin = null;
        for (const m of l.m) { if (fin != null && m.x - fin > 1.5 && !/\s$/.test(t) && !/^\s/.test(m.t)) t += ' '; t += m.t; fin = m.x + m.w; }
        return t.replace(/\s+/g, ' ').trim();
      }));
      return '';
    },
  });
  return pages;
}
function pointsOrdreDuJour(lignes) {
  const points = new Map();
  let courant = null, section = null;
  for (const brut of lignes) {
    const l = brut.replace(/\s+/g, ' ').trim();
    if (!l) continue;
    const s = l.match(/^(\d+)\.\s+(\D.*)$/);
    if (s) { section = s[2]; courant = null; continue; }
    const m = l.match(/^(\d+\.\d+)\s+(.+)$/);
    if (m) { courant = { num: m[1], titre: m[2], etapes: [], section, fini: false }; points.set(m[1], courant); continue; }
    if (!courant) continue;
    if (/^(Recommendation|Recommandation)/i.test(l)) { courant.fini = true; continue; }
    if (/^•|•$/.test(l)) { const e = l.replace(/^•\s*|\s*•$/g, ''); if (e && !/^Recommand?ation/i.test(e)) courant.etapes.push(e); courant.fini = true; continue; }
    if (l === l.toUpperCase() && /[A-ZÉ]{4}/.test(l)) { section = l; courant = null; continue; }   // « MOBILITY COMMITTEE REPORT »
    if (!courant.fini && !courant.etapes.length && courant.titre.length < 220 && !/^(By-law|Arrêté)\s+(No\.?|n[oº°]?\.?)?\s*[A-Z]{1,2}-\d/i.test(l)) courant.titre += ` ${l}`;
    else if (!courant.etapes.length) courant.fini = true;
  }
  // « … Fredericton Inc. o o » : le « o » en exposant de « nº », décroché par le PDF.
  for (const p of points.values()) p.titre = nettoyer(p.titre.replace(/<br>/g, ' ').replace(/\(\s+/g, '(').replace(/(\s+o)+\s*$/, ''));
  return points;
}
async function ajouterOrdresDuJour(seances, decisions, precedent, idsPrecedents) {
  let fichiers = [];
  try { fichiers = (await readdir(DOSSIER_ODJ)).filter((f) => /^fredericton-odj-\d{4}-\d{2}-\d{2}-\d+\.pdf$/.test(f)).sort(); } catch { return; }
  const datesPv = new Set(seances.map((s) => s.date));
  for (const f of fichiers) {
    const [, date, docId] = f.match(/(\d{4}-\d{2}-\d{2})-(\d+)\.pdf$/);
    if (datesPv.has(date)) { console.log(`  ${date} : procès-verbal lu, ordre du jour ignoré.`); continue; }
    // Les premières pages seulement : le reste du PDF, ce sont les rapports (des milliers de pages).
    const lignes = await lignesPositionnees(`${DOSSIER_ODJ}/${f}`, 12);
    const iFr = lignes.findIndex((l) => /^\s*ORDRE DU JOUR\s*$/.test(l));
    const iFin = lignes.findIndex((l, i) => i > iFr && /NOTICE OF CLOSED|AVIS DE SÉANCE/i.test(l));
    const en = pointsOrdreDuJour(lignes.slice(0, iFr > 0 ? iFr : undefined));
    const fr = iFr > 0 ? pointsOrdreDuJour(lignes.slice(iFr, iFin > 0 ? iFin : undefined)) : new Map();
    const tete = lignes.slice(0, 8).join(' ');
    const type = /SPECIAL MEETING/i.test(tete) ? 'Special City Council Meeting' : 'Regular City Council Meeting';
    const h = tete.match(/(\d{1,2}):(\d{2})\s*([ap])\.?m/i);
    let heure = null;
    if (h) { let hh = Number(h[1]) % 12; if (h[3].toLowerCase() === 'p') hh += 12; heure = `${String(hh).padStart(2, '0')}h${h[2]}`; }
    const instance = cleInstance(type);
    const seance = {
      id: `${instance}_${date}_${docId}`, instance, nom: type, explication: INSTANCES[type]?.explication ?? null,
      date, heure, titre: `${type} — ${date}`, lien: lienDocument(docId), lienFr: null,
      source: JEU, meetingId: Number(docId), nombrePoints: en.size, nombreDivises: 0, nombreRejetes: 0,
      presents: [], absents: [], ordreDuJour: true,
    };
    seances.push(seance);
    for (const p of en.values()) {
      const pf = fr.get(p.num);
      const id = `O${date}-${p.num}`;
      const { theme, themeSource } = classer({ objet: `${p.titre} ${p.etapes.join(' ')}` });
      decisions.push({
        id, numero: `${date}-ODJ-${p.num.padStart(4, "0")}`, objet: p.titre, objetFr: pf?.titre ?? null, article: p.num,
        date, annee: date.slice(0, 4), instance: type, seanceId: seance.id, dossier: p.titre,
        resultat: null, pdf: seance.lien, pdfFr: null, lienSource: seance.lien,
        decomptePour: null, decompteContre: null, theme, themeSource,
        texte: p.etapes.length ? p.etapes.join('\n') : null, texteFr: pf?.etapes.length ? pf.etapes.join('\n') : null,
        proposePar: null, appuyePar: null, section: p.section, sectionFr: pf?.section ?? null,
        type: 'Agenda item', unite: null, sommaireId: null, sommairePdf: null,
        dissidences: [], abstentions: [], absents: [], conflits: [],
        voteEnregistre: false, ordreDuJour: true, nouveau: precedent ? !idsPrecedents.has(id) : false,
      });
    }
    console.log(`  ${date} ${type} : ordre du jour seulement, ${en.size} point(s)${fr.size === en.size ? ' (FR jumelé)' : ` (FR : ${fr.size})`}.`);
  }
}

async function main() {
  const tous = await readdir(DOSSIER);
  const fichiers = tous.filter((f) => /^fredericton-pv-\d{4}-\d{2}-\d{2}-\d+\.pdf$/.test(f)).sort();
  if (!fichiers.length) { console.error(`Aucun PDF dans ${DOSSIER}/.`); process.exit(1); }
  const tousFr = tous.filter((f) => /-fr\.pdf$/.test(f));

  const elus = await lireJsonLocal('data/elus.json');
  const nomsMembres = (elus?.membres ?? []).map((m) => m.nomComplet);

  const seances = [];
  const votes = [];
  const decisions = [];
  const precedent = await lireJsonLocal('data/decisions.json');
  const idsPrecedents = new Set((precedent?.decisions ?? []).map((d) => d.id));
  const absencesParMembre = new Map();
  const contreParMembre = new Map();

  for (const f of fichiers) {
    const [, date, docId] = f.match(/(\d{4}-\d{2}-\d{2})-(\d+)\.pdf$/);
    const lignes = await texteDuPdf(`${DOSSIER}/${f}`);
    const { type, heure, presents } = entete(lignes);
    const en = resolutions(lignes, 'en');
    const ficFr = tousFr.find((x) => x.startsWith(`fredericton-pv-${date}-`));
    let fr = [];
    const lignesFr = ficFr ? await texteDuPdf(`${DOSSIER}/${ficFr}`) : [];
    if (ficFr) {
      fr = resolutions(lignesFr, 'fr');
      if (fr.length !== en.length) { console.warn(`⚠ ${date} : ${en.length} résolutions en anglais, ${fr.length} en français — français ignoré.`); fr = []; }
    }
    // N.-B. : ce que le procès-verbal rapporte sans le voter (rapports de comités, conflits, questions…).
    const infos = informations(lignes, 'en');
    const infosFr = lignesFr.length ? informations(lignesFr, 'fr') : [];
    if (!en.length && !infos.length) { console.log(`  ${date} ${type} : rien à retenir, ignorée.`); continue; }

    // Les absences ne valent que pour le conseil actuel (data/elus.json), assermenté le 1er juin 2026 :
    // avant, c'était un autre conseil, et le comparer aux membres d'aujourd'hui serait faux.
    const absents = presents.length && date >= DEBUT_CONSEIL ? nomsMembres.filter((n) => !presents.includes(n)) : [];
    for (const n of absents) absencesParMembre.set(n, (absencesParMembre.get(n) ?? 0) + 1);   // une absence = une séance
    const instance = cleInstance(type);
    const seance = {
      id: `${instance}_${date}_${docId}`,
      instance, nom: type, explication: INSTANCES[type]?.explication ?? null,
      date, heure, titre: `${type} — ${date}`,
      lien: lienDocument(docId),
      lienFr: ficFr ? lienDocument(ficFr.match(/-(\d+)-fr\.pdf$/)[1]) : null,
      source: JEU, meetingId: Number(docId),
      nombrePoints: en.length, nombreDivises: en.filter((r) => r.division || r.contre?.length).length,
      nombreRejetes: en.filter((r) => /DEFEATED|LOST/.test(r.resultat ?? '')).length,
      presents, absents,
    };
    seances.push(seance);

    en.forEach((r, i) => {
      const rf = fr[i];
      const numero = `${date}-${String(i + 1).padStart(2, '0')}`;
      const id = `F${numero}`;
      const objet = r.titre ?? r.texte.slice(0, 120);
      const { theme, themeSource } = classer({ objet: `${objet} ${r.texte.slice(0, 300)}` });
      const resultat = /^(CARRIED|ADOPT)/.test(r.resultat ?? '') ? (r.division ? 'Carried on division' : 'Carried') : r.resultat ? 'Defeated' : null;
      const contre = r.contre ?? [];   // nommés seulement quand le vote est divisé
      for (const n of contre) contreParMembre.set(n, (contreParMembre.get(n) ?? 0) + 1);
      const commun = {
        id, numero, objet, objetFr: rf?.titre ?? null, article: String(i + 1), date, annee: date.slice(0, 4),
        instance: type, seanceId: seance.id, dossier: objet,
        resultat, pdf: seance.lien, pdfFr: seance.lienFr, lienSource: seance.lien,
        decomptePour: null, decompteContre: null,
        theme, themeSource,
        texte: r.texte, texteFr: rf?.texte ?? null,
        proposePar: nomSeul(r.propose), appuyePar: nomSeul(r.appuye),
      };
      votes.push({
        ...commun,
        pour: [], contre, abstentions: [], absents, conflits: [], inadmissibles: [], sansVote: [],
        abstention: null, demandeParVote: null,
        avertissements: resultat ? [] : ['Résultat absent du procès-verbal.'],
        brut: null, nouveau: precedent ? !idsPrecedents.has(id) : null,
      });
      decisions.push({
        ...commun, type: 'Motion', unite: null, sommaireId: null, sommairePdf: null,
        dissidences: contre, abstentions: [], absents, conflits: [],
        voteEnregistre: false, nouveau: precedent ? !idsPrecedents.has(id) : false,
      });
    });
    // Les informations, jumelées au français section par section quand les deux comptes concordent.
    const parSection = (liste) => liste.reduce((m, x) => m.set(x.cle, [...(m.get(x.cle) ?? []), x]), new Map());
    const frParSection = parSection(infosFr);
    const rangDans = new Map();
    infos.forEach((x, i) => {
      const k = rangDans.get(x.cle) ?? 0; rangDans.set(x.cle, k + 1);
      const enSec = infos.filter((y) => y.cle === x.cle), frSec = frParSection.get(x.cle) ?? [];
      const xf = frSec.length === enSec.length ? frSec[k] : null;
      const numero = `${date}-INF-${String(i + 1).padStart(2, '0')}`;
      const id = `I${date}-${i + 1}`;
      const { theme, themeSource } = classer({ objet: `${x.titre} ${x.texte.slice(0, 300)}` });
      decisions.push({
        id, numero, objet: x.titre, objetFr: xf?.titre ?? null, article: null, date, annee: date.slice(0, 4),
        instance: type, seanceId: seance.id, dossier: x.titre,
        resultat: null, pdf: seance.lien, pdfFr: seance.lienFr, lienSource: seance.lien,
        decomptePour: null, decompteContre: null, theme: x.cle === 'conflit' ? 'procedure' : theme, themeSource,
        texte: x.texte, texteFr: xf?.texte ?? null, proposePar: null, appuyePar: null,
        section: x.section, sectionFr: xf?.section ?? null, sorteInfo: x.cle,
        type: 'Information', unite: null, sommaireId: null, sommairePdf: null,
        dissidences: [], abstentions: [], absents: [], conflits: [],
        voteEnregistre: false, information: true, nouveau: precedent ? !idsPrecedents.has(id) : false,
      });
    });
    seance.nombreInformations = infos.length;
    console.log(`  ${date} ${type} : ${en.length} résolution(s)${fr.length ? ' (FR jumelé)' : ''}, ${infos.length} information(s), ${absents.length} absent(s).`);
  }
  await ajouterOrdresDuJour(seances, decisions, precedent, idsPrecedents);
  seances.sort((a, b) => a.date.localeCompare(b.date));
  votes.sort((a, b) => b.numero.localeCompare(a.numero));
  decisions.sort((a, b) => b.numero.localeCompare(a.numero));

  const facette = (cle) => {
    const c = new Map();
    for (const d of decisions) c.set(d[cle], (c.get(d[cle]) ?? 0) + 1);
    return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([valeur, n]) => ({ valeur, n }));
  };
  const generatedAt = new Date().toISOString();
  // N.-B. : la période des décisions s'arrête au dernier procès-verbal ; les ordres du jour vont plus loin.
  const avecPv = seances.filter((s) => !s.ordreDuJour);
  const depuis = avecPv[0]?.date ?? null, jusqua = avecPv.at(-1)?.date ?? null, ordresDuJourJusqua = seances.at(-1)?.date ?? null;
  const racine = {
    generatedAt, source: PAGE_JEU, jeu: JEU,
    licence: `${LICENCE.nom} — ${LICENCE.url}`, attribution: ATTRIBUTION,
    jeuMisAJourLe: generatedAt, parametres: { annee: (depuis ?? '').slice(0, 4), depuis, jusqua, ordresDuJourJusqua },
  };
  const nouveaux = precedent ? decisions.filter((d) => d.nouveau).length : null;
  const instances = Object.fromEntries(Object.entries(INSTANCES).map(([n, i]) => [n, i.explication]));

  await ecrire('data/seances.json', {
    ...racine, nombre: seances.length,
    parInstance: Object.fromEntries(seances.reduce((m, s) => m.set(s.nom, (m.get(s.nom) ?? 0) + 1), new Map())),
    instances, seances,
  });
  await ecrire('data/votes.json', {
    ...racine,
    methode: 'Chaque résolution est lue dans le procès-verbal de la séance (PDF eSCRIBE de la Ville). Les procès-verbaux de Fredericton ne notent pas de vote nominal : on ne sait que le résultat, qui a proposé et qui a appuyé. Les absents sont les membres qui ne figurent pas dans la liste des présents.',
    versionLecture: 1, totalDisponible: votes.length, documentsAnalyses: seances.length,
    nombre: votes.length, nouveauxDepuisDerniereExecution: nouveaux, avecAvertissement: votes.filter((v) => v.avertissements.length).length,
    themes: THEMES, votes,
  });
  await ecrire('data/decisions.json', {
    ...racine, partiel: true, totalDisponible: decisions.length, nombre: decisions.filter((d) => !d.ordreDuJour && !d.information).length, nombreOrdreDuJour: decisions.filter((d) => d.ordreDuJour).length, nombreInformations: decisions.filter((d) => d.information).length,   // N.-B. : les résolutions seules, les points d’ordre du jour à part
    nouveauxDepuisDerniereExecution: nouveaux, seancesLues: seances.length, seancesEnAttente: 0,
    themes: THEMES, sansTheme: decisions.filter((d) => d.themeSource === 'defaut').length,
    instances, facettes: { type: facette('type'), instance: facette('instance'), theme: facette('theme') },
    seances: seances.map((s) => ({ id: s.id, instance: s.nom, date: s.date, nombrePoints: s.nombrePoints })),
    decisions,
  });
  if (elus) {
    for (const m of elus.membres) {
      const a = absencesParMembre.get(m.nomComplet) ?? 0;
      m.votes = { pour: 0, contre: contreParMembre.get(m.nomComplet) ?? 0, abstentions: 0, absents: a, conflits: 0, inadmissibles: 0, sansVote: 0, total: seances.filter((x) => x.date >= DEBUT_CONSEIL).length };   // total = séances du conseil actuel
    }
    elus.parametres = { ...racine.parametres, depuis: DEBUT_CONSEIL };   // absences : conseil actuel seulement
    await ecrire('data/elus.json', elus);
  }
  const noms = [];
  const rang = (n) => { let i = noms.indexOf(n); if (i < 0) { noms.push(n); i = noms.length - 1; } return i; };
  const v = {};
  // N.-B. : la boîte « vote nominatif » ne s'ouvre que pour un vrai vote nominal ; Fredericton n'en note pas.
  for (const x of votes) if (x.pour.length || x.contre.length) v[x.numero] = [x.resultat ?? '', x.pour.map(rang), x.contre.map(rang), '', x.lienSource, [], x.absents.map(rang), []];
  await ecrire('data/votes-decisions.json', { noms, v }, true);
  await ecrire('data/robots.json', {
    luLe: generatedAt, url: null, texte: null, interditApi: null,
    porteUtilisee: 'PDF téléchargés à la main (eSCRIBE derrière Cloudflare)',
    note: 'Aucune requête automatique à la Ville : les procès-verbaux sont téléchargés à la main dans pv-a-la-main/.',
  });

  console.log(`\n${seances.length} séance(s), ${votes.length} résolution(s). Sujets : ${facette('theme').map((t) => `${t.valeur} ${t.n}`).join(' · ')}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
