// Scraper — les résumés en langage clair des projets de loi.
//
// CE QUE FAIT CE SCRIPT. Pour chaque projet de loi, il lit le TEXTE OFFICIEL publié par
// l'Assemblée et demande à Claude d'en tirer trois à sept puces en langage courant. Une
// fois PAR LANGUE, à partir du texte officiel DE CETTE LANGUE — le Nouveau-Brunswick
// publie ses lois en français et en anglais, les deux font également foi, et traduire une
// traduction ajouterait une couche d'erreur pour rien.
//
// CE QUE LE RÉSUMÉ N'EST PAS : une donnée officielle. Il est marqué, daté, le modèle est
// nommé, et la fiche renvoie toujours au texte de l'Assemblée. La consigne interdit
// d'ajouter quoi que ce soit d'absent du texte, de juger, et de meubler un projet purement
// procédural — dans ce cas le modèle lève « sansContenu » et on n'affiche rien plutôt
// qu'une phrase creuse.
//
// LES QUATRE RÈGLES DE LA FAMILLE (guide « Reproduire DossierQuébec pour une autre
// province », étape 8), appliquées ici :
//   1. résumer depuis le texte officiel de la langue visée, jamais une traduction ;
//   2. dire quand le texte a été tronqué, et le dire SUR LA FICHE ;
//   3. relire dix résumés à la main avant de publier les autres ;
//   4. un omnibus se résume section par section, depuis son sommaire — jamais depuis un
//      texte tronqué. Au N.-B., aucun projet n'est publié comme omnibus : si un texte
//      dépasse le plafond, on le dit plutôt que de faire semblant.
//
// L'ARGENT. Rien n'est jamais repayé : l'empreinte d'un résumé porte le numéro du projet,
// la session, le modèle, la version de la consigne et l'empreinte du texte source. Changer
// la consigne ne refait que ce qui en dépend. `--dry-run` chiffre le travail sans dépenser.
//
// CLÉ : ANTHROPIC_API_KEY, prise dans l'environnement ou dans api.env — jamais dans le
// dépôt, api.env est ignoré par git.
//
// Usage :
//   node scrapers/nb-resumes.js --dry-run       ce que ça coûterait, sans rien dépenser
//   node scrapers/nb-resumes.js --limit 2       un petit lot pour relire à la main
//   node scrapers/nb-resumes.js                 tout ce qui manque
//   node scrapers/nb-resumes.js --langue fr     une seule langue

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import Anthropic from '@anthropic-ai/sdk';
import { lire, ecrireJson } from './nb-commun.js';

const SOURCE = 'data/projets-de-loi.json';
const SORTIE = 'data/resumes.json';
const CACHE_TEXTES = 'data/textes';

const MODELE = 'claude-sonnet-5';
const VERSION_CONSIGNE = 1;        // à incrémenter quand la consigne change
const MAX_SIGNES = 60000;
const MAX_PUCES = 7;
// Assez large pour que la réponse ne soit jamais coupée au milieu d'une puce : une
// réponse tronquée revient en texte illisible plutôt qu'en tableau.
const MAX_JETONS_SORTIE = 1200;

// Tarif du modèle, en dollars US par million de jetons. Il ne sert qu'à estimer AVANT de
// dépenser ; le coût imprimé à la fin vient des jetons que l'API déclare.
const TARIF = { entree: 3, sortie: 15 };

/* ─── Les consignes ───────────────────────────────────────────────────────── */

