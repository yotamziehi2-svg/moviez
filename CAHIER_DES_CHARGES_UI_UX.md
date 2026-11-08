# Cahier des charges UI/UX — Spécifications & Conformité Zetflix

Ce document consigne les spécifications exactes de l'interface **Zetflix**, répliquant fidèlement l'ergonomie, la hiérarchie visuelle, la colorimétrie et le comportement responsive de **Netflix**, tout en conservant le backend existant (API TMDB + Lecteur Vidzy / Multi-serveurs sans publicités).

---

## 1. Palette de Couleurs & Valeurs Référence

| Élément | Code Couleur | Usage |
|---|---|---|
| **Fond principal** | `#141414` | Couleur d'arrière-plan globale du catalogue |
| **Noir profond** | `#000000` | Dégradés de vignettage, lecteur vidéo, overlays |
| **Rouge d'accentuation** | `#E50914` | Marque ZETFLIX, badges Top 10, indicateurs actifs |
| **Rouge au survol** | `#B20710` | États :hover des boutons primaires |
| **Gris des textes secondaires** | `#B3B3B3` | Métadonnées (année, durée, sous-titres, synopses) |
| **Gris des séparateurs/cadres** | `#333333` | Bordures subtiles, contours des modals |
| **Blanc principal** | `#FFFFFF` | Titres, texte primaire, bouton "Lecture" |
| **Fond des cartes & menus** | `#181818` | Menu déroulant, cartes médias, boîtes modales |
| **Vert indicateur match** | `#46D369` | Pourcentage de recommandation ("Recommandé à 98%") |

> **Règle d'or** : Le rouge `#E50914` est utilisé avec parcimonie pour préserver l'immersion cinématographique et ne pas surcharger la rétine.

---

## 2. Typographie & Rayons de courbure (Border Radius)

