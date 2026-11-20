# DossierNBrunswick — volet Fredericton

Les décisions du conseil municipal de **Fredericton**, lues dans les procès-verbaux de la Ville.
Copie du volet Vancouver de DossierBC (même code, mêmes pages) : seuls `data/` et les lecteurs de
source changent. Ce n'est pas un site de la Ville de Fredericton et ça n'a aucun caractère officiel.

## Sources

| Page | Source | Comment on la lit |
|---|---|---|
| Décisions, Conseil, Lexique | Procès-verbaux (PDF anglais et français) sur eSCRIBE, `pub-fredericton.escribemeetings.com` | eSCRIBE est derrière Cloudflare : les PDF sont **téléchargés à la main** dans `pv-a-la-main/` |
| Décisions (séances récentes) | Ordres du jour (PDF) sur eSCRIBE, pour les séances sans procès-verbal | téléchargés à la main dans `odj-a-la-main/` |
| Près de chez moi | Portail de données ouvertes de la Ville (ArcGIS) : couches « Wards » et « Civic Addresses » | `scrapers/pres-de-chez-moi.js`, API publique, Open Government License – City of Fredericton |
| Budget | Cahier budgétaire 2025 (PDF sur fredericton.ca) | `scrapers/budget.js` le télécharge dans `budget-pdf/` |
| Membres du conseil | fredericton.ca, page Mayor and Council | `data/elus.json`, fait à la main |

Les dossiers `pv-a-la-main/`, `odj-a-la-main/` et `budget-pdf/` sont exclus de git : ces documents
de la Ville n'ont pas de licence ouverte. Martin (19 nov. 2026) : on publie, puis on demande la
permission à la Ville ; si elle refuse, le volet est retiré.

## Rafraîchir

1. Télécharger sur eSCRIBE les nouveaux *Minutes (PDF)* et *Procès-verbal (PDF)* dans `pv-a-la-main/`,
   nommés `fredericton-pv-AAAA-MM-JJ-<DocumentId>.pdf` (et `-fr.pdf` pour le français), et les
   *Agenda (PDF)* des séances sans procès-verbal dans `odj-a-la-main/`
   (`fredericton-odj-AAAA-MM-JJ-<DocumentId>.pdf`).
2. `node scrapers/votes.js` puis `node scrapers/lexique.js`.
3. `node scrapers/pres-de-chez-moi.js` (adresses) et `node scrapers/budget.js` (budget), au besoin.

## Ce que les procès-verbaux disent, et ce qu'ils ne disent pas

- Chaque résolution : titre, texte, qui propose, qui appuie, résultat.
- Les votes contre ne sont nommés que lorsque le vote est divisé (« Carried on division ») ; sinon,
  pas de décompte. Rien n'est inventé à sa place.
- Les absences viennent de la liste des présents, et ne sont comptées que pour le conseil actuel
  (assermenté le 1er juin 2026).
- Les rapports de comités, présentations, conflits d'intérêts et questions deviennent des fiches
  « information », pas des décisions.
- La Ville publie ses procès-verbaux environ trois mois après la séance : en attendant, les points de
  l'ordre du jour sont montrés, marqués « à l'ordre du jour ».
