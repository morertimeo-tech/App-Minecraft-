# Grimoire — guide de poche pour Minecraft Java

Application web mobile (HTML/CSS/JS, sans build) avec :

0. **Accueil** : page d'ouverture avec une recherche globale (enchantement, équipement, structure, objet de butin, échange, minerai) qui mène directement au bon écran, des raccourcis vers chaque section et une astuce du jour.
1. **Enchantements** : une catégorie par équipement (casque, plastron, jambières, bottes, épée, lance, masse, hache, pioche, pelle, houe, arc, arbalète, trident, canne à pêche, élytres, cisailles). Tu coches les enchantements voulus, tu choisis leur niveau, et l'app calcule l'ordre d'enclume le moins cher.
2. **Trims d'armure** : pour chaque pièce, choix de la matière (cuir, maille, cuivre, fer, or, diamant, netherite), couleur de teinture du cuir, motif et matière de trim (11 couleurs). Rendu avec les vraies textures du jeu, dont un **porte-armure 3D** (glisse pour tourner) qui montre les motifs de trim comme en jeu.

3. **Minerais** : meilleur niveau Y et plage de génération de chaque minerai (Overworld et Nether).
4. **Structures** : 23 structures (village, cité antique, bastion, cité de l'End…) avec biomes, commande `/locate` et butins possibles par coffre (929 lignes, chance de trouver chaque objet). La recherche répond aussi à « où trouver tel objet ».
5. **Graine** : entre une graine (nombre ou texte, converti comme dans le jeu), une version Java (1.12 à 1.21.4+), une dimension et des coordonnées : l'app **génère la carte dans ton téléphone** — biomes (avec leur part dans la zone), villages et 20 autres types de structures, forteresses (strongholds), point d'apparition, chunks à slimes — avec zoom, déplacement au doigt et lecture du biome / des coordonnées en touchant. Chaque structure et chaque biome a une petite icône (texture représentative du jeu, générée par `tools/build_map_icons.py`). Déplacement au doigt en direct (la carte est pré-générée par tuiles bien au-delà de l'écran et continue de se générer en arrière-plan dans le sens du déplacement) ; zoom avec les boutons +/− ou la molette (5 niveaux, de 160 à 41 000 blocs). Fonctionne hors-ligne une fois l'app chargée. Graines enregistrables, convertisseur de coordonnées, lien Chunkbase pour comparer.
6. **Fermes** : une liste de fermes à construire (33, classées par catégorie) avec, pour chacune, **tes builds** : des liens de vidéos YouTube que tu ajoutes toi-même, lisibles directement dans l'app (lecteur intégré, connexion requise).
7. **Échanges** : tous les échanges des 13 professions de villageois et du colporteur (283 échanges, par niveau), avec recherche d'un objet dans toutes les professions.

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
js/stand.js           porte-armure 3D (three.js, dans vendor/)
js/trades-data.js     échanges des villageois (généré, ne pas éditer à la main)
js/structures-data.js structures et butins (généré)
assets/jobsites, assets/villagers  photos du bloc de métier et du villageois en tenue (générées par tools/render_art.js)
js/farms-data.js      liste des fermes (généré par tools/build_farms.py)
js/builds-data.js     tes liens de vidéos par ferme (à éditer)
js/video.js           reconnaissance et sécurisation des liens vidéo
js/seed.js            graine, chunks à slimes, coordonnées et lien Chunkbase
js/world.js           chargeur du générateur de monde (biomes, structures) + noms français
assets/world.wasm     générateur de monde (cubiomes compilé en WebAssembly)
tools/wasm/           sources, shim libc et build.sh du générateur (clang + wasm-ld)
tools/                scripts qui extraient les échanges du wiki et génèrent js/trades-data.js
js/app.js             interface
assets/               textures copiées du jeu (Minecraft 26.1, via PrismarineJS/minecraft-assets)
tests/optimizer.test.js   tests de l'optimiseur (node tests/optimizer.test.js)
```

## Règles de coût (Java Edition) — source : minecraft.wiki, « Anvil mechanics »

- Coût d'une opération = somme(niveau × multiplicateur) des enchantements du **sacrifié** + pénalité de la cible + pénalité du sacrifié.
- Le multiplicateur est propre à chaque enchantement et diffère selon que le sacrifié est un **livre** ou un **objet** (ex. Raccommodage : ×2 livre / ×4 objet). Table complète dans `js/data.js`.
- Pénalité de travail : 0, puis `2 × max(pénalités) + 1` (0, 1, 3, 7, 15…).
- Plafond Survie : une opération de plus de 39 niveaux est refusée (« Trop cher »).
- Les livres peuvent être combinés entre eux avant d'être posés sur l'objet : moins de pénalité, mais certains enchantements sont payés plusieurs fois. L'optimiseur explore tous les plans (programmation dynamique sur sous-ensembles) et garde le moins cher dont **chaque étape reste ≤ 39**.

## Vérifications faites

- Les deux plans chiffrés du wiki (bottes à 7 enchantements : 68 puis 66 niveaux) sont reproduits à l'identique dans les tests. L'optimiseur trouve 66.
- L'optimiseur est comparé à une recherche exhaustive indépendante (jusqu'à 5 enchantements) : mêmes résultats.
- Niveaux max, objets applicables et incompatibilités viennent des pages « Enchanting » et « Anvil mechanics » (consultées le 18/11/2026).

## Régénérer les échanges des villageois

```bash
# 1. Télécharger la page du wiki (lecture seule, ne pas exécuter)
curl -L https://minecraft.wiki/w/Trading -o Trading.html
# 2. Extraire puis construire (voir l'en-tête de chaque script)
python3 -I tools/extract_trades.py Trading.html trades.json
python3 -I tools/build_trades.py trades.json <dossier assets 26.1> .
```

### Structures et butins

```bash
# pages wiki : Structure, puis st/<Page>.html (Ancient_City, Trial_Chambers, …, Village_Loot, Cold_Ocean_Ruins…)
python3 -I tools/extract_structures.py <dossier wiki> structures_raw.json
python3 -I tools/build_structures.py structures_raw.json <dossier assets 26.1> .
```


## Limites connues

- **Structures** : seuls les butins de la version Java actuelle sont gardés ; le wiki indique aussi les versions à venir (ex. « Java 26.4 »), ignorées ici. Les biomes, descriptions et astuces sont rédigés à la main d'après le wiki. Les noms français (structures, objets, biomes) sont écrits de mémoire ; quelques objets récents n'ont pas d'icône (lit de paille, coussin, disque « Bounce »…).

- **Échanges** : Java Edition. Le wiki liste parfois du contenu plus récent que mes textures (version 26.1) : bûche et pousse de peuplier, pointe de soufre, bannières, lit et bouclier n'ont pas d'icône (affichés « ? »). Les noms français des objets sont écrits de mémoire, surtout pour les nouveautés.
- **Minerais** : le « meilleur niveau » est le pic théorique de la distribution ; les mesures réelles du wiki diffèrent parfois (ex. émeraude).

- **Java Edition uniquement**, dans toute l'application (coûts d'enclume, butins, échanges, taux).
- **Noms français** des enchantements écrits de mémoire (le wiki consulté est en anglais) : quelques-uns peuvent différer de la traduction officielle.
- **Pas de bouclier** : sa texture n'est pas dans le pack d'assets utilisé.
- **Un seul objet à enchanter, uniquement des livres en sacrifice.** Pas de fusion de deux objets enchantés, ni de réparation, ni de renommage (qui ajoutent des coûts en jeu).
- **Un livre par enchantement, au niveau voulu.** Le coût d'obtention des livres n'est pas compté, ni la montée de niveau par fusion de deux livres identiques.
- **Trims** : l'icône d'inventaire ne montre pas le motif (visible seulement sur le modèle 3D). Le motif est visible sur le porte-armure 3D.
- **Porte-armure** : modèle avec bras, pose par défaut du jeu ; l'éclairage est une approximation (pas le shader du jeu).
- Textures de la version 26.1 du jeu ; d'autres versions peuvent différer légèrement.

## Prochaines étapes possibles

- Catégories supplémentaires (potions, livres, enchantements de table).
- Sauvegarde de configurations d'équipement.

## Nom et icône

Le nom « Grimoire » reprend le livre d'enchantement. L'icône est générée par `python3 -I tools/make_icon.py .` à partir de la texture du livre enchanté du jeu (halo, reflet violet, étincelles).

## Fermes : ajouter tes liens YouTube

Deux façons, qui se combinent :

1. **Dans l'app** (le plus simple sur téléphone) : onglet Fermes → la ferme → « Ajouter un build » (titre, lien, note). Les liens sont enregistrés **sur l'appareil**. « Copier mes liens » / « Importer » (bas de la liste) permet de les sauvegarder et de les transférer.
2. **Dans le dépôt** : éditer `js/builds-data.js` (format et exemple dans le fichier). Ces liens s'affichent pour tout le monde et ne se suppriment pas depuis l'app. Un test vérifie que les liens sont valides.

Liens acceptés : `youtu.be/…`, `youtube.com/watch?v=…`, shorts, live, playlists, avec horodatage (`?t=90`, `t=1m30s`). Tout autre lien http(s) est enregistré mais s'ouvre hors de l'app. Les liens `javascript:` ou autres protocoles sont refusés. La vidéo est lue via `youtube-nocookie.com` et ne se charge qu'au clic sur ▶ ; sans connexion, l'app l'indique.

| Identifiant | Ferme |
|---|---|
| `mob_farm` | Ferme à mobs (broyeur) |
| `xp_farm` | Ferme à expérience |
| `spawner_trap` | Piège à spawner |
| `raid_farm` | Ferme à raids |
| `creeper_farm` | Ferme à creepers |
| `skeleton_farm` | Ferme à squelettes |
| `spider_farm` | Ferme à araignées |
| `witch_farm` | Ferme à sorcières |
| `slime_farm` | Ferme à slimes |
| `guardian_farm` | Ferme à gardiens |
| `drowned_farm` | Ferme à noyés |
| `iron_farm` | Ferme à fer (golems) |
| `crop_farm` | Ferme de cultures |
| `sugarcane_farm` | Ferme à canne à sucre |
| `bamboo_farm` | Ferme à bambou |
| `kelp_farm` | Ferme à varech |
| `melon_pumpkin_farm` | Ferme à pastèques et citrouilles |
| `cactus_farm` | Ferme à cactus |
| `tree_farm` | Ferme à bois |
| `nether_wart_farm` | Ferme à verrues du Nether |
| `honey_farm` | Ferme à miel |
| `animal_farm` | Ferme d'animaux |
| `chicken_farm` | Ferme à poulets |
| `fishing_farm` | Ferme de pêche |
| `villager_breeder` | Ferme à villageois |
| `cobble_generator` | Générateur de pierre |
| `sand_gravel_farm` | Ferme à sable et gravier |
| `gold_farm` | Ferme à or (piglins zombifiés) |
| `blaze_farm` | Ferme à blazes |
| `wither_skeleton_farm` | Ferme à squelettes wither |
| `enderman_farm` | Ferme à endermen |
| `chorus_farm` | Ferme à chorus |
| `basalt_generator` | Générateur de basalte |

## Photos des échanges (bloc de métier et villageois)

Chaque liste d'échanges commence, une seule fois, par le bloc de métier (haut fourneau, fumoir, pupitre…) et le villageois dans la tenue de son métier : en bannière sur la fiche d'un métier, en petit en-tête par métier dans les recherches. Ces images sont **générées** à partir du pack de textures du jeu :

```bash
# blocs : rendu isométrique du vrai modèle 3D ; villageois : texture de base + tenue du métier (chapeau selon les métadonnées du pack)
node tools/render_art.js <dossier assets 26.1> .
```

Correspondance métier → bloc : page « Villager » du wiki. Les images du colporteur n'ont pas de bloc.

## Graine : générateur de monde, ce qui est vérifié et ce qui ne l'est pas

- **Moteur** : [cubiomes](https://github.com/Cubitect/cubiomes) (licence MIT, copie dans `tools/wasm/cubiomes/`), la bibliothèque de référence qui reproduit le générateur de Minecraft Java. Compilée en WebAssembly (`tools/wasm/build.sh`, nécessite clang et wasm-ld), ~480 Ko. Aucune donnée n'est envoyée en ligne.
- **Vérifié ici** : les 30 villages d'une zone test correspondent à un calcul indépendant du placement (formule du wiki : espacement 34, séparation 8, sel 10387312) ; la carte se génère pour 1.12, 1.16, 1.18 et 1.21, en Overworld, Nether et End ; chunks à slimes recoupés avec une réimplémentation JS. Voir `tests/world.test.js`.
- **Non vérifié** : je n'ai pas pu comparer les biomes ni les structures à une vraie partie ni à Chunkbase (site non joignable depuis l'environnement de développement). La fiabilité repose sur cubiomes, largement utilisée par la communauté, pas sur ma propre vérification visuelle dans le jeu.
- **Limites connues** : (1) une structure est placée à partir de la graine puis validée par le biome ; le terrain exact (par exemple un village sur l'eau) n'est pas simulé, donc un point peut être faux ; (2) le point d'apparition est une estimation ; (3) les biomes affichés sont ceux de la surface (altitude 256) : pas les grottes ; (4) mineshafts, trésors enfouis et puits du désert ne s'affichent qu'au zoom Détail ou Moyen (trop nombreux sinon) ; (5) les versions plus récentes que 1.21.4 (26.x) ne sont pas gérées ; (6) pas de mode « grands biomes » ni de Bedrock.
- **Lien Chunkbase** : le format `…/apps/seed-map#seed=…&platform=java_1_21&dimension=overworld&x=…&z=…` vient d'un seul lien partagé trouvé en ligne, pas d'une documentation du site. Grimoire n'est pas affilié à Chunkbase.
