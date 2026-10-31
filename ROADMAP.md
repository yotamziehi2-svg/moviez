# 🗺️ MovieZ — Note de Passation Technique (Features Prioritaires)

> **Projet** : MovieZ — Plateforme de streaming personnelle  
> **Stack** : HTML5 / CSS3 / JavaScript Vanilla (ES2020+)  
> **APIs** : TMDB v3 (`api.themoviedb.org/3`) · Vidzy Embed · YouTube IFrame API  
> **Dépôt** : https://github.com/yotamziehi2-svg/moviez  
> **Déploiement** : Vercel (auto-deploy sur push `main`)  
> **Clé TMDB** : Voir `config.js` / `.env` (ne pas exposer dans le dépôt public → passer par les Variables d'environnement Vercel)

---

## ⚠️ Points importants avant de commencer

- **Pas de framework** : tout est en JS vanilla. Ne pas introduire React/Vue sans refacto complète.
- **Stockage local** : historique, wishlist, notifications → `localStorage`. Clés utilisées : `moviez_history`, `moviez_wishlist`, `moviez_notifications`, `moviez_active_tab`, `tmdb_api_key`.
- **Authentification** : aucune. Chaque utilisateur a son propre navigateur = ses propres données. Multi-utilisateurs non géré côté serveur.
- **CORS** : l'API TMDB autorise les requêtes navigateur directes. Aucun backend proxy nécessaire.
- **Clé API TMDB** : exposée côté client dans `config.js`. Pour un projet public, migrer vers une Vercel Edge Function proxy pour cacher la clé.

---

## 🥇 Feature 1 — Carrousel de Catégories Style Netflix

### Objectif
Remplacer la grille unique sur la page d'accueil par des **rangées horizontales scrollables** (type Netflix), chacune dédiée à un thème ou genre précis, pour offrir une navigation plus riche et addictive.

### UX cible
```
[ 🔥 Tendances du moment         ] ← → 
  [Affiche] [Affiche] [Affiche] [Affiche] ...

[ 🎬 Sorties de la semaine       ] ← →
  [Affiche] [Affiche] ...

[ 😱 Horreur & Suspense          ] ← →
  [Affiche] [Affiche] ...
```
Chaque rangée est scrollable horizontalement (molette ou flèches). Les flèches `←` `→` apparaissent au survol de la rangée.

### Endpoints TMDB à utiliser

| Rangée | Endpoint TMDB |
|:---|:---|
| 🔥 Tendances | `GET /trending/all/day` |
| 🎬 Sorties récentes (films) | `GET /movie/now_playing` |
| 📺 Séries du moment | `GET /tv/on_the_air` |
| ⭐ Top noté | `GET /movie/top_rated` |
| 😱 Horreur | `GET /discover/movie?with_genres=27` |
| 🔫 Action | `GET /discover/movie?with_genres=28` |
| 😂 Comédie | `GET /discover/movie?with_genres=35` |
| 🧠 Thriller | `GET /discover/movie?with_genres=53` |
| 👽 Science-Fiction | `GET /discover/movie?with_genres=878` |
| 🇫🇷 Films francophones | `GET /discover/movie?with_original_language=fr` |

IDs des genres TMDB complets disponibles sur : `GET /genre/movie/list?language=fr-FR`

### Structure HTML à créer

```html
<!-- Remplace ou complète #mediaGrid dans index.html -->
<div id="catalogContainer">
  <!-- Générée dynamiquement par JS -->
  <div class="carousel-row" data-endpoint="/trending/all/day">
    <div class="carousel-header">
      <h3 class="carousel-title">🔥 Tendances du moment</h3>
      <button class="carousel-arrow left">‹</button>
      <button class="carousel-arrow right">›</button>
    </div>
    <div class="carousel-track">
      <!-- .media-card répétées ici -->
    </div>
  </div>
  <!-- ...autres rangées... -->
</div>
```

### CSS clé à implémenter

```css
.carousel-row { margin-bottom: 40px; position: relative; }

.carousel-track {
  display: flex;
  gap: 14px;
  overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE */
  padding-bottom: 6px;
}
.carousel-track::-webkit-scrollbar { display: none; }

/* Les cartes dans le carousel ont une largeur fixe */
.carousel-track .media-card {
  flex: 0 0 180px; /* ne pas réduire */
  min-width: 180px;
}

.carousel-arrow {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10;
  background: rgba(0,0,0,0.7);
  border: none;
  color: #fff;
  font-size: 2rem;
  width: 42px;
  height: 60px;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s;
}
.carousel-row:hover .carousel-arrow { opacity: 1; }
.carousel-arrow.left { left: -20px; }
.carousel-arrow.right { right: -20px; }
```

### Logique JS

```javascript
const CAROUSEL_ROWS = [
  { title: '🔥 Tendances',        endpoint: '/trending/all/day' },
  { title: '🎬 Sorties cinéma',   endpoint: '/movie/now_playing' },
  { title: '📺 Séries du moment', endpoint: '/tv/on_the_air' },
  { title: '⭐ Top noté',         endpoint: '/movie/top_rated' },
  { title: '😱 Horreur',          endpoint: '/discover/movie', params: { with_genres: 27 } },
  { title: '🔫 Action',           endpoint: '/discover/movie', params: { with_genres: 28 } },
  { title: '😂 Comédie',          endpoint: '/discover/movie', params: { with_genres: 35 } },
  { title: '🇫🇷 Films français',  endpoint: '/discover/movie', params: { with_original_language: 'fr' } },
];

async function buildCarousels() {
  const container = document.getElementById('catalogContainer');
  container.innerHTML = '';

  for (const row of CAROUSEL_ROWS) {
    const data = await fetchTMDB(row.endpoint, row.params || {});
    const items = (data.results || []).filter(i => i.poster_path);
    if (!items.length) continue;

    const rowEl = document.createElement('div');
    rowEl.className = 'carousel-row';
    rowEl.innerHTML = `
      <div class="carousel-header">
        <h3 class="carousel-title">${row.title}</h3>
      </div>
      <div class="carousel-track"></div>
    `;

    const track = rowEl.querySelector('.carousel-track');
    items.forEach(item => {
      const card = buildCard(item); // réutiliser la logique de renderGrid
      track.appendChild(card);
    });

    // Flèches de navigation
    ['left', 'right'].forEach(dir => {
      const btn = document.createElement('button');
      btn.className = `carousel-arrow ${dir}`;
      btn.textContent = dir === 'left' ? '‹' : '›';
      btn.onclick = () => {
        track.scrollBy({ left: dir === 'left' ? -600 : 600, behavior: 'smooth' });
      };
      rowEl.appendChild(btn);
    });

    container.appendChild(rowEl);
  }
}
```

> [!NOTE]
> Les appels API sont séquentiels (8 rangées = 8 requêtes). Pour améliorer les perfs, utiliser `Promise.all()` et rendre les rangées au fil de l'eau avec un skeleton loading.

### Impact sur le code existant
- `loadContent()` : en mode `all`, appeler `buildCarousels()` au lieu de `renderGrid()`.
- `renderGrid()` : extraire la création d'une seule card dans une fonction `buildCard(item)` réutilisable.
- L'infinite scroll actuel ne s'applique **pas** en mode carousel — désactiver `setupInfiniteScroll()` dans ce cas.

---

## 🥈 Feature 2 — Bande-Annonce au Survol (Trailer Hover)

### Objectif
Après 1,5 secondes de survol sur une affiche, lancer silencieusement la **bande-annonce YouTube** du film/série à l'intérieur de la card, comme Netflix.

### Prérequis
Charger l'**API YouTube IFrame** une seule fois dans `index.html` :
```html
<script src="https://www.youtube.com/iframe_api"></script>
```

Endpoint TMDB pour récupérer la clé YouTube :  
`GET /movie/{id}/videos?language=fr-FR` → chercher `type === 'Trailer'` et `site === 'YouTube'`  
Si aucun trailer FR → relancer en `language=en-US`.

### CSS

```css
.trailer-overlay {
  position: absolute;
  inset: 0;
  background: #000;
  z-index: 5;
  animation: fadeIn 0.4s ease;
}
.trailer-frame { width: 100%; height: 75%; }
.trailer-fade-bottom {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 40%;
  background: linear-gradient(transparent, #000);
}
.trailer-info {
  position: absolute;
  bottom: 12px; left: 12px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
}
```

### Logique JS

```javascript
let hoverTimer = null;
let activePlayer = null;

function initCardHover(cardEl, item) {
  cardEl.addEventListener('mouseenter', () => {
    hoverTimer = setTimeout(async () => {
      const key = await getTrailerKey(item.id, isMovieMedia(item) ? 'movie' : 'tv');
      if (!key) return;
      showTrailer(cardEl, item, key);
    }, 1500);
  });
  cardEl.addEventListener('mouseleave', () => {
    clearTimeout(hoverTimer);
    hideTrailer(cardEl);
  });
}

async function getTrailerKey(id, type) {
  const cacheKey = `trailer_${type}_${id}`;
  if (sessionStorage.getItem(cacheKey)) return sessionStorage.getItem(cacheKey);

  try {
    let data = await fetchTMDB(`/${type}/${id}/videos`, { language: 'fr-FR' });
    let trailer = (data.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');
    if (!trailer) {
      data = await fetchTMDB(`/${type}/${id}/videos`, { language: 'en-US' });
      trailer = (data.results || []).find(v => v.site === 'YouTube' && v.type === 'Trailer');
    }
    const key = trailer ? trailer.key : null;
    if (key) sessionStorage.setItem(cacheKey, key);
    return key;
  } catch { return null; }
}

function showTrailer(cardEl, item, youtubeKey) {
  if (activePlayer) hideTrailer(activePlayer._card);

  const overlay = cardEl.querySelector('.trailer-overlay');
  overlay.style.display = 'block';
  cardEl.style.transform = 'scale(1.25) translateY(-10%)';
  cardEl.style.zIndex = '50';

  activePlayer = new YT.Player(overlay.querySelector('.trailer-frame'), {
    videoId: youtubeKey,
    playerVars: { autoplay: 1, mute: 1, controls: 0, modestbranding: 1, loop: 1, playlist: youtubeKey },
    events: { onReady: e => e.target.playVideo() }
  });
  activePlayer._card = cardEl;
}

function hideTrailer(cardEl) {
  const overlay = cardEl.querySelector('.trailer-overlay');
  if (overlay) overlay.style.display = 'none';
  cardEl.style.transform = '';
  cardEl.style.zIndex = '';
  if (activePlayer) { try { activePlayer.destroy(); } catch {} activePlayer = null; }
}
```

> [!WARNING]
> **Mobile** : désactiver le hover sur écran tactile avec `window.matchMedia('(hover: none)')` — le survol n'existe pas sur touch.

> [!TIP]
> **Cache** : le `sessionStorage` dans `getTrailerKey` est essentiel pour ne pas dépasser la rate limit TMDB (≈40 req/10s) lors du scroll rapide sur de nombreuses affiches.

---

## 🥉 Feature 3 — Exploration par Genre / Humeur

### Objectif
Un écran de sélection d'humeur avec des bulles visuelles représentant des genres. L'utilisateur clique sur une bulle → reçoit les meilleurs films/séries de ce genre avec défilement infini. Un bouton **« Surprends-moi ! »** sélectionne un genre aléatoire.

### Données : Carte des genres TMDB

```javascript
const GENRES = [
  { id: 28,    label: 'Action',          icon: '🔥', type: 'movie' },
  { id: 35,    label: 'Comédie',         icon: '😂', type: 'both'  },
  { id: 27,    label: 'Horreur',         icon: '😱', type: 'movie' },
  { id: 53,    label: 'Thriller',        icon: '🧠', type: 'movie' },
  { id: 10749, label: 'Romance',         icon: '💕', type: 'both'  },
  { id: 878,   label: 'Science-Fiction', icon: '👽', type: 'movie' },
  { id: 18,    label: 'Drame',           icon: '🎭', type: 'both'  },
  { id: 80,    label: 'Crime',           icon: '🕵️', type: 'both'  },
  { id: 16,    label: 'Animation',       icon: '🧚', type: 'both'  },
  { id: 10402, label: 'Musical',         icon: '🎶', type: 'movie' },
  { id: 36,    label: 'Histoire',        icon: '📜', type: 'movie' },
  { id: 99,    label: 'Documentaire',    icon: '🌍', type: 'movie' },
];
```

> [!NOTE]
> Pour `type: 'tv'`, les IDs de genres diffèrent de ceux des films. Consulter `GET /genre/tv/list`.

### HTML à ajouter

```html
<!-- Dans la nav (index.html), après "Séries" -->
<button class="nav-btn" data-filter="genres">🎭 Genres</button>

<!-- Section genre (cachée par défaut) dans <main> -->
<section id="genreSection" style="display:none;">
  <div class="genre-intro">
    <h2>Qu'est-ce qu'on regarde ce soir ?</h2>
    <p>Choisissez une ambiance</p>
  </div>
  <div id="genreGrid" class="genre-grid"></div>
  <div class="genre-surprise-row">
    <button id="surpriseBtn" class="btn btn-primary">🎲 Surprends-moi !</button>
  </div>
</section>
```

### CSS

```css
.genre-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
  padding: 32px 40px;
  max-width: 900px;
  margin: 0 auto;
}
.genre-bubble {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 22px 28px;
  background: var(--bg-card);
  border: 2px solid var(--border);
  border-radius: 20px;
  cursor: pointer;
  transition: all 0.25s ease;
  min-width: 110px;
}
.genre-bubble:hover {
  border-color: var(--accent);
  transform: translateY(-6px) scale(1.05);
  background: rgba(255,59,65,0.08);
  box-shadow: 0 10px 30px rgba(255,59,65,0.2);
}
.genre-bubble .genre-icon  { font-size: 2.2rem; }
.genre-bubble .genre-label { font-size: 0.85rem; font-weight: 700; text-align: center; }
```

### Logique JS

```javascript
function renderGenreSelector() {
  heroSection.style.display = 'none';
  mediaGrid.style.display = 'none';
  statusMessage.style.display = 'none';
  document.getElementById('genreSection').style.display = 'block';

  const grid = document.getElementById('genreGrid');
  grid.innerHTML = '';
  GENRES.forEach(genre => {
    const bubble = document.createElement('div');
    bubble.className = 'genre-bubble';
    bubble.innerHTML = `<span class="genre-icon">${genre.icon}</span><span class="genre-label">${genre.label}</span>`;
    bubble.onclick = () => loadByGenre(genre);
    grid.appendChild(bubble);
  });

  document.getElementById('surpriseBtn').onclick = () => {
    loadByGenre(GENRES[Math.floor(Math.random() * GENRES.length)]);
  };
}

async function loadByGenre(genre, page = 1) {
  document.getElementById('genreSection').style.display = 'none';
  sectionTitle.textContent = `${genre.icon} ${genre.label}`;

  const type = genre.type === 'tv' ? 'tv' : 'movie';
  if (page === 1) { showLoader(); mediaGrid.innerHTML = ''; currentPage = 1; }

  const data = await fetchTMDB(`/discover/${type}`, {
    with_genres: genre.id,
    sort_by: 'vote_average.desc',
    'vote_count.gte': 500, // filtre les titres peu connus avec gonflage de notes
    page
  });

  totalPages = data.total_pages || 1;
  const items = (data.results || [])
    .filter(i => i.poster_path)
    .map(i => ({ ...i, media_type: type }));

  if (page === 1 && items[0]) {
    mediaGrid.style.display = 'grid';
    statusMessage.style.display = 'none';
    renderHero(items[0]);
  }
  appendCards(items);
  resultsCount.textContent = `${data.total_results || '?'} titres · Page ${page}/${totalPages}`;
  updateLoadMoreBtn();
  isLoadingMore = false;
  hideScrollLoader();
}
```

### Intégration dans le router

Dans `setupEventListeners()`, ajouter dans le bloc de navigation :
```javascript
// Juste avant le bloc if (currentFilter === 'history')
if (currentFilter === 'genres') {
  renderGenreSelector();
  return;
}
```

Et dans `restoreActiveTab()` :
```javascript
if (currentFilter === 'genres') {
  renderGenreSelector();
} else if ...
```

---

## 📁 Récapitulatif des fichiers concernés

| Feature | Fichiers modifiés |
|:---|:---|
| 1 — Carousel Netflix | `index.html` · `style.css` · `app.js` (`buildCarousels`, `buildCard`) |
| 2 — Trailer au survol | `index.html` (script YT) · `style.css` (overlay) · `app.js` (`initCardHover`, `getTrailerKey`) |
| 3 — Genres / Humeur | `index.html` (section + nav) · `style.css` (genre grid) · `app.js` (`GENRES`, `renderGenreSelector`, `loadByGenre`) |

---

## 🔐 Sécuriser la clé TMDB (production)

La clé est actuellement exposée côté client. Pour la cacher sur un projet public :

1. Aller sur **vercel.com** → projet MovieZ → **Settings** → **Environment Variables**
2. Ajouter : `TMDB_API_KEY` = `<votre_clé>`
3. Créer `/api/tmdb.js` (Vercel Edge Function proxy) :
```javascript
export default async function handler(req) {
  const { endpoint, ...params } = req.query;
  const url = new URL(`https://api.themoviedb.org/3${endpoint}`);
  url.searchParams.set('api_key', process.env.TMDB_API_KEY);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  return new Response(await res.text(), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
```
4. Dans `fetchTMDB()` côté client, pointer vers `/api/tmdb?endpoint=/movie/popular&page=1` au lieu de l'API TMDB directement.

---

*Document généré le 31/10/2026 — MovieZ v1.2*
