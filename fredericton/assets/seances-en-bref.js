// « In brief » : the latest meeting of each Council body, at the top of the Decisions page — the
// same big box as Montréal (commun/seances-en-bref.js, 13 Nov. 2026), rebuilt for Fredericton.
// One difference, deliberate: Montréal's sentence is AI-written from the minutes. The City of
// Fredericton publishes no text of its decisions, so the sentence here is COMPUTED from the vote
// record (how many motions, carried, lost, split) — never written, never guessed. Everything in the
// card is a City value: agenda line, result, tallies, names.
// Reads data/seances.json, decisions.json and votes.json (written by scrapers/votes.js).
// English by default, French when chosen (assets/langue.js, 15 Nov. 2026).
import { EN, tr } from './langue.js';
import { themeFr, libelleFr, INSTANCES_FR } from './libelles-en.js';
const PAGE = 'decisions-of-fredericton-city-council';
const echapper = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MOIS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function dateLongue(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  return EN ? `${MOIS[m - 1]} ${j}, ${a}` : `${j === 1 ? '1er' : j} ${MOIS_FR[m - 1]} ${a}`;
}
// Cut long lines, but keep the City's suffix (« - Amendment », « - Motion as Approved ») that tells two
// votes on the same item apart.
function couper(t, n) {
  if (t.length <= n) return t;
  const m = t.match(/ - ([^-]{3,30})$/);
  const suffixe = m ? ` - ${m[1]}` : '';
  const tete = t.slice(0, t.length - suffixe.length);
  return tete.slice(0, Math.max(20, n - suffixe.length)).replace(/[\s,;:–-]+\S*$/, '') + '…' + suffixe;
}
// « CD-1 REZONING: 2345 MAIN STREET » shouts: lower-case what is all capitals.
function adoucir(t) {
  t = String(t ?? '').replace(/\s+/g, ' ').trim();
  const lettres = t.replace(/[^A-Za-z]/g, '');
  if (lettres && lettres === lettres.toUpperCase()) t = t.charAt(0) + t.slice(1).toLowerCase();
  return t;
}
const THEMES = { urbanisme: 'Zoning and development', transport: 'Transportation', immobilier: 'City property', subventions: 'Grants', contrats: 'Contracts', finances: 'Budget and taxes', rh: 'Appointments and staff', environnement: 'Environment and climate', culture: 'Arts, culture and heritage', loisirs: 'Parks and recreation', securite: 'Public safety', economie: 'Business and economy', travaux: 'Streets and infrastructure', honneurs: 'Motions and proclamations', social: 'Housing and social', procedure: 'Procedure', administration: 'Administration' };
// How often each body sits, glued to the name like Montréal's « /mois ».
function rythme(nom) {
  if (/^Council$/.test(nom)) return tr('2 semaines', '2 weeks');
  if (/Public Hearing/.test(nom)) return tr('au besoin', 'as needed');
  if (/Finance|Policy/.test(nom)) return tr('mois', 'month');
  return tr('sur convocation', 'as called');
}
const pluriel = (n, un, des) => `${n} ${n === 1 ? un : des}`;
const nomTheme = (cle) => (EN ? THEMES[cle] : themeFr(cle)) ?? cle;

