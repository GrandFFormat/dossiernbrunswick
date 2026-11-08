// Fabrique l'icône et l'image de partage de DossierNBrunswick, avec Chromium (Playwright).
//
//   commun/nb.svg                        l'icône vectorielle (onglet du navigateur)
//   commun/nb-48.png, nb-180.png, nb-512.png
//   favicon.ico                          un .ico qui contient le PNG de 48 px
//   dossiernbrunswick-cover.png          l'image de partage, 1702 × 630 (Facebook, Reddit, X…)
//
// Même mise en page que l'image de partage de DossierQuébec ; l'étoile jaune du drapeau
// remplace la feuille d'érable, comme dans l'en-tête (commun/nb.css).
//
// Usage : node scripts/fabriquer-images.mjs

import { writeFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const BLEU = '#0033a0', ROUGE = '#e4002b', JAUNE = '#ffd100', ENCRE = '#131313', PAPIER = '#f2f0ea';
const ETOILE = '50,0 61,35 98,35 68,57 79,91 50,70 21,91 32,57 2,35 39,35';

// L'icône : l'étoile jaune sur la tuile bleue, coins carrés comme le monogramme de DQ.
const ICONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="DossierNBrunswick">
  <rect width="64" height="64" fill="${BLEU}"/>
  <rect y="52" width="64" height="12" fill="${ROUGE}"/>
  <polygon transform="translate(10 4) scale(.44)" points="${ETOILE}" fill="${JAUNE}"/>
</svg>
`;

const police = (fichier) => pathToFileURL(`commun/polices/${fichier}`).href;
const COUVERTURE = `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Barlow';font-weight:600;src:url(${police('barlow-600.woff2')})}
  @font-face{font-family:'Barlow';font-weight:700;src:url(${police('barlow-700.woff2')})}
  @font-face{font-family:'Barlow Condensed';font-weight:700;src:url(${police('barlow-condensed-700.woff2')})}
  *{box-sizing:border-box;margin:0}
  body{width:1702px;height:630px;background:${ENCRE};padding:16px;font-family:Barlow,sans-serif}
  .carte{position:relative;width:100%;height:100%;background:${PAPIER};padding:70px 84px}
  h1{font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:150px;line-height:.9;letter-spacing:-.01em;color:${ENCRE};display:flex;align-items:center;gap:28px}
  h1 b{color:${BLEU};font-weight:700}
  h1 svg{width:72px;height:72px;flex:none}
  .filet{width:460px;height:8px;background:${ENCRE};margin:38px 0 34px}
  h2{font-weight:700;font-size:60px;letter-spacing:-.01em;color:${ENCRE};text-transform:uppercase}
  h2 span{color:transparent;-webkit-text-stroke:2px ${ENCRE}}
  .bas{position:absolute;left:84px;bottom:70px;font-weight:600;font-size:25px;letter-spacing:.06em;color:#555;text-transform:uppercase}
  .adresse{position:absolute;right:84px;bottom:52px;background:${JAUNE};border:4px solid ${ENCRE};box-shadow:10px 10px 0 ${ENCRE};padding:14px 28px;font-weight:700;font-size:34px;letter-spacing:.06em;color:${ENCRE}}
  .drapeau{position:absolute;left:0;right:0;top:0;height:10px;background:linear-gradient(90deg,${BLEU} 0 40%,${JAUNE} 40% 60%,${ROUGE} 60%)}
</style></head><body><div class="carte">
  <div class="drapeau"></div>
  <h1><span>DOSSIER<b>NBRUNSWICK</b></span><svg viewBox="0 0 100 100"><polygon points="${ETOILE}" fill="${JAUNE}"/></svg></h1>
  <div class="filet"></div>
  <h2>Qui siège, <span>qui légifère,</span> qui vote quoi.</h2>
  <p class="bas">Site citoyen indépendant · Vraies données publiques</p>
  <p class="adresse">DOSSIERNBRUNSWICK.CA</p>
</div></body></html>`;

// Un .ico n'est qu'un petit en-tête devant une image PNG.
function ico(png, taille) {
  const tete = Buffer.alloc(22);
  tete.writeUInt16LE(0, 0); tete.writeUInt16LE(1, 2); tete.writeUInt16LE(1, 4);
  tete.writeUInt8(taille, 6); tete.writeUInt8(taille, 7); tete.writeUInt8(0, 8); tete.writeUInt8(0, 9);
  tete.writeUInt16LE(1, 10); tete.writeUInt16LE(32, 12);
  tete.writeUInt32LE(png.length, 14); tete.writeUInt32LE(22, 18);
  return Buffer.concat([tete, png]);
}

const navigateur = await chromium.launch();
try {
  writeFileSync('commun/nb.svg', ICONE);
  const page = await navigateur.newPage();
  for (const taille of [48, 180, 512]) {
    await page.setViewportSize({ width: taille, height: taille });
    await page.setContent(`<html><body style="margin:0">${ICONE.replace('<svg ', `<svg width="${taille}" height="${taille}" `)}</body></html>`);
    await page.screenshot({ path: `commun/nb-${taille}.png` });
  }
  writeFileSync('favicon.ico', ico(readFileSync('commun/nb-48.png'), 48));

  await page.setViewportSize({ width: 1702, height: 630 });
  await page.goto(pathToFileURL('scripts/').href);   // les polices locales se chargent depuis file://
  await page.setContent(COUVERTURE, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: 'dossiernbrunswick-cover.png' });
  console.log('images faites : commun/nb.svg, nb-48/180/512.png, favicon.ico, dossiernbrunswick-cover.png');
} finally {
  await navigateur.close();
}
