# Courses de la maison

Petite appli web (sans installation, sans compte) pour la liste de courses et le stock de la maison :
ce qu'il reste à la maison à côté de chaque article, et l'ajout au stock en photographiant le ticket.

Elle parle à un script Google Apps Script personnel. **Ce dépôt ne contient aucun secret** : au
premier lancement, chaque téléphone saisit l'adresse du script, la clé de la maison et un prénom,
gardés uniquement dans le stockage local du téléphone (écran Réglages ⚙ pour les changer).

## Installer sur un téléphone
Ouvrir https://thomas-dev000.github.io/courses-maison/ puis :
- iPhone (Safari) : Partager > « Sur l'écran d'accueil » ;
- Android (Chrome) : menu ⋮ > « Ajouter à l'écran d'accueil ».

## Utiliser
- **Liste** : taper un article, avec si besoin la quantité et l'unité à la fin : « Lait 3L »,
  « Pâtes 1,5kg », « Viande 500g », « Mouchoirs 2 paquets », « Œufs x12 ». Toucher pour cocher,
  appui long pour supprimer. Hors réseau, les changements attendent et partent au retour du réseau.
- **Stock** : « − » retire 1 (paquets et unités) ; toucher un produit pour taper sa nouvelle
  quantité et son unité (litres, kilos, paquets, unités).
- **Ticket** : photographier le ticket ; vérifier les produits lus, préciser les quantités
  signalées, puis « Ajouter au stock » (les articles achetés sont rayés de la liste).

## Développer
- Fichiers statiques (HTML, CSS, modules JavaScript), publiés tels quels par GitHub Pages.
- Logique pure dans `logique.js`, testée par `node --test` (Node 20 ou plus).
- Icônes : `python3 outils/icones.py` (même dessin que `icones/icone.svg`).
- Après une modification, changer `VERSION` dans `sw.js` pour que les téléphones la récupèrent.
