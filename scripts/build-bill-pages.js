// UNE PAGE PAR PROJET DE LOI — /projets-de-loi/3-43-3 (numéro-législature-session, comme l'adresse
// de l'Assemblée : projet-loi-3-43-3). Martin, 1er oct. 2026, d'après DossierCanada
// (/projets-de-loi/c-12) : que chaque NOUVEAU projet de la 44e législature puisse être indexé
// par Google dès son dépôt. Le numéro seul ne suffit pas : il recommence à 1 à chaque session.
//
// Chaque page est la page « Projets de loi » à l'identique (le site s'y comporte normalement :
// commun/dq.js lit le chemin et ouvre ce projet), avec son propre <head> (titre, description tirée
// du résumé en clair, canonical, Open Graph, fil d'Ariane) et, écrit dans la page, le titre et le
// résumé du projet, pour qu'un moteur les lise sans exécuter le code. Les pages entrent au sitemap.
//
// Lancé par scripts/build-section-pages.js, à la fin (il lit projets-de-loi.html qu'il vient
// d'écrire). Un projet qui disparaît de data/bills.json perd sa page : le dossier est refait à neuf.
//
// ARCHIVES (Martin, 4 oct. 2026). scrapers/bills.js ne garde que la législature la plus récente :
// au premier projet de la 44e, les 143 projets de la 43e sortent de data/bills.json, et leurs pages
// (avec leur référencement) tomberaient en 404. Chaque build recopie donc la législature EN DIRECT
// dans data/archives/<législature>/ ; le jour où elle change, la copie de l'ancienne reste telle
// quelle, ses pages continuent d'être fabriquées ici, et commun/dq.js la sert derrière le lien
// « Archives de la 43e législature ». Rien à faire à la main, ni cette fois ni les suivantes.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { PAGES_EN } from './pages-en.js';
import { slugMinistre, norm } from './build-minister-pages.js';

