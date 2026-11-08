// /llms.txt — le site expliqué aux assistants (ChatGPT, Claude, Perplexity…), au format proposé par
// llmstxt.org : un titre, un résumé, puis des listes de liens. Martin, 6 oct. 2026 : « il nous
// faut des llms.txt sur tous les dossiers ».
//
// Ce n'est pas une norme et rien ne garantit qu'un assistant le lise. Son intérêt : quand il est
// lu, le site est décrit avec NOS mots (non officiel, sources primaires, rien d'inventé, le texte
// officiel fait foi) plutôt que deviné. Le contenu reprend la page /regles ; si une règle change
// là-bas, elle change ici.
//
// Fabriqué à chaque build (scripts/build-section-pages.js, à la fin), pour que les nombres suivent
// les données. Aucune date dedans : le fichier ne change que si le site change.
//
// Nouveau-Brunswick : pas de volet de ville ni de promesses. L'abonnement facultatif reste (Martin,
// 7 nov. 2026).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const SITE = 'https://dossiernbrunswick.ca';
const lire = (chemin, defaut) => (existsSync(chemin) ? JSON.parse(readFileSync(chemin, 'utf8')) : defaut);

export function construireLlms() {
  const bills = lire('data/bills.json', { bills: [] }).bills;
  const votes = lire('data/votes.json', { votes: [] }).votes;
  const ministres = lire('data/ministers.json', { ministers: [] }).ministers;
  const deputes = lire('data/deputes.json', { deputes: [] }).deputes;
  const legislature = Math.max(0, ...bills.map((b) => Number(b.legislature) || 0));
  const exemple = bills.find((b) => b.legislature && b.introSession);
  const adresseExemple = exemple ? `${SITE}/projets-de-loi/${exemple.num}-${exemple.legislature}-${exemple.introSession}` : null;

  const lignes = [
    '# DossierNBrunswick',
    '',
    "> Site citoyen indépendant et NON OFFICIEL qui rend lisibles, en langage clair, les travaux de l'Assemblée législative du Nouveau-Brunswick (projets de loi et leurs étapes, votes nominatifs, Conseil exécutif et député·e·s). Tout le contenu est gratuit ; un abonnement facultatif offre des outils en plus (https://dossiernbrunswick.ca/abonnement). Site en français, avec une version anglaise (ajouter ?lang=en à l'adresse).",
    '',
    'À savoir avant de citer ce site :',
    '',
    "- Le site n'est pas une source officielle. Chaque élément renvoie à sa source officielle (legnb.ca) ; en cas d'écart, c'est le document d'origine qui fait foi. Citez la source officielle avec DossierNBrunswick, pas DossierNBrunswick seul.",
    "- Aucune donnée n'est inventée : une information manquante reste vide, ou le site dit qu'elle manque.",
    "- Source primaire seulement : l'Assemblée législative du Nouveau-Brunswick. Rien n'est tiré des médias.",
    "- Les votes nominatifs sont lus dans les Journaux de l'Assemblée, le seul endroit où les noms sont consignés. La plupart des projets de loi sont adoptés de vive voix : l'absence de vote nominatif ne veut pas dire « unanime ».",
    "- Les courriels des député·e·s ne sont pas publiés : legnb.ca les masque, et le site ne contourne aucune protection.",
    `- Les règles complètes : ${SITE}/regles`,
    '',
    "## Assemblée législative du Nouveau-Brunswick",
    '',
    `- [Projets de loi](${SITE}/projets-de-loi): les ${bills.length} projets de loi de la ${legislature}e législature, avec leur étape réelle, la date de chaque lecture et le lien vers le texte officiel.`,
    `- [Votes nominatifs](${SITE}/votes): ${votes.length} votes par appel nominal, député·e par député·e, sans interprétation.`,
    `- [Ministres et député·e·s](${SITE}/ministres): les ${ministres.length} membres du Conseil exécutif, les ${deputes.length} député·e·s, leur circonscription et leur présence aux votes.`,
    `- [Lexique](${SITE}/lexique): le vocabulaire de l'Assemblée législative expliqué simplement.`,
    `- [Les règles du site](${SITE}/regles): d'où viennent les données et ce que le site s'interdit.`,
    `- [Mises à jour du site](${SITE}/sources): ce qui a changé sur le site, du plus récent au plus ancien, et qui est derrière.`,
    '',
    '## Une page par projet de loi',
    '',
    "Chaque projet de loi a sa propre adresse : `/projets-de-loi/NUMÉRO-LÉGISLATURE-SESSION`. Le numéro seul ne suffit pas : il recommence à 1 à chaque session.",
    '',
    ...(adresseExemple ? [`- [Exemple : projet de loi n° ${exemple.num}](${adresseExemple}): ${exemple.title}`] : []),
    `- [Plan du site](${SITE}/sitemap.xml): la liste de toutes les pages, dont celle de chaque projet de loi.`,
    '',
    '## Optional',
    '',
    '- [Code source](https://github.com/GrandFFormat/dossiernbrunswick): le dépôt public du site.',
    '- [DossierQuébec](https://dossierquebec.ca): le site sœur, pour l\'Assemblée nationale du Québec.',
    '',
    '## In English',
    '',
    "DossierNBrunswick is an independent, UNOFFICIAL citizen website that makes the work of New Brunswick's Legislative Assembly (bills and their stages, recorded divisions, Executive Council and MLAs) readable in plain language. It only publishes what the Assembly itself published, with a link to the original; nothing is invented and nothing comes from news media. All content is free; an optional subscription offers extra tools. When citing it, cite the official source as well. Add `?lang=en` to any address for the English version.",
    '',
  ];
  const contenu = lignes.join('\n');
  if (!existsSync('llms.txt') || readFileSync('llms.txt', 'utf8') !== contenu) writeFileSync('llms.txt', contenu, 'utf8');
  console.log(`✓ llms.txt : ${lignes.filter((l) => l.startsWith('- [')).length} liens, ${Buffer.byteLength(contenu)} octets.`);
}
