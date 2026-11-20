// « Près de chez moi » à Fredericton (N.-B.) : les 12 quartiers et l'index des adresses.
//
//   node scrapers/pres-de-chez-moi.js
//
// Copie de dossierBC/vancouver/scrapers/pres-de-chez-moi.js, source changée. Même sortie, même forme :
// data/quartiers.json, data/adresses/<lettre>.json + index.json. La page cherche dans le navigateur ;
// aucune adresse tapée par un visiteur n'est envoyée nulle part.
//
// SOURCES (portail de données ouvertes de la Ville, lu le 19 nov. 2026 par Hugette) :
//   « Wards » (12 quartiers, avec le nom du conseiller) et « Civic Addresses » (25 124 adresses, avec
//   le numéro de quartier déjà attaché : pas de point dans polygone à faire).
// LICENCE : Open Government License – City of Fredericton 1.0, usage commercial permis, mention
// obligatoire (ATTRIBUTION_ADRESSES ci-dessous).
//
// CE QUI MANQUE PAR RAPPORT À VANCOUVER : la Ville ne publie ni permis de construction ni chantiers en
// données ouvertes. index.json porte « permis: false » et la page le dit au lieu d'afficher des listes vides.

import { mkdir, writeFile, rename, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { USER_AGENT } from '../lib/fre.js';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));

const SERVICE = 'https://services2.arcgis.com/iLWAxhpxafhOza2U/arcgis/rest/services/';
const COUCHE_QUARTIERS = `${SERVICE}Wards/FeatureServer/80`;
const COUCHE_ADRESSES = `${SERVICE}Civic_Addresses/FeatureServer/16`;
const PORTAIL = 'https://data-fredericton.opendata.arcgis.com/';
const LICENCE = 'Open Government License – City of Fredericton 1.0';
const LICENCE_URL = 'https://data-fredericton.opendata.arcgis.com/pages/open-data-license';
const ATTRIBUTION = 'Contains information licensed under the Open Government License – City of Fredericton.';

const ecrire = async (chemin, objet) => { await writeFile(`${chemin}.tmp`, JSON.stringify(objet), 'utf8'); await rename(`${chemin}.tmp`, chemin); };
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
async function requete(couche, params) {
  const u = `${couche}/query?${new URLSearchParams({ f: 'json', ...params })}`;
  const r = await fetch(u, { headers: { 'User-Agent': USER_AGENT } });
  if (!r.ok) throw new Error(`${r.status} sur ${u}`);
  const j = await r.json();
  if (j.error) throw new Error(`${j.error.message} sur ${u}`);
  return j;
}
await mkdir('data', { recursive: true });

// ---------- 1. Les 12 quartiers ----------
const jq = await requete(COUCHE_QUARTIERS, { where: '1=1', outFields: 'Ward_Num,WardNames,Councillor', outSR: '4326', geometryPrecision: '5', maxAllowableOffset: '0.0002' });
const quartiers = jq.features
  .map((f) => ({
    numero: f.attributes.Ward_Num,
    nom: `Ward ${f.attributes.Ward_Num} – ${String(f.attributes.WardNames).replace(/^\d+\s*-\s*/, '').replace(/\s+/g, ' ').trim()}`,
    conseiller: String(f.attributes.Councillor ?? '').trim() || null,
    anneaux: f.geometry?.rings ?? [],
  }))
  .sort((a, b) => a.numero - b.numero);
if (quartiers.length !== 12) console.warn(`⚠ ${quartiers.length} quartiers au lieu de 12.`);
const noms = quartiers.map((q) => q.nom);
const rangDe = new Map(quartiers.map((q, i) => [q.numero, i]));
await ecrire('data/quartiers.json', {
  source: COUCHE_QUARTIERS, portail: PORTAIL, licence: LICENCE, licenceUrl: LICENCE_URL, attribution: ATTRIBUTION,
  extraction: new Date().toISOString(), nombre: quartiers.length, quartiers,
});
console.log(`Quartiers : ${quartiers.length}.`);

// ---------- 2. Les adresses ----------
// Même clé de recherche que la page : « Alison Boulevard » et « alison blvd » donnent « ALISON BLVD ».
const cleVoie = (nom) => String(nom ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Z0-9]+/g, ' ').trim()
  .replace(/\bAVENUE\b/g, 'AV').replace(/\bAVE\b/g, 'AV').replace(/\bSTREET\b/g, 'ST').replace(/\bDRIVE\b/g, 'DR').replace(/\bROAD\b/g, 'RD')
  .replace(/\bBOULEVARD\b/g, 'BLVD').replace(/\bPLACE\b/g, 'PL').replace(/\bCRESCENT\b/g, 'CRES').replace(/\bCOURT\b/g, 'CRT').replace(/\bLANE\b/g, 'LANE')
  .replace(/\bHIGHWAY\b/g, 'HWY').replace(/\bWEST\b/g, 'W').replace(/\bEAST\b/g, 'E').replace(/\bNORTH\b/g, 'N').replace(/\bSOUTH\b/g, 'S')
  .replace(/\s+/g, ' ');
const { count } = await requete(COUCHE_ADRESSES, { where: '1=1', returnCountOnly: 'true' });
const PAGE = 2000;
const parLettre = {};
let n = 0, hors = 0, lues = 0;
for (let offset = 0; offset < count; offset += PAGE) {
  const j = await requete(COUCHE_ADRESSES, { where: '1=1', outFields: 'Nbr,Street_Nam,English_Ty,Ward,Latitude,Longitude', returnGeometry: 'false', orderByFields: 'OBJECTID', resultOffset: String(offset), resultRecordCount: String(PAGE) });
  for (const { attributes: a } of j.features) {
    lues++;
    const numero = Number(a.Nbr);
    const rue = [a.Street_Nam, a.English_Ty].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (!numero || !rue) continue;
    const qi = rangDe.get(Number(a.Ward)) ?? -1;
    if (qi < 0) { hors++; continue; }
    const cle = cleVoie(rue);
    const lettre = (cle[0] || '_').replace(/[^A-Z0-9]/, '_');
    const voie = ((parLettre[lettre] ||= {})[cle] ||= [rue, []]);
    const p = a.Latitude && a.Longitude ? [+Number(a.Latitude).toFixed(5), +Number(a.Longitude).toFixed(5)] : [];
    voie[1].push([numero, numero, qi, ...p]);
    n++;
  }
  await pause(500);   // on ne se presse pas
}
await rm('data/adresses', { recursive: true, force: true });
await mkdir('data/adresses', { recursive: true });
for (const [lettre, voies] of Object.entries(parLettre)) {
  for (const v of Object.values(voies)) v[1].sort((a, b) => a[0] - b[0]);
  await ecrire(`data/adresses/${lettre}.json`, voies);
}
await ecrire('data/adresses/index.json', {
  source: `${COUCHE_ADRESSES} et ${COUCHE_QUARTIERS}`, portail: PORTAIL, licence: LICENCE, licenceUrl: LICENCE_URL, attribution: ATTRIBUTION,
  extraction: new Date().toISOString(), adresses: n, horsQuartier: hors, quartiers: noms,
  conseillers: quartiers.map((q) => q.conseiller),
  permis: false,   // N.-B. : ni permis ni chantiers publiés par la Ville
});
console.log(`Adresses : ${n} placées sur ${lues} lues (${hors} sans quartier), ${Object.keys(parLettre).length} fichiers.`);
