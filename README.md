# Enchant Lab — app Minecraft (v1)

Application web mobile (HTML/CSS/JS, sans build) avec :

1. **Enchantements** : une catégorie par équipement (casque, plastron, jambières, bottes, épée, hache, pioche, pelle, houe, arc, arbalète, trident, masse, canne à pêche, élytres, cisailles). Tu coches les enchantements voulus, tu choisis leur niveau, et l'app calcule l'ordre d'enclume le moins cher.
2. **Trims d'armure** : pour chaque pièce, choix de la matière (cuir, maille, cuivre, fer, or, diamant, netherite), couleur de teinture du cuir, motif et matière de trim (11 couleurs). Rendu avec les vraies textures du jeu.

## Lancer l'app

Il faut un serveur HTTP (le rendu des trims lit les pixels, ce qui est bloqué en `file://`) :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000 (ou l'IP du PC sur le téléphone, même Wi-Fi)
```

## Structure

```
index.html            page unique, barre d'onglets
css/style.css         thème sombre, cartes façon inventaire
js/data.js            enchantements, catégories, incompatibilités, matières, motifs, couleurs
js/optimizer.js       calcul de l'ordre optimal (programmation dynamique)
js/trims.js           composition des armures (teinture + recoloration du trim)
js/app.js             interface
assets/               textures copiées du jeu (Minecraft 26.1, via PrismarineJS/minecraft-assets)
tests/optimizer.test.js   tests de l'optimiseur (node tests/optimizer.test.js)
```

## Modèle de coût utilisé (à vérifier en jeu)

- Coût d'une fusion = somme(multiplicateur de rareté × niveau) des enchantements transférés
  + pénalité de travail de la cible + pénalité de travail du sacrifié.
- Multiplicateurs : Commun ×1, Peu commun ×2, Rare ×4, Très rare ×8.
- Pénalité de travail : 0, puis `2 × max(pénalités entrantes) + 1` (suite 0, 1, 3, 7, 15…).
- L'optimiseur explore toutes les structures de fusion (y compris fusionner des objets intermédiaires) et garde la moins chère. Il ne peut pas être pire que l'ordre naïf (ajout de livres un par un).

## Limites connues — ce qui n'est PAS vérifié

- **Données d'enchantements écrites de mémoire.** Le wiki officiel (minecraft.wiki) n'était pas joignable pendant la création. Les niveaux max, raretés, applicabilités et incompatibilités sont à recouper avec le wiki.
- **Catégories marquées « à vérifier »** : hache, houe, masse, canne à pêche (listes incertaines).
- **Bouclier** : absent, car sa texture n'est pas dans le pack d'assets utilisé.
- **Règle « le plus cher en premier »** : la communauté la recommande, mais dans ce modèle l'ordre d'une simple chaîne ne change pas le coût total (seule la structure des fusions compte). Soit le modèle manque un détail (ex. un coût dépendant de l'enchantement appliqué), soit la règle communautaire vaut pour un cas précis. À tester en jeu avant de se fier à l'ordre affiché.
- **Plafond « Trop cher »** : l'app signale une étape à 40 niveaux ou plus. Certaines sources disent 39 comme dernier niveau accepté ; à confirmer.
- **Trims** : l'icône d'inventaire ne montre pas le motif (il n'existe que sur le modèle 3D). Le motif est affiché à part via son template.
- Les textures viennent de la version 26.1 du jeu ; si ton jeu est sur une autre version, les rendus peuvent légèrement différer.

## Prochaines étapes possibles

- Catégories supplémentaires (potions, livres, enchantements de table).
- Vérification des données contre le wiki une fois l'accès réseau disponible.
- Sauvegarde de configurations d'équipement.