// THE RECAP (Martin, 15 Nov. 2026: « in brief is the brief of the last session so people don't have
// to read everything… now it just announces motions »). What the meeting DECIDED, item by item, built
// only from City values: the agenda line of each item and the result of its final vote. Nothing is
// summarized or guessed — the names in quotes are the City's own wording, kept in English.
//
// One agenda item is often voted several times (amendments, a withdrawal motion, then the motion as
// approved). The item's outcome is its final vote: the one the City labels "Motion as Approved",
// "Original Motion" or "final motion", else the plain line, else the last vote number.
const ETAPE = / - (Motion as Approved.*|Original Motion|final motion.*|[^-]*\bamendment\b[^-]*|Withdrawal Motion.*|Referral Motion|Referred|Reconsidered later|Lost|Waive Staff Presentation|Extension of Meeting.*)$/i;
const FINALE = /^(Motion as Approved|Original Motion|final motion)/i;
function base(objet) {
  return adoucir(objet)
    .replace(/^(?:NEW BUSINESS|UNFINISHED BUSINESS)\s*-\s*/i, '')
    .replace(/^(?:Item|Motion|Report|UB|Presentation)\s*\d+\s*[.\-]\s*/i, '')
    .replace(ETAPE, '')
    .trim();
}
const numeroVote = (d) => Number(String(d.numero).replace(/\D/g, '')) || 0;
function points(decs) {
  const parBase = new Map();
  for (const d of decs) {
    const b = base(!EN && d.objetFr ? d.objetFr : d.objet);   // N.-B. : titre français
    if (!b || d.theme === 'procedure' || /extend past|waive staff/i.test(d.objet)) continue;
    (parBase.get(b) ?? parBase.set(b, []).get(b)).push(d);
  }
  return [...parBase].map(([titre, votes]) => {
    const etape = (d) => (d.objet.match(ETAPE)?.[1] ?? '');
    const finale = votes.find((d) => FINALE.test(etape(d))) ?? votes.find((d) => !etape(d) || /^Referred$/i.test(etape(d))) ?? [...votes].sort((a, b) => numeroVote(b) - numeroVote(a))[0];
    const issue = /^Referred$/i.test(etape(finale)) ? 'renvoi' : /carried/i.test(finale.resultat) ? 'adopte' : 'rejete';
    return { titre, issue, d: finale };
  });
}
const cite = (t, n = 60) => (EN ? `“${couper(t, n)}”` : `« ${couper(t, n)} »`);
function liste(elements, n = 3) {
  const vus = elements.slice(0, n), reste = elements.length - vus.length;
  const et = EN ? ' and ' : ' et ';
  if (reste > 0) return `${vus.join(', ')}${et}${EN ? `${reste} more` : `${reste} autre${reste > 1 ? 's' : ''}`}`;
  return vus.length > 1 ? `${vus.slice(0, -1).join(', ')}${et}${vus[vus.length - 1]}` : vus[0] ?? '';
}
function souligner(texte) {
  return echapper(texte).replace(/([^]*)([^]*)/g, (_, t, m) =>
    `<span class="eb-mot${t ? ` t-bord-${t}` : ''}"${t ? ` title="${echapper(nomTheme(t))}"` : ''}>${m}</span>`);
}
function recap(s, decs) {
  const P = points(decs);
  const adoptes = P.filter((p) => p.issue === 'adopte');
  const zonage = adoptes.filter((p) => /rezoning|ODP Amendment|Text Amendment/i.test(p.titre) && !/miscellaneous/i.test(p.titre));
  const contrats = adoptes.filter((p) => /^Contract Award\s*(?:-|for)\s*/i.test(p.titre));
  const autres = adoptes.filter((p) => !zonage.includes(p) && !contrats.includes(p));
  const rejetes = P.filter((p) => p.issue === 'rejete');
  const renvoyes = P.filter((p) => p.issue === 'renvoi');
  // Sujets soulignés de la couleur de leur thème, comme Montréal (Martin, 16 nov. 2026) : marqués ici, rendus par souligner().
  const sj = (p, t) => `${p.d.theme ?? ''}${t}`;
  const adresse = (t) => couper((t.match(/:\s*(.+)$/)?.[1] ?? t).replace(/^\((?:i|ii)\)\s*/i, ''), 40);
  const quoi = (t) => couper(t.replace(/^Contract Award\s*(?:-|for)\s*/i, ''), 45);
  const qui = s.nom === 'Public Hearing' ? tr('À cette audience publique, le conseil', 'At this public hearing, Council')
    : /Finance|Policy/.test(s.nom) ? tr('Le comité', 'The committee') : tr('Le conseil', 'Council');
  const morceaux = [];
  if (EN) {
    if (zonage.length) morceaux.push(`approved ${pluriel(zonage.length, 'rezoning', 'rezonings')} (${liste(zonage.map((p) => sj(p, adresse(p.titre))))})`);
    if (contrats.length) morceaux.push(`awarded ${pluriel(contrats.length, 'contract', 'contracts')} (${liste(contrats.map((p) => sj(p, quoi(p.titre))), 2)})`);
    if (autres.length) morceaux.push(`adopted ${liste(autres.map((p) => sj(p, cite(p.titre))), 3)}`);
    if (rejetes.length) morceaux.push(`rejected ${liste(rejetes.map((p) => sj(p, cite(p.titre))), 2)}`);
    if (renvoyes.length) morceaux.push(`referred ${liste(renvoyes.map((p) => sj(p, cite(p.titre))), 2)}`);
  } else {
    if (zonage.length) morceaux.push(`a approuvé ${zonage.length} ${zonage.length > 1 ? 'rezonages' : 'rezonage'} (${liste(zonage.map((p) => sj(p, adresse(p.titre))))})`);
    if (contrats.length) morceaux.push(`a attribué ${contrats.length} ${contrats.length > 1 ? 'contrats' : 'contrat'} (${liste(contrats.map((p) => sj(p, quoi(p.titre))), 2)})`);
    if (autres.length) morceaux.push(`a adopté ${liste(autres.map((p) => sj(p, cite(p.titre))), 3)}`);
    if (rejetes.length) morceaux.push(`a rejeté ${liste(rejetes.map((p) => sj(p, cite(p.titre))), 2)}`);
    if (renvoyes.length) morceaux.push(`a renvoyé ${liste(renvoyes.map((p) => sj(p, cite(p.titre))), 2)}`);
  }
  if (!morceaux.length) return '';
  const et = EN ? (morceaux.length > 2 ? ', and ' : ' and ') : ' et ';
  const corps = morceaux.length > 1 ? `${morceaux.slice(0, -1).join(', ')}${et}${morceaux[morceaux.length - 1]}` : morceaux[0];
  return `${qui} ${corps}.`;
}

