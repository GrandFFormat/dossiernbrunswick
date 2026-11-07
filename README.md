# DossierNBrunswick

Un site citoyen indépendant qui rend lisible l'Assemblée législative du Nouveau-Brunswick :
les projets de loi, leurs étapes réelles, les votes nominatifs, les élu·e·s et le Conseil
exécutif. En français et en anglais, d'égal à égal.

**Site non officiel.** La source est [legnb.ca](https://www.legnb.ca), le site de l'Assemblée
législative, et [gnb.ca](https://www.gnb.ca). La version imprimée d'un projet de loi reste la
version officielle.

## Les règles du projet

**Jamais de donnée inventée.** Chaque chiffre affiché est compté dans les fichiers de `data/`,
jamais saisi à la main. Quand une information manque, le site l'écrit plutôt que de la
deviner. Chaque scraper se contrôle contre sa source : le nombre de projets de loi lus doit
égaler le total que la page annonce, la composition de la Chambre doit égaler les « Party
Standings », et un vote nominatif n'est publié que si le nombre de noms lus égale le total
inscrit au Journal. Au moindre écart, le scraper échoue et ne publie rien.

**On ne contourne aucune protection.** `legnb.ca` autorise tout dans son `robots.txt` et
demande dix secondes entre deux requêtes : `scrapers/nb-commun.js` les respecte, une requête
à la fois. Le User-Agent nous nomme et donne une adresse où nous joindre. Les courriels des
député·e·s, que le site masque derrière la protection de Cloudflare, ne sont pas décodés.

**Aucun verdict.** Les faits sont mis côte à côte, le jugement reste au lecteur.

**Gratuit, sans publicité ni abonnement.** L'Assemblée publie ses informations pour un usage
« personal and public non-commercial » : le site s'y tient.

## Faire tourner

```bash
npm install
npm run acces      # vérifie que legnb.ca nous répond (une à deux minutes)
npm run refresh    # relit tout et reconstruit les pages (dix à quinze minutes)
npm run serveur    # http://localhost:8080
```

Le rafraîchissement est lent par construction : c'est le délai que le site demande.

| Commande | Ce qu'elle fait |
| --- | --- |
| `npm run refresh` | tous les scrapers, puis les pages |
| `npm run build` | seulement les pages, depuis `data/` |
| `npm run scrape:projets` | les projets de loi de la session en cours |
| `npm run scrape:deputes` | les 49 député·e·s |
| `npm run scrape:conseil` | le Conseil exécutif |
| `npm run scrape:calendrier` | les prochaines séances |
| `npm run scrape:votes` | les votes nominatifs, lus dans les Journaux |

`poppler-utils` (`pdftotext`) est un second lecteur de PDF, utilisé en repli : un Journal au
moins est refusé par `pdf-parse` alors que poppler le lit, et il contient deux votes.

## Ce que le Nouveau-Brunswick impose

- **Les dates ne se lisent que sur les pages anglaises.** « 11/4/2026 » vaut le 4 novembre en
  anglais et le 11 avril en français : lire les deux donnerait deux dates pour un même
  événement.
- **Le numéro d'un projet de loi n'est pas une clé** : chaque session repart à 1. La clé est
  « législature-session-numéro ».
- **Les étapes ne suivent pas toujours l'ordre** : un projet d'intérêt privé passe en comité
  avant sa deuxième lecture. Le site affiche les dates réelles, sans supposer d'ordre.
- **Les votes nominatifs sont rares.** Sur 51 projets de loi en 2025-2026, quatre seulement
  ont été adoptés par un vote nominatif. Le site écrit « adopté sans vote nominal », jamais
  « unanime ». La présidence ne vote pas : un vote ne dépasse jamais 48 voix sur 49 sièges.
- **Il n'y a pas de pétition en ligne.** Une pétition est sur papier, signée à la main, et
  déposée par un·e député·e. Les Journaux n'en donnent que le numéro, le nom du député·e et
  l'objet.
- **Les textes des projets de loi sont officiellement bilingues**, en HTML et en PDF deux
  colonnes. Aucune traduction automatique n'est nécessaire, et le site n'en fait pas.

## Le design

Le site suit son propre cahier, `design/nouveau-brunswick-2026-11/`, et non la charte des
autres sites Dossier. La forme de référence est `accueil-retenu.html`. La palette est le
tricolore du drapeau : bleu `#0033a0`, rouge `#e4002b`, jaune `#ffd100`.

## Licence

Code sous PolyForm Noncommercial 1.0.0, textes et données sous CC BY-NC 4.0. Voir
[LICENSE.md](LICENSE.md).