// ⚠️ LA LANGUE DE SORTIE S'ÉCRIT, et elle s'écrit AUSSI dans le schéma de l'outil : c'est
// le dernier texte que le modèle lit avant de répondre. En Ontario, l'oublier a fait
// revenir les premiers résumés anglais en français.
const CONSIGNES = {
  fr: `Rédige chaque puce en FRANÇAIS, quelle que soit la langue du texte fourni.

Tu rédiges des résumés en langage clair de projets de loi de l'Assemblée législative du Nouveau-Brunswick pour un site citoyen indépendant, destinés à des lecteurs pressés ou qui ont de la difficulté avec les longs blocs de texte.

Format :
- Entre 3 et ${MAX_PUCES} puces. Jamais plus de ${MAX_PUCES}, même pour un projet complexe : garde celles qui comptent le plus pour le public et laisse tomber le reste.
- Une seule idée concrète par puce, des mots ordinaires, une quinzaine de mots au maximum.
- Pas d'introduction, pas de conclusion, pas de titre — seulement les puces.

Sur le fond :
- Résume UNIQUEMENT ce que le texte fourni dit vraiment. N'invente rien, ne déduis rien, n'ajoute rien qui vienne de tes connaissances.
- Reste neutre : aucun jugement de valeur (bon/mauvais, attendu/controversé), aucune opinion, aucun verdict sur quiconque.
- Ne décris pas le processus législatif (lectures, comité, sanction royale) — le site le montre déjà ailleurs. Dis ce que le projet FAIT.
- Privilégie les changements concrets qui touchent les gens — montants, obligations, interdictions, nouveaux organismes, dates — plutôt que la mécanique juridique.
- Ne recalcule et n'arrondis jamais un chiffre : recopie-le tel que le texte le donne.
- Si le texte est procédural, trop court ou trop technique pour être résumé honnêtement, mets sansContenu à vrai et ne renvoie aucune puce. C'est une réponse valable, et meilleure qu'un remplissage.`,

  en: `Write every bullet in ENGLISH, whatever language this instruction reaches you in.

You write plain-language summaries of bills of the Legislative Assembly of New Brunswick for an independent citizen website, for readers in a hurry or who struggle with long blocks of text.

Format:
- Between 3 and ${MAX_PUCES} bullets. Never more than ${MAX_PUCES}, however complex the bill: keep the ones that matter most to the public and drop the rest.
- One concrete idea per bullet, ordinary words, about fifteen words maximum.
- No introduction, no conclusion, no heading — bullets only.

Substance:
- Summarise ONLY what the supplied text actually says. Never invent, never infer, never add context from your own knowledge.
- Stay neutral: no value judgement (good/bad, welcome/controversial), no opinion, no verdict on anyone.
- Do not describe the legislative process (readings, committee, royal assent) — the site already shows that elsewhere. Say what the bill DOES.
- Prefer concrete changes that reach people — amounts, obligations, prohibitions, new bodies, dates — over legal machinery.
- Never recompute or round a figure: copy it as the text gives it.
- If the text is procedural, too short or too technical to summarise honestly, set sansContenu to true and return no bullets. That is a valid answer, and a better one than padding.`,
};

const outil = (langue) => {
  const fr = langue === 'fr';
  return {
    name: 'resume',
    description: fr
      ? 'Rend le résumé du projet de loi en puces, rédigé en français.'
      : 'Returns the bill summary as bullets, written in English.',
    input_schema: {
      type: 'object',
      properties: {
        puces: {
          type: 'array',
          items: { type: 'string' },
          maxItems: MAX_PUCES,
          description: fr ? 'Les puces, EN FRANÇAIS.' : 'The bullets, IN ENGLISH.',
        },
        sansContenu: {
          type: 'boolean',
          description: fr
            ? 'Vrai si le texte ne permet pas un résumé honnête (procédural, trop court, trop technique).'
            : 'True if the text does not allow an honest summary (procedural, too short, too technical).',
        },
      },
      required: ['puces', 'sansContenu'],
    },
  };
};

/* ─── Le texte officiel ───────────────────────────────────────────────────── */

const empreinte = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16);

/**
 * Le texte officiel d'un projet, dans une langue. Gardé en cache sur disque : on ne
 * redemande jamais deux fois le même document à l'Assemblée.
 */