// The counts, under the recap. Only counts, only City values.
function phrase(s, decs) {
  const adoptees = decs.filter((d) => /carried/i.test(d.resultat)).length;
  const rejetees = decs.filter((d) => /lost|defeated/i.test(d.resultat)).length;   // N.-B. : Defeated
  const divisees = decs.filter((d) => d.decompteContre > 0 || d.dissidences?.length).length;   // N.-B.
  const unanimes = decs.filter((d) => /unanimously/i.test(d.resultat)).length;
  const sujets = {};
  for (const d of decs) sujets[d.theme] = (sujets[d.theme] ?? 0) + 1;
  const [principal, nP] = Object.entries(sujets).sort((a, b) => b[1] - a[1])[0] ?? [];
  if (!EN) {
    let t = `${decs.length} ${decs.length === 1 ? 'résolution' : 'résolutions'} : ${adoptees} ${adoptees > 1 ? 'adoptées' : 'adoptée'}${rejetees ? `, ${rejetees} ${rejetees > 1 ? 'rejetées' : 'rejetée'}` : ''}.`;   // N.-B. : pas de vote nominal
    if (principal && nP >= 2 && decs.length >= 3) t += ` Sujet le plus fréquent : ${nomTheme(principal).toLowerCase()} (${nP} points).`;
    return t;
  }
  let t = `${pluriel(decs.length, 'resolution', 'resolutions')}: ${adoptees} carried${rejetees ? `, ${rejetees} defeated` : ''}.`;   // N.-B.
  if (principal && nP >= 2 && decs.length >= 3) t += ` Most items (${nP}) were about ${THEMES[principal]?.toLowerCase() ?? principal}.`;
  return t;
}

// The three items worth showing: split votes first (closest first), then lost motions, then the rest.
// The same agenda line is often voted more than once (an amendment, then the motion as amended):
// one line per agenda item, the most telling vote kept.
function uniques(liste) {
  const vus = new Set();
  return liste.filter((d) => !vus.has(d.objet) && vus.add(d.objet));
}
function marquants(decs) {
  const poids = (d) => (/lost/i.test(d.resultat) ? 0 : d.decompteContre > 0 ? 1 : 2);
  const marge = (d) => Math.abs(d.decomptePour - d.decompteContre);
  return uniques([...decs].sort((a, b) => poids(a) - poids(b) || marge(a) - marge(b))).slice(0, 3);
}

function blocVotes(decs) {
  const divises = decs.filter((d) => d.decompteContre > 0).sort((a, b) => Math.abs(a.decomptePour - a.decompteContre) - Math.abs(b.decomptePour - b.decompteContre));
  // N.-B. : le procès-verbal de Fredericton ne note pas de vote nominal ; on ne dit rien de l'unanimité.
  if (!divises.length) return `<p class="eb-votes-aucun">${(() => { const d = decs.filter((x) => x.dissidences?.length); return d.length ? d.map((x) => `${tr('Vote divisé', 'Divided vote')} : ${echapper(couper(adoucir(!EN && x.objetFr ? x.objetFr : x.objet), 60))} — ${tr('contre', 'against')} : ${x.dissidences.map(echapper).join(', ')}.`).join('<br>') : tr('Le procès-verbal ne note aucun vote contre à cette séance.', 'The minutes record no vote against at this meeting.'); })()}</p>`;
  const montres = uniques(divises).slice(0, 2);
  const lignes = montres.map((v) => {
    const total = v.decomptePour + v.decompteContre || 1;
    return `<a class="eb-vote" href="${PAGE}?q=${encodeURIComponent(v.numero)}">
      <span class="eb-vote-titre">${echapper(couper(adoucir(v.objet), 70))}</span>
      <span class="eb-vote-compte"><b class="p">${v.decomptePour}</b> ${tr('pour', 'for')} · <b class="c">${v.decompteContre}</b> ${tr('contre', 'against')}</span>
      <span class="eb-vote-barre"><i class="p" style="width:${(v.decomptePour / total * 100).toFixed(1)}%"></i><i class="c" style="width:${(v.decompteContre / total * 100).toFixed(1)}%"></i></span>
    </a>`;
  }).join('');
  const reste = divises.length - montres.length;
  return `<div class="eb-votes"><span class="eb-votes-titre">${tr(`Vote${divises.length > 1 ? 's' : ''} divisé${divises.length > 1 ? 's' : ''} (${divises.length} sur ${decs.length})`, `Split vote${divises.length > 1 ? 's' : ''} (${divises.length} of ${decs.length})`)}</span>${lignes}${reste > 0 ? `<a class="eb-votes-plus" href="${PAGE}?instance=${encodeURIComponent(decs[0].instance)}">${tr(`et ${reste} autre${reste > 1 ? 's' : ''}`, `and ${reste} more`)} →</a>` : ''}</div>`;
}

