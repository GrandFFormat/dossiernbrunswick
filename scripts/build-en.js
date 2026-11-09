// N.-B. (8 nov. 2026, audit de Kyle) : LES PAGES ANGLAISES, sous /en/.
//
// Avant, l'anglais n'existait que dans le navigateur : ?lang=en servait la page française, que
// commun/dq.js traduisait après coup. Google ne voyait donc qu'une page, en français, alors qu'au
// Nouveau-Brunswick deux recherches sur trois se font en anglais. Chaque page publique a maintenant
// sa jumelle anglaise écrite dans le HTML : /en/projets-de-loi/14-61-3, /en/ministres/susan-holt…
// avec son titre, sa description, son <html lang="en">, son canonical et ses liens vers /en/.
// Les deux versions se désignent l'une l'autre (hreflang fr-CA, en-CA, x-default = français).
//
// Rien n'est traduit ici : tout vient de ce qui existe déjà.
//   - les textes fixes (data-i18n) : le dictionnaire anglais de commun/dq.js (translations.en) ;
//   - les fiches de ministres et de chefs : le texte anglais déjà dans la page (.en-txt) ;
//   - les titres, descriptions et listes écrites dans le HTML : ce que chaque script de pages a
//     laissé dans scripts/pages-en.js.
// Le design ne change pas : même page, même CSS, même script.
//
// Lancé par scripts/build-section-pages.js, en tout dernier. Le dossier en/ est refait à neuf.

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import * as cheerio from 'cheerio';
import { PAGES_EN } from './pages-en.js';

const SITE = 'https://dossiernbrunswick.ca';
const DOSSIER = 'en';

// « index.html » → « / », « ministres/susan-holt.html » → « /ministres/susan-holt ».
const cheminDe = (fichier) => (fichier === 'index.html' ? '/' : `/${fichier.replace(/\.html$/, '')}`);
const enAnglais = (chemin) => (chemin === '/' ? '/en/' : `/en${chemin}`);

// Le dictionnaire anglais de commun/dq.js : `const translations = { fr: {…}, en: {…} };`. On lit
// l'objet en comptant les accolades hors des chaînes, puis on l'évalue (c'est notre propre code).
function dictionnaireAnglais() {
  const js = readFileSync('commun/dq.js', 'utf8');
  const debut = js.indexOf('const translations = {');
  if (debut === -1) throw new Error('build-en : const translations introuvable dans commun/dq.js');
  let i = js.indexOf('{', debut), prof = 0, chaine = null, echappe = false;
  const depart = i;
  for (; i < js.length; i++) {
    const c = js[i];
    if (chaine) { if (echappe) echappe = false; else if (c === '\\') echappe = true; else if (c === chaine) chaine = null; continue; }
    if (c === '"' || c === "'" || c === '`') { chaine = c; continue; }
    if (c === '{') prof++;
    else if (c === '}' && --prof === 0) break;
  }
  const objet = new Function(`return (${js.slice(depart, i + 1)})`)();
  if (!objet?.en || Object.keys(objet.en).length < 100) throw new Error('build-en : dictionnaire anglais vide ou illisible');
  return objet.en;
}

// Le fil d'Ariane des données structurées : les noms français connus, en anglais.
const NOMS_EN = {
  'Accueil': 'Home', 'Projets de loi': 'Bills', 'Ministres et député·e·s': 'Ministers and MLAs', 'Votes': 'Votes',
  'Lexique': 'Glossary', 'Les règles': 'The rules', 'Mises à jour du site': 'Site updates',
};