async function texteOfficiel(projet, langue) {
  const url = langue === 'fr' ? projet.documents?.htmlFr : projet.documents?.htmlEn;
  if (!url) return null;

  mkdirSync(CACHE_TEXTES, { recursive: true });
  const chemin = `${CACHE_TEXTES}/${projet.numero}-${langue}.txt`;
  if (existsSync(chemin)) return readFileSync(chemin, 'utf8');

  const html = await lire(url);
  const $ = load(html);
  $('script, style, nav, header, footer').remove();
  const brut = ($('body').text() || '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  writeFileSync(chemin, brut, 'utf8');
  return brut;
}

/* ─── Le travail ──────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const aDrapeau = (nom) => args.includes(`--${nom}`);
const valeur = (nom) => {
  const i = args.indexOf(`--${nom}`);
  return i >= 0 ? args[i + 1] : null;
};

async function main() {
  const projetsFichier = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const langues = valeur('langue') ? [valeur('langue')] : ['fr', 'en'];
  const limite = Number(valeur('limit')) || Infinity;
  const essai = aDrapeau('dry-run');

  const deja = existsSync(SORTIE) ? JSON.parse(readFileSync(SORTIE, 'utf8')) : { resumes: {} };
  const resumes = deja.resumes || {};

  console.log(`Résumés en langage clair — session ${projetsFichier.legislature}-${projetsFichier.session}`);
  console.log(`modèle ${MODELE}, consigne v${VERSION_CONSIGNE}${essai ? ' — ESSAI, rien ne sera dépensé' : ''}`);

  const aFaire = [];
  for (const projet of projetsFichier.projets) {
    for (const langue of langues) {
      const texte = await texteOfficiel(projet, langue);
      if (!texte) {
        console.log(`  projet ${projet.numero} (${langue}) — aucun texte officiel publié`);
        continue;
      }
      const tronque = texte.length > MAX_SIGNES;
      const envoye = tronque ? texte.slice(0, MAX_SIGNES) : texte;
      const cle = `${projet.numero}-${langue}`;
      const signature = `${MODELE}|v${VERSION_CONSIGNE}|${empreinte(envoye)}`;
      if (resumes[cle]?.signature === signature) continue;   // déjà fait, rien à repayer
      aFaire.push({ projet, langue, cle, texte: envoye, tronque, signature, signes: texte.length });
    }
  }

  if (!aFaire.length) {
    console.log('\nTout est à jour : aucun résumé à refaire.');
    return;
  }

  // L'estimation, avant de dépenser. Un signe ≈ 0,25 jeton en français comme en anglais.
  const jetonsEntree = aFaire.reduce((n, x) => n + Math.ceil(x.texte.length / 4) + 400, 0);
  const jetonsSortie = aFaire.length * MAX_JETONS_SORTIE;
  const cout = (jetonsEntree / 1e6) * TARIF.entree + (jetonsSortie / 1e6) * TARIF.sortie;
  console.log(`\n${aFaire.length} résumés à faire`);
  console.log(`  textes : médiane ${mediane(aFaire.map((x) => x.signes))} signes, `
    + `le plus long ${Math.max(...aFaire.map((x) => x.signes))}, `
    + `${aFaire.filter((x) => x.tronque).length} tronqué(s) au-delà de ${MAX_SIGNES}`);
  console.log(`  estimation : ${cout.toFixed(2)} $ US au plein tarif`);

  if (essai) {
    console.log('\nEssai : rien n\'a été appelé, rien n\'a été écrit.');
    return;
  }

  const cle = process.env.ANTHROPIC_API_KEY || cleDepuisFichier();
  if (!cle) throw new Error('ANTHROPIC_API_KEY manque — ni dans l\'environnement, ni dans api.env.');
  const anthropic = new Anthropic({ apiKey: cle });

  let faits = 0;
  let coutReel = 0;
  for (const x of aFaire.slice(0, limite)) {
    const consigne = CONSIGNES[x.langue];
    const entete = x.tronque
      ? (x.langue === 'fr'
        ? `\n\nATTENTION : le texte ci-dessous a été TRONQUÉ à ${MAX_SIGNES} signes. Résume ce que tu lis, sans prétendre couvrir le reste.`
        : `\n\nWARNING: the text below was TRUNCATED at ${MAX_SIGNES} characters. Summarise what you read, without pretending to cover the rest.`)
      : '';

    const reponse = await anthropic.messages.create({
      model: MODELE,
      max_tokens: MAX_JETONS_SORTIE,
      system: consigne + entete,
      tools: [outil(x.langue)],
      tool_choice: { type: 'tool', name: 'resume' },
      messages: [{ role: 'user', content: x.texte }],
    });

    const sortie = reponse.content.find((c) => c.type === 'tool_use')?.input;
    if (!sortie) throw new Error(`projet ${x.projet.numero} (${x.langue}) : le modèle n'a pas répondu par l'outil.`);

    // Le schéma annonce un TABLEAU de puces, mais le modèle rend parfois ce tableau
    // sérialisé en texte (vu sur le projet 11 en français, le 7 nov. 2026). Sans ce
    // contrôle, la page affichait un seul pavé de 874 caractères à la place des puces.
    sortie.puces = normaliserPuces(sortie.puces, x);

    const u = reponse.usage;
    coutReel += (u.input_tokens / 1e6) * TARIF.entree + (u.output_tokens / 1e6) * TARIF.sortie;

    resumes[x.cle] = {
      numero: x.projet.numero,
      langue: x.langue,
      puces: sortie.sansContenu ? [] : (sortie.puces || []),
      sansContenu: !!sortie.sansContenu,
      tronque: x.tronque,
      signature: x.signature,
      modele: MODELE,
      faitLe: new Date().toISOString(),
    };
    faits += 1;
    const etat = sortie.sansContenu ? 'sans contenu à résumer' : `${resumes[x.cle].puces.length} puces`;
    console.log(`  ${x.projet.numero} (${x.langue}) — ${etat}${x.tronque ? ', texte tronqué' : ''}`);
  }

  ecrireJson(SORTIE, {
    luLe: new Date().toISOString(),
    modele: MODELE,
    versionConsigne: VERSION_CONSIGNE,
    legislature: projetsFichier.legislature,
    session: projetsFichier.session,
    avis: 'Résumés écrits par un modèle de langage à partir du texte officiel de l\'Assemblée. Ils ne sont pas officiels.',
    resumes,
  });
  console.log(`\n${faits} résumés écrits, ${coutReel.toFixed(2)} $ US réellement dépensés.`);
}

/**
 * Les puces, telles qu'on accepte de les publier : un tableau de phrases, pas plus que le
 * maximum annoncé. Tout le reste est refusé plutôt que rendu de travers.
 */
function normaliserPuces(brut, x) {
  let puces = brut;
  if (typeof puces === 'string') {
    // Le modèle sérialise parfois le tableau en texte. Quand la réponse a été coupée, ce
    // texte n'est plus du JSON valide : on récupère alors les phrases entre guillemets
    // plutôt que de publier un pavé d'un kilo-octet comme s'il s'agissait d'une puce.
    try {
      puces = JSON.parse(puces);
    } catch {
      puces = [...puces.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
    }
  }
  if (!Array.isArray(puces) || !puces.length) {
    throw new Error(`projet ${x.projet.numero} (${x.langue}) : le modèle n'a pas rendu un tableau de puces lisible.`);
  }
  puces = puces.map((p) => String(p).trim()).filter(Boolean);
  if (puces.length > MAX_PUCES) {
    throw new Error(`projet ${x.projet.numero} (${x.langue}) : ${puces.length} puces rendues, le maximum est ${MAX_PUCES}.`);
  }
  // Une puce fait « une quinzaine de mots » : au-delà de 300 signes, ce n'est plus une
  // puce, c'est une réponse mal formée qu'on refuse de publier.
  const trop = puces.find((p) => p.length > 300);
  if (trop) {
    throw new Error(`projet ${x.projet.numero} (${x.langue}) : une puce fait ${trop.length} signes — réponse mal formée, rien n'est publié.`);
  }
  return puces;
}

function mediane(xs) {
  const t = [...xs].sort((a, b) => a - b);
  return t.length % 2 ? t[(t.length - 1) / 2] : Math.round((t[t.length / 2 - 1] + t[t.length / 2]) / 2);
}

function cleDepuisFichier() {
  if (!existsSync('api.env')) return null;
  const m = readFileSync('api.env', 'utf8').match(/^ANTHROPIC_API_KEY\s*=\s*(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null;
}

main().catch((e) => { console.error(e.message); process.exit(1); });
