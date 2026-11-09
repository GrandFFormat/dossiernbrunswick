// N.-B. (8 nov. 2026) : ce que chaque script de pages laisse à scripts/build-en.js pour fabriquer
// la version anglaise de SA page (titre, description, contenu écrit dans le HTML). Clé : le fichier
// français (« projets-de-loi/14-61-3.html »). Une page absente de ce registre est traduite avec ce
// que build-en.js sait faire seul (les data-i18n, les .fr-txt / .en-txt).
//
//   title, desc     le <title> et la description anglais ;
//   blocs           { sélecteur CSS : HTML anglais } à poser à la place du bloc français ;
//   ld              les données structurées anglaises (objet), si la page en a de propres.
export const PAGES_EN = new Map();