function carteOrdreDuJour(s, decs) {
  const pts = decs.filter((d) => d.theme !== 'procedure').slice(0, 6).map((d) => `<li class="eb-pt t-bord-${d.theme}" title="${echapper(nomTheme(d.theme))}"><a href="${PAGE}?q=${encodeURIComponent(d.numero)}"><span class="eb-titre">${echapper(couper(adoucir(!EN && d.objetFr ? d.objetFr : d.objet), 85))}</span></a></li>`).join('');
  return `<article class="eb-carte">
    <span class="eb-sorte">${tr('Ordre du jour · décision pas encore publiée', 'Agenda · decision not yet published')}</span>
    <header><h3>${echapper(s.nom)}</h3>
    <span class="eb-date">${tr('Séance du', 'Meeting of')} ${dateLongue(s.date)} · ${tr(`${decs.length} point${decs.length > 1 ? 's' : ''} à l’ordre du jour`, pluriel(decs.length, 'agenda item', 'agenda items'))}</span></header>
    <div class="eb-phrase">${tr('Voici ce qui était présenté au conseil. La Ville publie le procès-verbal environ trois mois plus tard : on ne sait pas encore ce qui a été décidé.', 'Here is what was put before Council. The City publishes the minutes about three months later, so what was decided is not known yet.')}</div>
    ${pts ? `<ul class="eb-points">${pts}</ul>` : ''}
    <div class="eb-liens"><a class="eb-officiel" href="${echapper(s.lien)}" target="_blank" rel="noopener">${tr('Ordre du jour officiel de la Ville (PDF)', 'Official City agenda (PDF)')} ↗</a></div>
  </article>`;
}

function carte(s, decs, explication) {
  if (s.ordreDuJour) return carteOrdreDuJour(s, decs);   // N.-B.
  const points = marquants(decs).map((d) => {
    const divise = d.decompteContre > 0;
    return `<li class="eb-pt t-bord-${d.theme}" title="${echapper(nomTheme(d.theme))}"><a href="${PAGE}?q=${encodeURIComponent(d.numero)}"><span class="eb-titre">${echapper(couper(adoucir(!EN && d.objetFr ? d.objetFr : d.objet), 85))}</span>`
      + `<span class="eb-montant">${echapper(EN ? d.resultat : libelleFr(d.resultat))}</span>`
      + (divise ? `<span class="eb-divise">${d.decomptePour}–${d.decompteContre}</span>` : '')
      + '</a></li>';
  }).join('');
  return `<article class="eb-carte">
    <span class="eb-sorte eb-sorte-pv">${tr('Procès-verbal · décidé', 'Minutes · decided')}</span>
    <header><h3>${echapper(s.nom)}<span class="eb-rythme">/${rythme(s.nom)}</span></h3>
    <span class="eb-date">${tr('Séance du', 'Meeting of')} ${dateLongue(s.date)} · ${tr(`${decs.length} résolution${decs.length > 1 ? 's' : ''}`, pluriel(decs.length, 'resolution', 'resolutions'))}</span></header>
    ${(() => { const r = recap(s, decs); return r ? `<div class="eb-phrase">${souligner(r)}</div><p class="eb-compte">${echapper(phrase(s, decs))}</p>` : `<div class="eb-phrase">${echapper(phrase(s, decs))}</div>`; })()}
    ${explication ? `<p class="eb-attente">${echapper(explication)}</p>` : ''}
    ${points ? `<ul class="eb-points">${points}</ul>` : ''}
    ${blocVotes(decs)}
    <div class="eb-liens"><a class="eb-tout" href="${PAGE}?instance=${encodeURIComponent(s.nom)}">${tr('Toutes ses décisions', 'All its decisions')} →</a>
    <a class="eb-officiel" href="${echapper(s.lien)}" target="_blank" rel="noopener">${tr('Procès-verbal officiel de la Ville (PDF)', 'Official City minutes (PDF)')} ↗</a></div>
  </article>`;
}