const SITE = 'https://dossiernbrunswick.ca';
const DOSSIER = 'projets-de-loi';
const echapper = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const texte = (html) => String(html ?? '').replace(/<details[\s\S]*?<\/details>/g, '').replace(/([^.!?])\s*<\/li>/g, '$1. ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

export const slugProjet = (b) => (b.legislature && b.introSession ? `${b.num}-${b.legislature}-${b.introSession}` : null);

const ARCHIVES = 'data/archives';
const lire = (chemin, defaut) => (existsSync(chemin) ? JSON.parse(readFileSync(chemin, 'utf8')) : defaut);
const copier = (de, vers) => {
  if (!existsSync(de)) return;
  const contenu = readFileSync(de, 'utf8');
  if (!existsSync(vers) || readFileSync(vers, 'utf8') !== contenu) writeFileSync(vers, contenu, 'utf8');
};

// La législature en direct, recopiée dans data/archives/<législature>/ : ce que le site affiche
// (data/site/bills.json), les résumés, et les données brutes dont ces pages ont besoin.
function archiverLegislature(bills) {
  const leg = Math.max(...bills.map((b) => Number(b.legislature) || 0));
  if (!leg) return null;
  const dossier = `${ARCHIVES}/${leg}`;
  mkdirSync(dossier, { recursive: true });
  copier('data/bills.json', `${dossier}/bills-brut.json`);
  copier('data/site/bills.json', `${dossier}/bills.json`);
  copier('data/bills-resumes-fr.json', `${dossier}/bills-resumes-fr.json`);
  copier('data/bills-resumes-en.json', `${dossier}/bills-resumes-en.json`);
  const toutes = readdirSync(ARCHIVES).filter((d) => /^\d+$/.test(d) && existsSync(`${ARCHIVES}/${d}/bills.json`)).map(Number).sort((a, b) => a - b);
  const index = JSON.stringify({ enDirect: leg, legislatures: toutes });
  if (!existsSync(`${ARCHIVES}/index.json`) || readFileSync(`${ARCHIVES}/index.json`, 'utf8') !== index) writeFileSync(`${ARCHIVES}/index.json`, index, 'utf8');
  return { leg, anciennes: toutes.filter((l) => l !== leg) };
}

export function construirePagesProjets() {
  const modele = readFileSync(`${DOSSIER}.html`, 'utf8');
  const enDirect = JSON.parse(readFileSync('data/bills.json', 'utf8')).bills;
  const archive = archiverLegislature(enDirect);
  // Les projets en direct d'abord, puis ceux des législatures archivées, chacun avec ses résumés.
  const lots = [{ bills: enDirect, resumes: lire('data/bills-resumes-fr.json', {}) }];
  for (const leg of archive?.anciennes ?? []) {
    lots.push({ bills: lire(`${ARCHIVES}/${leg}/bills-brut.json`, { bills: [] }).bills, resumes: lire(`${ARCHIVES}/${leg}/bills-resumes-fr.json`, {}) });
  }

  // On refait le dossier à neuf : aucune page orpheline d'un projet retiré.
  if (existsSync(DOSSIER)) for (const f of readdirSync(DOSSIER)) if (f.endsWith('.html')) rmSync(`${DOSSIER}/${f}`);
  mkdirSync(DOSSIER, { recursive: true });

  // N.-B. (8 nov. 2026, audit de Kyle) : le parrain mène à sa fiche, quand il en a une (ministre ou
  // chef de parti). « Kennedy, Aaron » ou « McKee, K.C., Robert » : nom de famille, puis prénom.
  const fiches = new Map([
    ...lire('data/site/ministers.json', []).map((m) => [norm(m.name), `/ministres/${slugMinistre(m.name)}`]),
    ...lire('data/site/chefsOpposition.json', []).map((c) => [norm(c.name), `/deputes/${slugMinistre(c.name)}`]),
  ]);
  const partiesDuNom = (sponsor) => String(sponsor ?? '').split(' — ')[0].split(',').map((x) => x.trim()).filter(Boolean);
  const ficheDuParrain = (sponsor) => {
    const p = partiesDuNom(sponsor);
    return p.length >= 2 ? fiches.get(norm(p.at(-1) + p[0])) ?? null : null;
  };
  const nomDuParrain = (sponsor) => {
    const p = partiesDuNom(sponsor);
    return p.length >= 2 ? `${p.at(-1)} ${p[0]}` : String(sponsor ?? '');
  };
  // Un numéro qui revient d'une session à l'autre (PL 1, PL 2…) : le titre dit alors la session.
  const parNumero = new Map();
  for (const { bills } of lots) for (const b of bills) parNumero.set(`${b.legislature}-${b.num}`, (parNumero.get(`${b.legislature}-${b.num}`) ?? 0) + 1);
  const ordFr = (n) => (Number(n) === 1 ? '1re' : `${n}e`);
  const ordEn = (n) => `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' }[(n % 100 >= 11 && n % 100 <= 13) ? 0 : n % 10] || 'th')}`;
  const couper = (t, n) => (t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '').replace(/[.,;:]$/, '')}…` : t);
  const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dateFr = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return y && m && d ? `${d === 1 ? '1er' : d} ${MOIS[m - 1]} ${y}` : iso; };
  const dateEn = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return y && m && d ? `${MONTHS[m - 1]} ${d}, ${y}` : iso; };
  const resumesEn = [lire('data/bills-resumes-en.json', {}), ...(archive?.anciennes ?? []).map((leg) => lire(`${ARCHIVES}/${leg}/bills-resumes-en.json`, {}))];
  const resumeEnDe = (id) => resumesEn.map((r) => r[id]).find(Boolean) ?? '';
  // « Pas encore de résumé » n'est pas un résumé : la description se tire alors des données.
  const vraiResume = (html) => (/^\s*<p><em>/.test(html ?? '') ? '' : (html ?? ''));

  const vues = new Set();
  const adresses = [];
  for (const { bills, resumes } of lots) for (const b of bills) {
    const slug = slugProjet(b);
    if (!slug || vues.has(slug)) continue;
    vues.add(slug);
    const url = `${SITE}/${DOSSIER}/${slug}`;
    const urlEn = `${SITE}/en/${DOSSIER}/${slug}`;
    const resumeHtml = resumes[b.id] ?? '';
    const resumeHtmlEn = resumeEnDe(b.id);
    // Les sous-titres du résumé (h4 à h6) passent en h3 sous le titre du projet : un moteur lit un plan
    // sans niveau sauté. Seule la copie écrite dans la page change ; commun/dq.js refait la carte.
    const resumePage = resumeHtml.replace(/<(\/?)h[4-6]\b/g, '<$1h3');
    const resumePageEn = resumeHtmlEn.replace(/<(\/?)h[4-6]\b/g, '<$1h3');
    const resume = texte(vraiResume(resumeHtml));
    const resumeEn = texte(vraiResume(resumeHtmlEn));
    const titreEn = b.titleEn || b.title;
    const doublon = (parNumero.get(`${b.legislature}-${b.num}`) ?? 0) > 1;
    // N.-B. (8 nov. 2026) : « Projet de loi 12 », pas « PL 12 » : c'est ce qu'on tape dans Google.
    // Un numéro repris d'une session à l'autre porte sa session, sinon deux pages auraient le même titre.
    const nomFr = `Projet de loi ${b.num}`;
    const nomEn = `Bill ${b.num}`;
    const titre = `${nomFr} (N.-B.${doublon ? `, ${ordFr(b.introSession)} session` : ''}) : ${couper(b.title, 60)} — DossierNBrunswick`;
    const titreEnPage = `${nomEn} (N.B.${doublon ? `, ${ordEn(b.introSession)} session` : ''}): ${couper(titreEn, 60)} — DossierNBrunswick`;
    const parrain = nomDuParrain(b.sponsor);
    const etapeFr = (b.note || '').replace(/ le (\d{4}-\d{2}-\d{2})/g, (_, d) => ` le ${dateFr(d)}`);
    const etapeEn = (b.noteEn || '').replace(/ on (\d{4}-\d{2}-\d{2})/g, (_, d) => ` on ${dateEn(d)}`);
    const baseFr = resume || [`${b.title}.`, etapeFr ? `${etapeFr}.` : '', parrain ? `Parrain : ${parrain}.` : '', 'Assemblée législative du Nouveau-Brunswick.'].filter(Boolean).join(' ');
    const baseEn = resumeEn || [`${titreEn}.`, etapeEn ? `${etapeEn}.` : '', parrain ? `Sponsor: ${parrain}.` : '', 'Legislative Assembly of New Brunswick.'].filter(Boolean).join(' ');
    const desc = couper(`${nomFr} : ${baseFr}`, 160);
    const descEn = couper(`${nomEn}: ${baseEn}`, 160);
    const lienParrain = ficheDuParrain(b.sponsor);

    const legislation = (en) => ({
      '@type': 'Legislation',
      name: en ? titreEn : b.title,
      alternateName: en ? nomEn : nomFr,
      legislationIdentifier: `${b.legislature}-${b.introSession}-${b.num}`,
      legislationJurisdiction: en ? 'New Brunswick' : 'Nouveau-Brunswick',
      legislationType: en ? (b.typeEn || 'Bill') : (b.type || 'Projet de loi'),
      inLanguage: en ? 'en-CA' : 'fr-CA',
      ...(b.presentedOn ? { legislationDate: b.presentedOn } : {}),
      ...(parrain ? { author: { '@type': 'Person', name: parrain, ...(lienParrain ? { url: `${SITE}${en ? '/en' : ''}${lienParrain}` } : {}) } } : {}),
      sameAs: en ? (b.urlEn || b.url) : b.url,
      url: en ? urlEn : url,
    });
    const filAriane = (en) => ({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: en ? 'Home' : 'Accueil', item: `${SITE}${en ? '/en' : ''}/` },
        { '@type': 'ListItem', position: 2, name: en ? 'Bills' : 'Projets de loi', item: `${SITE}${en ? '/en' : ''}/${DOSSIER}` },
        { '@type': 'ListItem', position: 3, name: en ? nomEn : nomFr, item: en ? urlEn : url },
      ],
    });
    const ld = (en) => JSON.stringify({ '@context': 'https://schema.org', '@graph': [filAriane(en), legislation(en)] }, null, 2).replace(/</g, '\\u003c');

    let h = modele;
    const remplacer = (motif, valeur) => {
      if (!motif.test(h)) throw new Error(`build-bill-pages : ${motif} introuvable dans ${DOSSIER}.html`);
      h = h.replace(motif, () => valeur);
    };
    remplacer(/<title>[^<]*<\/title>/, `<title>${echapper(titre)}</title>`);
    remplacer(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${echapper(desc)}">`);
    remplacer(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
    remplacer(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${echapper(titre)}">`);
    remplacer(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${echapper(desc)}">`);
    remplacer(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
    h = h.replace(/<meta name="twitter:title" content="[^"]*">/, () => `<meta name="twitter:title" content="${echapper(titre)}">`)
      .replace(/<meta name="twitter:description" content="[^"]*">/, () => `<meta name="twitter:description" content="${echapper(desc)}">`);
    remplacer(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">\n${ld(false)}\n</script>`);
    // N.-B. (8 nov. 2026) : le titre de la page est le projet. L'affiche garde son allure : le
    // bandeau jaune du sujet devient le <h1> (nom du projet), le slogan reste à côté, hors du titre.
    const affiche = (en) => `<div class="hero-h1 hero-h1-md">
        <h1 class="hero-sujet">${echapper(en ? `${nomEn}: ${titreEn}` : `${nomFr} : ${b.title}`)}</h1>
        <span data-i18n="projhero.l1">${en ? 'Bills,' : 'Projets de loi,'}</span>
        <span class="hero-outline" data-i18n="projhero.l2">${en ? 'translated plainly.' : 'traduits en clair.'}</span>
      </div>`;
    remplacer(/<h1 class="hero-h1 hero-h1-md">[\s\S]*?<\/h1>/, affiche(false));
    const fil = (en) => `<nav class="fil-ariane" aria-label="${en ? 'Breadcrumb' : 'Fil d’Ariane'}"><a href="${en ? '/en/' : '/'}" data-i18n="fil.accueil">${en ? 'Home' : 'Accueil'}</a><span class="sep" aria-hidden="true">›</span><a href="${en ? '/en' : ''}/${DOSSIER}" data-i18n="fil.projets">${en ? 'Bills' : 'Projets de loi'}</a><span class="sep" aria-hidden="true">›</span><span aria-current="page">${echapper(en ? nomEn : nomFr)}</span></nav>`;
    remplacer(/<nav class="fil-ariane"[\s\S]*?<\/nav>/, fil(false));
    // Le projet, écrit dans la page. commun/dq.js remplace le contenu de #billsList au chargement,
    // puis ouvre la carte de ce projet (openBillFromQuery lit le chemin).
    const fiche = (en) => {
      const p = lienParrain ? `<a href="${en ? '/en' : ''}${lienParrain}">${echapper(parrain)}</a>` : echapper(parrain);
      const etape = echapper(en ? etapeEn : etapeFr);
      const ligneParrain = parrain ? `${etape ? ' · ' : ''}${en ? 'Sponsor: ' : 'Parrain : '}${p}` : '';
      return `<div id="billsList"><article class="bill-prerendu">
<h2>${echapper(en ? `${nomEn}: ${titreEn}` : `${nomFr} : ${b.title}`)}</h2>
<p>${etape}${ligneParrain}</p>
${en ? resumePageEn : resumePage}
<p><a href="${echapper(en ? (b.urlEn || b.url) : b.url)}" rel="noopener">${en ? 'The bill on the Legislative Assembly website (legnb.ca)' : 'Le projet de loi sur le site de l’Assemblée législative (legnb.ca)'}</a></p>
</article></div>`;
    };
    remplacer(/<div id="billsList"><\/div>/, fiche(false));
    // La liste écrite sous le projet : les autres projets de la MÊME session, en liens, plutôt que
    // les 101 du site recopiés sur chaque page (audit de Kyle).
    const memeSession = bills.filter((x) => x !== b && x.legislature === b.legislature && x.introSession === b.introSession && slugProjet(x));
    const autres = (en) => `<div class="prerendu" data-prerendu="bills">
      <h2>${en ? `Other bills of the ${ordEn(b.introSession)} session` : `Les autres projets de la ${ordFr(b.introSession)} session`}</h2>
      <ul aria-label="${en ? 'Bills' : 'Projets de loi'}">
${memeSession.map((x) => `        <li><a href="${en ? '/en' : ''}/${DOSSIER}/${slugProjet(x)}">${echapper(en ? `Bill ${x.num}` : `Projet de loi ${x.num}`)}</a> — ${echapper(en ? (x.titleEn || x.title) : x.title)}</li>`).join('\n')}
      </ul>
      <p class="pr-note"><a href="${en ? '/en' : ''}/${DOSSIER}">${en ? 'All bills →' : 'Tous les projets de loi →'}</a></p>
    </div>`;
    remplacer(/<div class="prerendu" data-prerendu="bills">[\s\S]*?<\/div>/, autres(false));
    writeFileSync(`${DOSSIER}/${slug}.html`, h, 'utf8');
    adresses.push({ url, lastmod: b.lastActivity ?? null });
    PAGES_EN.set(`${DOSSIER}/${slug}.html`, {
      title: titreEnPage, desc: descEn, ld: ld(true),
      blocs: { '.view-hero .hero-h1': affiche(true), 'nav.fil-ariane': fil(true), '#billsList': fiche(true), '[data-prerendu="bills"]': autres(true) },
    });
  }

  // Au sitemap, à la suite des pages du site (build-section-pages.js vient de l'écrire).
  const plan = readFileSync('sitemap.xml', 'utf8').replace(/\r\n/g, '\n');
  const entrees = adresses.map((a) => `  <url>\n    <loc>${a.url}</loc>\n${a.lastmod ? `    <lastmod>${a.lastmod}</lastmod>\n` : ''}    <changefreq>weekly</changefreq>\n    <priority>0.6</priority>\n  </url>`).join('\n');
  const nouveau = plan.replace(/\n<\/urlset>/, `\n${entrees}\n</urlset>`);
  if (nouveau !== plan) writeFileSync('sitemap.xml', nouveau, 'utf8');
  console.log(`✓ ${adresses.length} pages de projets de loi (/${DOSSIER}/numéro-législature-session), au sitemap${archive?.anciennes.length ? ` — dont les archives : ${archive.anciennes.map((l) => `${l}e`).join(', ')}` : ''}.`);
}
