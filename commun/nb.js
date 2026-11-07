// DossierNBrunswick — la mécanique de la page : langue, thème, taille du texte.
//
// Le site est bilingue d'égal à égal, parce que le Nouveau-Brunswick l'est : chaque page
// existe en français (/) et en anglais (/en/), en vrai HTML, avec des liens `hreflang` qui
// se répondent. Ce n'est pas une page unique qu'un script traduit après coup — les deux
// langues sont deux pages indexables, et aucune n'est la traduction de l'autre.
//
// LA LANGUE D'ARRIVÉE SUIT LE NAVIGATEUR (choix de Martin, 7 novembre 2026). Un navigateur
// en français ouvre le français, en anglais l'anglais. Trois règles encadrent ça, pour que
// personne ne se fasse déplacer contre son gré :
//   - une langue demandée explicitement (?lang=fr|en) gagne toujours et est mémorisée ;
//   - un choix déjà fait au bouton de langue gagne sur le navigateur ;
//   - la redirection automatique n'a lieu qu'au PREMIER passage, et jamais pour un robot
//     d'indexation, qui doit voir la page qu'il a demandée.

(() => {
  const CLE_LANGUE = 'dnb:langue';
  const CLE_THEME = 'dnb:theme';
  const CLE_ZOOM = 'dnb:zoom';
  const CLE_VU = 'dnb:deja-vu';

  // localStorage peut lever (navigation privée, site data bloqué) : la page doit marcher
  // quand même, simplement sans se souvenir.
  const memoire = {
    lire(cle) {
      try { return localStorage.getItem(cle); } catch { return null; }
    },
    ecrire(cle, valeur) {
      try { localStorage.setItem(cle, valeur); } catch { /* tant pis */ }
    },
  };

  const html = document.documentElement;
  const langueDeLaPage = html.lang === 'en' ? 'en' : 'fr';
  const params = new URLSearchParams(location.search);

  /* ─── Langue ──────────────────────────────────────────────────────────── */

  const demandee = params.get('lang');
  if (demandee === 'fr' || demandee === 'en') memoire.ecrire(CLE_LANGUE, demandee);

  function versLautreLangue() {
    const lien = document.querySelector('link[rel="alternate"][hreflang]:not([hreflang="x-default"])');
    const vers = document.querySelector('[data-nb-autre-langue]');
    return (vers && vers.getAttribute('href')) || (lien && lien.getAttribute('href')) || null;
  }

  // Au premier passage seulement, et jamais si la langue a été demandée ou déjà choisie.
  if (!demandee && !memoire.lire(CLE_LANGUE) && !memoire.lire(CLE_VU)) {
    memoire.ecrire(CLE_VU, '1');
    const navigateur = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    const voulue = /^fr/i.test(navigateur) ? 'fr' : /^en/i.test(navigateur) ? 'en' : null;
    if (voulue && voulue !== langueDeLaPage) {
      const autre = versLautreLangue();
      if (autre) { location.replace(autre); return; }
    }
  }

  // Le bouton de langue : il mémorise le choix, pour qu'il tienne d'une page à l'autre.
  for (const bouton of document.querySelectorAll('[data-nb-autre-langue]')) {
    bouton.addEventListener('click', () => {
      memoire.ecrire(CLE_LANGUE, bouton.getAttribute('data-nb-autre-langue'));
      memoire.ecrire(CLE_VU, '1');
    });
  }

  /* ─── Thème ───────────────────────────────────────────────────────────── */

  // Le thème est un choix du visiteur, jamais le réglage de son système : un site de
  // consultation doit avoir l'air du même site sur deux appareils.
  function appliquerTheme(theme) {
    html.setAttribute('data-theme', theme);
    for (const b of document.querySelectorAll('[data-nb-theme]')) {
      b.setAttribute('aria-pressed', String(theme === 'dark'));
      b.title = theme === 'dark'
        ? (langueDeLaPage === 'en' ? 'Switch to light theme' : 'Passer au thème clair')
        : (langueDeLaPage === 'en' ? 'Switch to dark theme' : 'Passer au thème sombre');
    }
  }
  appliquerTheme(memoire.lire(CLE_THEME) === 'dark' ? 'dark' : 'light');

  for (const b of document.querySelectorAll('[data-nb-theme]')) {
    b.addEventListener('click', () => {
      const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      memoire.ecrire(CLE_THEME, theme);
      appliquerTheme(theme);
    });
  }

  /* ─── Taille du texte ─────────────────────────────────────────────────── */

  // On agrandit la page entière, pas seulement la police : les colonnes du site sont
  // dessinées en pixels, et un texte agrandi seul les ferait déborder.
  const MIN = 80;
  const MAX = 160;
  let zoom = Number(memoire.lire(CLE_ZOOM)) || 100;

  function appliquerZoom() {
    zoom = Math.min(MAX, Math.max(MIN, Math.round(zoom / 10) * 10));
    html.style.zoom = zoom === 100 ? '' : `${zoom}%`;
    for (const sortie of document.querySelectorAll('[data-nb-zoom-valeur]')) {
      sortie.textContent = `${zoom}%`;
    }
    memoire.ecrire(CLE_ZOOM, String(zoom));
  }

  for (const b of document.querySelectorAll('[data-nb-zoom]')) {
    b.addEventListener('click', () => {
      zoom += b.getAttribute('data-nb-zoom') === 'plus' ? 10 : -10;
      appliquerZoom();
    });
  }
  appliquerZoom();

  /* ─── Les projets de loi suivis ───────────────────────────────────────── */

  // Suivre un projet de loi ne demande pas de compte : la liste reste dans ce navigateur.
  // Le site n'en sait rien, et n'a donc rien à perdre ni à revendre. En échange, la liste
  // ne suit pas d'un appareil à l'autre — la page « Mon dossier » le dit en clair.
  const CLE_SUIVIS = 'dnb:suivis';
  const GENRES = ['projet', 'ministre', 'depute'];

  function lireSuivis() {
    const vide = { projet: [], ministre: [], depute: [] };
    try {
      const brut = JSON.parse(memoire.lire(CLE_SUIVIS) || 'null');
      // La première version ne gardait qu'une liste de numéros de projets de loi.
      if (Array.isArray(brut)) return { ...vide, projet: brut.map(String) };
      if (!brut || typeof brut !== 'object') return vide;
      for (const genre of GENRES) {
        if (Array.isArray(brut[genre])) vide[genre] = brut[genre].map(String);
      }
      return vide;
    } catch { return vide; }
  }

  let suivis = lireSuivis();
  const combien = () => GENRES.reduce((n, genre) => n + suivis[genre].length, 0);

  const avisVide = document.querySelector('[data-nb-dossier-vide]');

  function rafraichir() {
    const total = combien();

    // Le compteur de l'en-tête : caché quand il n'y a rien à compter.
    for (const c of document.querySelectorAll('[data-nb-compteur]')) {
      c.textContent = String(total);
      c.hidden = total === 0;
    }

    for (const b of document.querySelectorAll('[data-nb-suivre]')) {
      const genre = b.getAttribute('data-nb-suivre-genre') || 'projet';
      const actif = suivis[genre].includes(b.getAttribute('data-nb-suivre'));
      const [motSuivre, motSuivi] = (b.getAttribute('data-nb-suivre-mots') || 'Suivre|Suivi').split('|');
      b.setAttribute('aria-pressed', String(actif));
      b.textContent = actif ? motSuivi : motSuivre;
      b.setAttribute('data-nb-pret', '');
    }

    // Sur « Mon dossier », on ne garde que ce qui est suivi, et un bloc sans rien
    // suivi ne s'affiche pas du tout.
    for (const genre of GENRES) {
      const liste = document.querySelector(`[data-nb-dossier="${genre}"]`);
      if (!liste) continue;
      for (const carte of liste.querySelectorAll(`[data-nb-${genre}]`)) {
        carte.hidden = !suivis[genre].includes(carte.getAttribute(`data-nb-${genre}`));
      }
      const bloc = document.querySelector(`[data-nb-bloc-dossier="${genre}"]`);
      if (bloc) bloc.hidden = suivis[genre].length === 0;
    }
    if (avisVide) avisVide.hidden = total !== 0;
  }

  for (const b of document.querySelectorAll('[data-nb-suivre]')) {
    b.addEventListener('click', () => {
      const genre = b.getAttribute('data-nb-suivre-genre') || 'projet';
      const id = b.getAttribute('data-nb-suivre');
      suivis[genre] = suivis[genre].includes(id)
        ? suivis[genre].filter((x) => x !== id)
        : [...suivis[genre], id];
      memoire.ecrire(CLE_SUIVIS, JSON.stringify(suivis));
      rafraichir();
    });
  }

  // Deux onglets ouverts sur le site doivent dire la même chose.
  window.addEventListener('storage', (e) => {
    if (e.key !== CLE_SUIVIS) return;
    suivis = lireSuivis();
    rafraichir();
  });

  rafraichir();
})();