export function construirePagesAnglaises() {
  const en = dictionnaireAnglais();
  const chemins = new Set([...PAGES_EN.keys()].map(cheminDe));
  // Un lien interne mène à la version anglaise quand elle existe ; sinon il garde ?lang=en (Mon dossier…).
  const lienAnglais = (href) => {
    if (!href || !href.startsWith('/') || href.startsWith('//') || /^\/en(\/|$|\?|#)/.test(href)) return href;
    const [, chemin, reste = ''] = href.match(/^([^?#]*)(.*)$/);
    const propre = (chemin.replace(/\.html$/, '').replace(/(.)\/$/, '$1')) || '/';
    const sansLang = reste.replace(/([?&])lang=(en|fr)(&|(?=#)|$)/, (_, a, __, b) => (b === '&' ? a : '')).replace(/^\?(?=#|$)/, '');
    if (chemins.has(propre)) return enAnglais(propre) + sansLang;
    if (/^\/(commun|data|api|ministres\/photos|deputes\/photos)\//.test(chemin) || /\.[a-z0-9]+$/i.test(chemin)) return href;
    return chemin + (sansLang.includes('?') ? sansLang.replace('?', '?lang=en&') : `?lang=en${sansLang}`);
  };
  const hreflang = (fr, anglais) => `<link rel="alternate" hreflang="fr-CA" href="${fr}">\n<link rel="alternate" hreflang="en-CA" href="${anglais}">\n<link rel="alternate" hreflang="x-default" href="${fr}">`;

  if (existsSync(DOSSIER)) rmSync(DOSSIER, { recursive: true, force: true });
  let n = 0;
  for (const [fichier, page] of PAGES_EN) {
    if (!existsSync(fichier)) throw new Error(`build-en : ${fichier} introuvable`);
    const chemin = cheminDe(fichier);
    const urlFr = SITE + chemin;
    const urlEn = SITE + enAnglais(chemin);
    let source = readFileSync(fichier, 'utf8').replace(/\r\n/g, '\n');

    // La page FRANÇAISE reçoit ses liens hreflang (refaits à chaque build).
    source = source.replace(/\n<link rel="alternate" hreflang="[^"]*" href="[^"]*">/g, '');
    if (!/<link rel="canonical" href="[^"]*">/.test(source)) throw new Error(`build-en : ${fichier} n'a pas de canonical`);
    source = source.replace(/(<link rel="canonical" href="[^"]*">)/, `$1\n${hreflang(urlFr, urlEn)}`);
    writeFileSync(fichier, source, 'utf8');

    const $ = cheerio.load(source, { decodeEntities: false });
    $('html').attr('lang', 'en');
    // Les textes fixes, puis les blocs propres à la page (qui portent déjà leur texte anglais).
    $('[data-i18n]').each((_, e) => { const t = en[$(e).attr('data-i18n')]; if (t !== undefined) $(e).html(t); });
    $('[data-i18n-placeholder]').each((_, e) => { const t = en[$(e).attr('data-i18n-placeholder')]; if (t !== undefined) $(e).attr('placeholder', t); });
    for (const [selecteur, html] of Object.entries(page.blocs ?? {})) {
      const cible = $(selecteur).first();
      if (!cible.length) throw new Error(`build-en : ${selecteur} introuvable dans ${fichier}`);
      cible.replaceWith(html);
    }
    // Les fiches bilingues : on garde l'anglais seul.
    $('.fr-txt').remove();
    $('.en-txt').each((_, e) => { $(e).replaceWith($(e).html()); });
    $('#langToggle').text('Français');
    if (en['footer.left']) $('#footerLeft').text(en['footer.left']);
    if (en['footer.right']) $('#footerRight').text(en['footer.right']);
    $('#footerDafr').attr('href', 'https://www.dafrsolution.com/en');
    $('body').addClass('lang-en');
    $('nav.fil-ariane').attr('aria-label', 'Breadcrumb');

    // L'en-tête.
    $('title').text(page.title);
    $('meta[name="description"]').attr('content', page.desc);
    $('meta[property="og:title"], meta[name="twitter:title"]').attr('content', page.title);
    $('meta[property="og:description"], meta[name="twitter:description"]').attr('content', page.desc);
    $('meta[property="og:url"]').attr('content', urlEn);
    $('meta[property="og:locale"]').attr('content', 'en_CA').after('\n<meta property="og:locale:alternate" content="fr_CA">');
    $('link[rel="canonical"]').attr('href', urlEn);
    $('link[rel="alternate"][hreflang]').remove();
    $('link[rel="canonical"]').after(`\n${hreflang(urlFr, urlEn)}`);
    const ld = $('script[type="application/ld+json"]').first();
    if (page.ld) ld.text(`\n${page.ld}\n`);
    else if (ld.length) {
      const donnees = JSON.parse(ld.text());
      const parcourir = (o) => {
        if (Array.isArray(o)) return o.map(parcourir);
        if (!o || typeof o !== 'object') return o;
        const r = {};
        for (const [k, v] of Object.entries(o)) {
          if (typeof v === 'string' && (k === 'item' || k === 'url') && v.startsWith(SITE)) r[k] = SITE + lienAnglais(v.slice(SITE.length) || '/');
          else if (k === 'name' && NOMS_EN[v]) r[k] = NOMS_EN[v];
          else if (k === 'inLanguage') r[k] = 'en-CA';
          else if (k === 'description' && o['@type'] === 'WebSite') r[k] = page.desc;
          else r[k] = parcourir(v);
        }
        return r;
      };
      ld.text(`\n${JSON.stringify(parcourir(donnees), null, 2).replace(/<\//g, '<\\/')}\n`);
    }
    // Les liens internes mènent aux pages anglaises.
    $('a[href]').each((_, e) => { const h = $(e).attr('href'); const n2 = lienAnglais(h); if (n2 !== h) $(e).attr('href', n2); });

    const sortie = `${DOSSIER}/${fichier}`;
    mkdirSync(dirname(sortie), { recursive: true });
    let html = $.html();
    // Garde-fous : un seul <h1>, la bonne langue, le bon canonical.
    if ((html.match(/<h1[\s>]/g) || []).length !== 1) throw new Error(`build-en : ${sortie} n'a pas exactement un <h1>`);
    if (!html.includes(`<link rel="canonical" href="${urlEn}">`)) throw new Error(`build-en : canonical manquant sur ${sortie}`);
    writeFileSync(sortie, html, 'utf8');
    n++;
  }

  // Au sitemap : chaque adresse anglaise, juste après sa jumelle française, avec la même date.
  const plan = readFileSync('sitemap.xml', 'utf8').replace(/\r\n/g, '\n');
  const nouveau = plan.replace(/  <url>\n    <loc>([^<]+)<\/loc>\n([\s\S]*?)  <\/url>/g, (bloc, loc, reste) => {
    const chemin = loc.slice(SITE.length) || '/';
    if (!loc.startsWith(SITE) || !chemins.has(chemin)) return bloc;
    return `${bloc}\n  <url>\n    <loc>${SITE}${enAnglais(chemin)}</loc>\n${reste}  </url>`;
  });
  if (nouveau !== plan) writeFileSync('sitemap.xml', nouveau, 'utf8');
  console.log(`✓ ${n} pages anglaises (/${DOSSIER}/…), liées aux françaises par hreflang, au sitemap.`);
}
