// Étape 0 du site du Nouveau-Brunswick : est-ce que legnb.ca nous répond honnêtement ?
//
// legnb.ca autorise tout dans son robots.txt (« User-agent: * / Disallow: » avec
// « crawl-delay: 10 »), mais le site est derrière Cloudflare. Depuis le poste de Martin,
// les pages répondent 200 sans défi. Reste à savoir si c'est aussi vrai depuis les
// serveurs de GitHub Actions, dont les adresses IP sont connues et parfois filtrées.
//
// Ce script ne contourne rien : User-Agent qui nous nomme, une requête à la fois,
// 10 secondes entre deux, exactement le délai demandé. S'il y a un défi Cloudflare,
// on le constate et on s'arrête — on ne cherche pas à passer outre.
//
//   node scripts/test-acces-legnb.js
//
// Sort en code 1 si au moins une lecture est bloquée : le workflow échoue alors,
// ce qui est le résultat qu'on veut voir plutôt qu'un succès silencieux.

const UA = 'dossiernbrunswick-scraper/0.1 (projet citoyen independant, usage non commercial; +https://dossiernbrunswick.ca)';
const DELAI_MS = 10_000; // le crawl-delay de legnb.ca

// Une URL par type de lecture dont le site aura besoin. Si l'une passe et l'autre non,
// on saura exactement quelle partie du projet tombe.
const LECTURES = [
  ['robots.txt',              'https://www.legnb.ca/robots.txt'],
  ['liste des projets (EN)',  'https://www.legnb.ca/en/legislation/bills'],
  ['liste des projets (FR)',  'https://www.legnb.ca/fr/l%C3%A9gislation/projets-de-loi'],
  ['fiche d’un projet',  'https://www.legnb.ca/en/legislation/bills/61/2/24/pay-transparency-act'],
  ['texte HTML anglais',      'https://www.legnb.ca/content/house_business/61/2/bills/Bill-24-e.htm'],
  ['texte HTML français',     'https://www.legnb.ca/content/house_business/61/2/bills/Bill-24-f.htm'],
  ['texte PDF bilingue',      'https://www.legnb.ca/content/house_business/61/2/bills/Bill-24.pdf'],
  ['Journal PDF (votes)',     'https://www.legnb.ca/content/house_business/61/2/journals/31260326e.pdf'],
  ['liste des député·e·s',    'https://www.legnb.ca/en/members/current'],
  ['Conseil exécutif',        'https://www.legnb.ca/en/members/executive-council'],
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Un 200 ne suffit pas : Cloudflare sert ses défis avec un corps de page et parfois un
// code 200. On regarde donc aussi ce qu'on a reçu.
function estUnDefi(statut, entetes, debutDuCorps) {
  if (statut === 403 || statut === 429 || statut === 503) return true;
  if (entetes.get('cf-mitigated')) return true;
  return /Just a moment|Attention Required|Checking your browser|cf-challenge|__cf_chl/i.test(debutDuCorps);
}

async function lire(nom, url) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    const octets = Buffer.from(await res.arrayBuffer());
    const debut = octets.subarray(0, 4000).toString('latin1');
    const defi = estUnDefi(res.status, res.headers, debut);
    return {
      nom, url, statut: res.status, octets: octets.length, defi,
      type: (res.headers.get('content-type') || '').split(';')[0],
      serveur: res.headers.get('server') || '',
      ms: Date.now() - t0,
    };
  } catch (err) {
    return { nom, url, statut: 0, octets: 0, defi: true, erreur: err.message, ms: Date.now() - t0 };
  }
}

async function main() {
  console.log(`Lecture de legnb.ca — ${new Date().toISOString()}`);
  console.log(`User-Agent : ${UA}`);
  console.log(`Délai entre deux requêtes : ${DELAI_MS / 1000} s (crawl-delay du site)\n`);

  const resultats = [];
  for (let i = 0; i < LECTURES.length; i++) {
    const [nom, url] = LECTURES[i];
    const r = await lire(nom, url);
    resultats.push(r);
    const verdict = r.defi ? 'BLOQUÉ' : (r.statut === 200 && r.octets > 0 ? 'ok' : `douteux (${r.statut})`);
    console.log(
      `${verdict.padEnd(8)} ${String(r.statut).padEnd(4)} ${String(r.octets).padStart(8)} o  ` +
      `${(r.type || '').padEnd(16)} ${r.nom}${r.erreur ? '  — ' + r.erreur : ''}`
    );
    if (i < LECTURES.length - 1) await dormir(DELAI_MS);
  }

  const bloques = resultats.filter((r) => r.defi);
  const vides = resultats.filter((r) => !r.defi && (r.statut !== 200 || r.octets === 0));
  console.log('');
  console.log(`Lectures réussies : ${resultats.length - bloques.length - vides.length} / ${resultats.length}`);

  if (bloques.length) {
    console.log('\nBLOQUÉ. Les lectures suivantes n\'ont pas abouti :');
    for (const r of bloques) console.log(`  - ${r.nom} → ${r.url}`);
    console.log('\nOn ne contourne pas. Deux suites possibles : écrire au greffe de l\'Assemblée');
    console.log('(legwebadmin@legnb.ca) pour demander un accès, ou rafraîchir depuis un poste');
    console.log('qui n\'est pas bloqué. Le projet ne va pas plus loin tel quel.');
    process.exitCode = 1;
    return;
  }
  if (vides.length) {
    console.log('\nPas de blocage Cloudflare, mais des réponses inattendues (adresse à revoir) :');
    for (const r of vides) console.log(`  - ${r.nom} → ${r.statut} ${r.url}`);
    process.exitCode = 1;
    return;
  }
  console.log('Aucun défi Cloudflare. Le rafraîchissement automatique est possible d\'ici.');
}

main();