async function init() {
  const zone = document.getElementById('en-bref');
  if (!zone) return;
  let seances, decisions;
  try {
    const [rs, rd] = await Promise.all([fetch('data/seances.json', { cache: 'no-cache' }), fetch('data/decisions.json', { cache: 'no-cache' })]);
    if (!rs.ok || !rd.ok) return;
    [seances, decisions] = await Promise.all([rs.json(), rd.json()]);
  } catch { return; }
  const parSeance = new Map();
  // N.-B. : les fiches d'information ne sont pas des décisions ; elles restent hors du résumé.
  for (const d of decisions.decisions ?? []) if (!d.information) (parSeance.get(d.seanceId) ?? parSeance.set(d.seanceId, []).get(d.seanceId)).push(d);
  // The latest meeting of each body, most recent body first; Council always first.
  const vues = new Set();
  const dernieres = [...(seances.seances ?? [])].sort((a, b) => b.date.localeCompare(a.date))
    .filter((s) => parSeance.has(s.id) && !vues.has(s.ordreDuJour ? 'odj' : 'pv') && vues.add(s.ordreDuJour ? 'odj' : 'pv'))   // N.-B.
    .sort((a, b) => (a.nom === 'Council' ? -1 : b.nom === 'Council' ? 1 : b.date.localeCompare(a.date)))
    // N.-B. (Martin, 19 nov. 2026) : la plus récente d'abord (l'ordre du jour), puis le dernier procès-verbal.
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!dernieres.length) return;
  const { depuis, jusqua } = decisions.parametres ?? {};
  const fenetre = depuis && jusqua ? ` ${tr(`du ${dateLongue(depuis)} au ${dateLongue(jusqua)}`, `${dateLongue(depuis)} to ${dateLongue(jusqua)}`)}` : '';
  zone.innerHTML = `<div class="resume eb-gros">
    <div class="resume-entete"><span>${tr('En bref — la dernière séance du conseil · tiré du procès-verbal de la Ville, pas écrit par IA', 'In brief — the latest Council meeting · taken from the City’s minutes, not written by AI')}</span></div>
    <div class="eb-note">${EN ? `<strong>From the City’s minutes.</strong> Each card is one meeting: what it decided, resolution by resolution. The names in quotes are the titles in the minutes. Nothing is summarized, nothing is guessed. The minutes name those who voted against only when the vote is divided.${fenetre ? ` Period:${fenetre}.` : ''}` : `<strong>D’après le procès-verbal de la Ville.</strong> Chaque carte est une séance : ce qu’elle a décidé, résolution par résolution. Les noms entre guillemets sont les titres du procès-verbal. Rien n’est résumé, rien n’est deviné. Le procès-verbal ne nomme ceux qui ont voté contre que lorsque le vote est divisé.${fenetre ? ` Période :${fenetre}.` : ''}`}</div>
    <div class="eb-grille">${dernieres.map((s) => carte(s, parSeance.get(s.id), EN ? seances.instances?.[s.nom] : INSTANCES_FR[s.nom] ?? seances.instances?.[s.nom])).join('')}</div>
    <a class="eb-detail" href="#liste-decisions">${tr('Voir toutes les décisions, séance par séance ↓', 'See every decision, meeting by meeting ↓')}</a>
  </div>`;
  // The sponsor thank-you goes right under the box, as on Montréal (13 Nov. 2026).
  const merci = document.querySelector('aside.merci-commanditaire');
  if (merci) zone.appendChild(merci);
  zone.hidden = false;
  // Arriving on one motion (?q=): the box stays on top, but it pushed the list down — scroll to the card.
  if (new URLSearchParams(location.search).has('q')) {
    let essais = 0;
    const viser = () => {
      const fiches = document.querySelectorAll('#liste-decisions details.carte');
      if (fiches.length === 1) {
        fiches[0].scrollIntoView({ block: 'center' });
        setTimeout(() => fiches[0].scrollIntoView({ block: 'center' }), 600);
      } else if (essais++ < 30) setTimeout(viser, 100);
    };
    requestAnimationFrame(viser);
  }
}
init();
