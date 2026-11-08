// Scraper — les courriels des député·e·s, au format de DossierQuébec (data/deputes-contacts.json).
//
// LE NOUVEAU-BRUNSWICK NE LES DONNE PAS EN CLAIR. Sur legnb.ca, chaque fiche affiche
// « [email protected] » : l'adresse est brouillée par la protection anti-collecte de Cloudflare
// (data-cfemail) et seul le navigateur du visiteur la décode. La décoder ici, ce serait
// contourner une protection voulue par l'Assemblée : on ne le fait pas.
//
// Ce fichier écrit donc la liste des député·e·s sans courriel (email: null) et le dit. La page
// n'affiche alors aucun bouton ✉ : le lecteur passe par la fiche officielle, qui reste liée.
// Aucune requête : tout vient de data/deputes.json.

import { readFileSync, writeFileSync } from 'node:fs';

const { deputes, source } = JSON.parse(readFileSync('data/deputes.json', 'utf-8'));
const contacts = deputes.map((d) => ({ name: d.name, email: null, fiche: d.fiche }));

writeFileSync('data/deputes-contacts.json', JSON.stringify({
  source,
  scrapedAt: new Date().toISOString(),
  note: 'Courriels non publiés ici : legnb.ca les masque derrière la protection anti-collecte de Cloudflare, et on ne la contourne pas. Chaque député·e garde le lien vers sa fiche officielle.',
  count: contacts.length,
  contacts,
}, null, 2) + '\n');
console.log(`${contacts.length} député·e·s écrit·e·s dans data/deputes-contacts.json, sans courriel (masqués par legnb.ca)`);