- **Famille typographique** : `'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
- **Logo Zetflix** : Typographie grasse condensée style Impact/Netflix Sans (`#E50914`, 900 weight).
- **Courbures (Arrondis)** :
  - **Cartes de films/séries** : `12px` (arrondi moderne & harmonieux).
  - **Boutons d'action (Lecture / Infos)** : `9999px` (forme pilule contemporaine).
  - **Boutons circulaires (+ / J'aime / Fermer)** : `50%`.
  - **Modales & Fiches de détails** : `18px`.
  - **Barre de recherche** : `9999px` (capsule ovale).

---

## 3. Décomposition des Composants & Architecture UI

```
┌────────────────────────────────────────────────────────────────────────┐
│  01. NAVBAR (68px)                                                     │
│  [ZETFLIX]  Accueil  Séries  Films  Nouveautés  Ma liste  Historique   │
│                                           [🔍 Recherche]  [🔔]  [Avatar]│
├────────────────────────────────────────────────────────────────────────┤
│  02. BILLBOARD HERO (Bannière Cinématique ~75vh - 85vh)                │
│                                                                        │
│   [Z] SÉRIE                                                            │
│   TITRE DU PROGRAMME                                                   │
│   98% recommandé · 2026 · 16+ · Ultra HD 4K                            │
│   Description concise et immersive...                                 │
│                                                                        │
│   [ ▶ Lecture ]    [ ℹ Plus d'infos ]    ( + )                         │
│                                                                        │
│   (Dégradé transparent vers le bas en fondu avec le catalogue #141414) │
├────────────────────────────────────────────────────────────────────────┤
│  03. CARROUSELS HORIZONTAUX (Movie Rows)                               │
│                                                                        │
│   🔥 Top 10 des programmes aujourd'hui en France                       │
│   [ 1 ][Affiche]  [ 2 ][Affiche]  [ 3 ][Affiche] ... (Flèches ‹ ›)     │
│                                                                        │
│   🎬 Sorties cinéma récentes                                           │
│   [Affiche]  [Affiche]  [Affiche]  [Affiche] ...                       │
│                                                                        │
│   📺 Séries télévisées populaires                                      │
│   [Affiche]  [Affiche]  [Affiche]  [Affiche] ...                       │
├────────────────────────────────────────────────────────────────────────┤
│  04. PIED DE PAGE & BOTTOM NAV MOBILE                                  │
│   Version Mobile : Barre capsule flottante avec flou verre dépoli      │
│   [Accueil] [Séries] [Films] [Ma liste] [Historique]                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Comportements & Interactions Spécifiques

### 4.1. Navbar Dynamique
- **Au repos en haut de page** : Entièrement transparente (`linear-gradient(180deg, rgba(0,0,0,0.7) 10%, transparent)`).
- **Au défilement (> 40px)** : Devient noir opaque (`#141414`) avec ombre portée (`box-shadow: 0 4px 20px rgba(0,0,0,0.7)`).
- **Recherche Netflix** : L'icône loupe déploie un champ de saisie ovale semi-transparent qui filtre en temps réel les données de l'API avec debounce de 400ms.

### 4.2. Billboard Hero (Bannière principale)
- **Fond** : Image haute résolution TMDB (`backdrop_path` original).
- **Vignettage cinématique** : Double dégradé noir (à gauche pour la lisibilité du texte, et en bas pour fondre l'image dans les rangées de films sans démarcation).
- **Cycle automatique** : Transition fluide toutes les 9 secondes entre les titres phares du jour.

### 4.3. Cartes de Films & Carrousels (Movie Rows)
- **Dimensions standard** : `flex: 0 0 200px` (desktop), `flex: 0 0 135px` (mobile).
- **Rangée Top 10** : Numérotation géante décalée style Netflix (`-webkit-text-stroke: 4px #595959`).
- **Survol (Hover)** : Agrandissement progressif `transform: scale(1.08) translateY(-6px)` avec z-index prioritaire et ombre douce (`box-shadow: 0 12px 30px rgba(0,0,0,0.85)`).
- **Flèches de navigation** : Défilement fluide de 70% de la largeur de l'écran par clic.

### 4.4. Fiche détaillée (Modal "Plus d'infos")
- Grande bannière haute avec bouton Lecture et Ajout rapide.
- Données structurées : Recommandation, année, genre, synopsis intégral, liste des serveurs disponibles.

### 4.5. Lecteur Vidéo (Player)
- Vue plein écran immersive avec barre supérieure discrète.
- Sélecteur de serveurs sans pub : **Vidzy**, **VidSrc**, **EmbedSu**, **SuperEmbed**.
- Sélecteur de saison et épisode dynamique pour les séries avec mémorisation de l'avancement.

---

## 5. Matrice Responsive

| Fonctionnalité | Desktop (> 900px) | Mobile & Tablette (<= 900px) |
|---|---|---|
| **Navigation** | Liens horizontaux en haut | Capsule flottante en bas de l'écran avec flou |
| **Billboard Hero** | Pleine hauteur (~80vh), typographie 3.5rem | Hauteur réduite (~65vh), titre 2rem, synopsis 2 lignes |
| **Carrousels** | Flèches latérales au survol | Défilement tactile natif au doigt |
| **Modales** | Fenêtre centrée `820px` | Fiche adaptative pleine largeur |

---

## 6. État d'Implémentation dans le Projet

- `index.html` : Structure HTML5 conforme à la hiérarchie Netflix.
- `style.css` : Palette exacte, polices, carrousels, boutons pilules et animations.
- `app.js` : Moteur complet connecté à l'API TMDB, Vidzy, persistance locale (cookies + storage) et infinite scroll.
- **Dépôt GitHub** : [yotamziehi2-svg/moviez](https://github.com/yotamziehi2-svg/moviez) (branche `main`).
- **Déploiement en ligne Vercel** : [moviez-tho.vercel.app](https://moviez-tho.vercel.app).
