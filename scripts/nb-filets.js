// Les traits de DossierQuébec, affinés pour le Nouveau-Brunswick.
//
// DQ trace ses cartes, boutons et bandes en traits noirs épais (2 et 3 px, var(--ink) ou
// var(--line)). Le design du N.-B. n'a que des filets fins et pâles. Plutôt que de recopier
// ces ~200 déclarations à la main dans nb.css (et de les rater au prochain correctif de DQ),
// ce script les lit dans commun/dq.css et écrit, pour chacune, la même règle avec un trait
// de 1 px couleur filet. Le résultat va entre les deux marqueurs « FILETS » de commun/nb.css.
//
// Seuls la largeur et la couleur changent, et seulement sur les côtés que DQ a tracés : un
// élément sans bordure n'en reçoit pas. Les règles gardent leur @media d'origine.
//
// À relancer après chaque copie de dq.css depuis DossierQuébec :  node scripts/nb-filets.js

import { readFileSync, writeFileSync } from 'node:fs';

const DQ = 'commun/dq.css';
const NB = 'commun/nb.css';
const DEBUT = '/* ==== FILETS : début (généré par scripts/nb-filets.js, ne pas modifier à la main) ==== */';
const FIN = '/* ==== FILETS : fin ==== */';

const css = readFileSync(DQ, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

// Une déclaration de trait noir : border, border-top, border-block, etc.
const TRAIT = /^(border(?:-(?:top|right|bottom|left|block|inline|block-start|block-end|inline-start|inline-end))?)\s*:\s*([\d.]+)px\s+solid\s+(?:var\(--(?:ink|line)\)|#131313)\s*(!important)?$/;
// Une ombre dure, décalée, sans flou (« 4px 4px 0 #131313 ») : elle devient l'ombre douce.
const OMBRE = /^box-shadow\s*:\s*-?[\d.]+px\s+-?[\d.]+px\s+0\s+(?:var\(--ink\)|#131313|#000|#000000)\s*(!important)?$/;

// Parcourt la feuille en gardant la pile des @media / @supports ouverts.
const sorties = [];
let i = 0;
function lireBloc(contexte) {
  while (i < css.length) {
    const ouvre = css.indexOf('{', i);
    const ferme = css.indexOf('}', i);
    if (ferme !== -1 && (ouvre === -1 || ferme < ouvre)) { i = ferme + 1; return; }
    if (ouvre === -1) { i = css.length; return; }
    const tete = css.slice(i, ouvre).trim();
    i = ouvre + 1;
    if (tete.startsWith('@media') || tete.startsWith('@supports')) {
      lireBloc([...contexte, tete]);
      continue;
    }
    if (tete.startsWith('@')) {   // @keyframes, @font-face : on saute le bloc entier
      let profondeur = 1;
      while (profondeur && i < css.length) {
        if (css[i] === '{') profondeur++;
        else if (css[i] === '}') profondeur--;
        i++;
      }
      continue;
    }
    const fin = css.indexOf('}', i);
    const corps = css.slice(i, fin);
    i = fin + 1;
    const decls = [];
    for (const d of corps.split(';')) {
      const o = d.trim().match(OMBRE);
      if (o) { decls.push(`box-shadow:var(--shadow)${o[1] ? ' !important' : ''};`); continue; }
      const m = d.trim().match(TRAIT);
      if (!m || Number(m[2]) < 2) continue;
      const imp = m[3] ? ' !important' : '';
      decls.push(`${m[1]}-width:1px${imp}; ${m[1]}-color:var(--nb-filet)${imp};`);
    }
    if (decls.length) sorties.push({ contexte, regle: `${tete.replace(/\s+/g, ' ')}{${decls.join(' ')}}` });
  }
}
lireBloc([]);

const lignes = sorties.map(({ contexte, regle }) =>
  contexte.reduceRight((dedans, at) => `${at}{ ${dedans} }`, regle));
const bloc = `${DEBUT}\n${lignes.join('\n')}\n${FIN}`;

const nb = readFileSync(NB, 'utf8');
const a = nb.indexOf(DEBUT);
const b = nb.indexOf(FIN);
if (a === -1 || b === -1) throw new Error(`Marqueurs FILETS introuvables dans ${NB}`);
writeFileSync(NB, nb.slice(0, a) + bloc + nb.slice(b + FIN.length));
console.log(`${sorties.length} règles de trait affinées dans ${NB}`);
