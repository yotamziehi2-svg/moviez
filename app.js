/**
 * =========================================================================
 * ZETFLIX - LOGIQUE APPLICATION COMPLÈTE
 * API TMDB (Métadonnées) + MULTI-SERVEURS (Vidzy, VidSrc, EmbedSu, SuperEmbed)
 * Historique, Ma Liste, Notifications, Top 10, Carrousels Netflix
 * =========================================================================
 */

// ===================== CONFIGURATION & ÉTAT =====================
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMG_POSTER = 'https://image.tmdb.org/t/p/w500';
const TMDB_IMG_BACKDROP = 'https://image.tmdb.org/t/p/original';

let apiKey = (window.CONFIG && window.CONFIG.TMDB_API_KEY) || localStorage.getItem('tmdb_api_key') || 'b50b12e7db90800c59536e2bbd8f4aa7';
let currentTab = localStorage.getItem('zetflix_active_tab') || 'home'; // 'home', 'series', 'movies', 'top', 'wishlist', 'history'
let currentSearch = '';
let currentMedia = null;
let currentPreviewMedia = null;
let currentSeason = 1;
let currentEpisode = 1;
let currentLang = '';
let currentServer = 'vidzy';
let searchDebounce = null;

// Pagination
let currentPage = 1;
let totalPages = 1;
let isLoadingMore = false;
let billboardItems = [];
let billboardIndex = 0;
let billboardTimer = null;

// Carrousels de la page d'accueil (Structure exacte de Netflix)
const HOMEPAGE_ROWS = [
  { title: '🔥 Top 10 des programmes aujourd\'hui en France', endpoint: '/trending/all/day', isTop10: true },
  { title: '🎬 Sorties cinéma récentes', endpoint: '/movie/now_playing' },
  { title: '📺 Séries télévisées populaires', endpoint: '/tv/popular' },
  { title: '⭐ Les chefs-d\'œuvre les mieux notés', endpoint: '/movie/top_rated' },
  { title: '😱 Frissons & Films d\'horreur', endpoint: '/discover/movie', params: { with_genres: 27 } },
  { title: '🔫 Films d\'action spectaculaires', endpoint: '/discover/movie', params: { with_genres: '28,12' } },
  { title: '😂 Comédies pour se détendre', endpoint: '/discover/movie', params: { with_genres: 35 } },
  { title: '🇫🇷 Productions françaises incontournables', endpoint: '/discover/movie', params: { with_original_language: 'fr' } },
];

// Catalogue des genres et humeurs (Feature 3)
const GENRES_CATALOG = [
  { id: 28,    label: 'Action',          icon: '🔥', type: 'movie' },
  { id: 35,    label: 'Comédie',         icon: '😂', type: 'both'  },
  { id: 27,    label: 'Horreur',         icon: '😱', type: 'movie' },
  { id: 53,    label: 'Thriller',        icon: '🧠', type: 'movie' },
  { id: 10749, label: 'Romance',         icon: '💕', type: 'both'  },
  { id: 878,   label: 'Science-Fiction', icon: '👽', type: 'movie' },
  { id: 18,    label: 'Drame',           icon: '🎭', type: 'both'  },
  { id: 80,    label: 'Crime & Gangsters',icon: '🕵️', type: 'both' },
  { id: 16,    label: 'Animation',       icon: '🧚', type: 'both'  },
  { id: 10402, label: 'Comédie Musicale',icon: '🎶', type: 'movie' },
  { id: 36,    label: 'Histoire & Époque',icon: '📜', type: 'movie' },
  { id: 99,    label: 'Documentaires',   icon: '🌍', type: 'movie' },
];

// Trailer Hover State (Feature 2)
let hoverTrailerTimer = null;
let activeTrailerCard = null;

// ===================== DOUBLE STOCKAGE LOCAL + COOKIE =====================
const STORAGE_KEYS = {
  history: 'zetflix_history',
  wishlist: 'zetflix_wishlist',
  notifications: 'zetflix_notifications',
};

function storageGet(key, fallback = '[]') {
  try {
    const val = localStorage.getItem(key);
    if (val) return JSON.parse(val);
  } catch (e) {}
  try {
    const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
    if (match) return JSON.parse(decodeURIComponent(match[2]));
  } catch (e) {}
  return JSON.parse(fallback);
}

function storageSet(key, data) {
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(key, json);
  } catch (e) {}
  try {
    const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
    const truncated = json.length > 3800 ? JSON.stringify(data.slice(0, 20)) : json;
    document.cookie = `${key}=${encodeURIComponent(truncated)};expires=${expires};path=/;SameSite=Lax`;
  } catch (e) {}
}

let historyList = storageGet(STORAGE_KEYS.history);
let wishlist = storageGet(STORAGE_KEYS.wishlist);
let notifications = storageGet(STORAGE_KEYS.notifications);

// ===================== DÉTECTION TYPE DE MÉDIA =====================
function isMovie(item) {
  if (!item) return true;
  if (item.media_type === 'tv' || item.type === 'tv') return false;
  if (item.media_type === 'movie' || item.type === 'movie') return true;
  if (item.first_air_date || (item.name && !item.release_date)) return false;
  return true;
}

// ===================== APPELS API TMDB =====================
async function fetchTMDB(endpoint, params = {}) {
  if (!apiKey) throw new Error('Clé TMDB manquante');
  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const headers = { Accept: 'application/json' };
  if (apiKey.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  } else {
    url.searchParams.set('api_key', apiKey.trim());
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`Erreur TMDB ${res.status}`);
  return res.json();
}

// ===================== INITIALISATION =====================
window.addEventListener('DOMContentLoaded', () => {
  localStorage.setItem('tmdb_api_key', apiKey);
  setupNavbarScroll();
  setupEventListeners();
  updateStatsBadges();
  checkWishlistReleases();
  restoreTab();
});

// Effet de scroll sur la navbar (devient noire comme Netflix)
function setupNavbarScroll() {
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  });
}

// ===================== NAVIGATION & GESTION DES ONGLETS =====================
function restoreTab() {
  setActiveTabUI(currentTab);
  if (currentTab === 'wishlist') {
    renderWishlist();
  } else if (currentTab === 'history') {
    renderHistory();
  } else if (currentTab === 'genres') {
    renderGenresMoodView();
  } else if (currentTab === 'series') {
    loadCategoryView('tv', 'Séries télévisées');
  } else if (currentTab === 'movies') {
    loadCategoryView('movie', 'Films');
  } else if (currentTab === 'top') {
    loadCategoryView('top', 'Nouveautés les plus regardées');
  } else {
    loadHomeRows();
  }
}

function setActiveTabUI(tab) {
  document.querySelectorAll('.menu-item, .mob-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
}

function switchTab(tab) {
  currentTab = tab;
  localStorage.setItem('zetflix_active_tab', tab);
  setActiveTabUI(tab);
  currentSearch = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchWidget').classList.remove('active');
  currentPage = 1;
  restoreTab();
}

// ===================== ÉCOUTEURS D'ÉVÉNEMENTS =====================
function setupEventListeners() {
  // Logo -> Retour Accueil
  document.getElementById('brandLogo').addEventListener('click', (e) => {
    e.preventDefault();
    switchTab('home');
  });

  // Liens de Navigation Desktop
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => switchTab(item.dataset.tab));
  });

  // Liens de Navigation Mobile
  document.querySelectorAll('.mob-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Recherche Netflix dépliable
  const searchWidget = document.getElementById('searchWidget');
  const searchToggle = document.getElementById('searchToggle');
  const searchInput = document.getElementById('searchInput');
  const clearSearch = document.getElementById('clearSearch');

  searchToggle.addEventListener('click', () => {
    searchWidget.classList.toggle('active');
    if (searchWidget.classList.contains('active')) {
      searchInput.focus();
    }
  });

  searchInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    clearSearch.style.display = val ? 'block' : 'none';
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      currentSearch = val;
      if (val.length >= 2) {
        performSearch(val, 1);
      } else if (val.length === 0) {
        restoreTab();
      }
    }, 400);
  });

  clearSearch.addEventListener('click', () => {
    searchInput.value = '';
    clearSearch.style.display = 'none';
    currentSearch = '';
    restoreTab();
  });

  // Fermer la recherche si clic extérieur et vide
  document.addEventListener('click', (e) => {
    if (!searchWidget.contains(e.target) && !searchInput.value) {
      searchWidget.classList.remove('active');
    }
  });

  // Menu Notifications
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('active');
    document.getElementById('profileDropdown').classList.remove('active');
  });

  // Menu Profil / Réglages
  const profileBtn = document.getElementById('profileBtn');
  const profileDropdown = document.getElementById('profileDropdown');
  profileBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    profileDropdown.classList.toggle('active');
    notifDropdown.classList.remove('active');
  });

  document.addEventListener('click', () => {
    notifDropdown.classList.remove('active');
    profileDropdown.classList.remove('active');
  });

  // Modals d'actions
  document.getElementById('settingsDataBtn').addEventListener('click', () => {
    profileDropdown.classList.remove('active');
    openSettingsModal();
  });
  document.getElementById('changeApiBtn').addEventListener('click', () => {
    profileDropdown.classList.remove('active');
    openSettingsModal();
  });
  document.getElementById('castTvBtn').addEventListener('click', () => {
    profileDropdown.classList.remove('active');
    document.getElementById('castModal').classList.add('active');
  });

  document.getElementById('closeSettingsBtn').addEventListener('click', () => document.getElementById('settingsModal').classList.remove('active'));
  document.getElementById('settingsBackdrop').addEventListener('click', () => document.getElementById('settingsModal').classList.remove('active'));
  document.getElementById('closeCastBtn').addEventListener('click', () => document.getElementById('castModal').classList.remove('active'));
  document.getElementById('castBackdrop').addEventListener('click', () => document.getElementById('castModal').classList.remove('active'));

  // Copier URL TV
  document.getElementById('copyTvUrlBtn').addEventListener('click', () => {
    const btn = document.getElementById('copyTvUrlBtn');
    navigator.clipboard.writeText(document.getElementById('localTvUrl').textContent);
    btn.textContent = 'Copié !';
    setTimeout(() => btn.textContent = 'Copier', 2000);
  });

  // Enregistrer clé TMDB
  document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (key) {
      apiKey = key;
      localStorage.setItem('tmdb_api_key', key);
      document.getElementById('settingsModal').classList.remove('active');
      restoreTab();
    }
  });

  // Exporter / Importer
  document.getElementById('exportDataBtn').addEventListener('click', exportUserData);
  document.getElementById('importDataInput').addEventListener('change', (e) => {
    if (e.target.files[0]) importUserData(e.target.files[0]);
  });
  document.getElementById('enableNotifBtn').addEventListener('click', requestNotificationPermission);

  // Preview Modal
  document.getElementById('closePreviewBtn').addEventListener('click', closePreviewModal);
  document.getElementById('previewBackdrop').addEventListener('click', closePreviewModal);
  document.getElementById('previewPlayBtn').addEventListener('click', () => {
    if (currentPreviewMedia) {
      closePreviewModal();
      openPlayer(currentPreviewMedia);
    }
  });
  document.getElementById('previewWishlistBtn').addEventListener('click', () => {
    if (currentPreviewMedia) {
      toggleWishlist(currentPreviewMedia);
      updatePreviewWishlistState();
    }
  });

  // Player Fullscreen
  document.getElementById('playerBackBtn').addEventListener('click', closePlayer);
  document.getElementById('serverSelect').addEventListener('change', (e) => {
    currentServer = e.target.value;
    updatePlayerEmbed();
  });
  document.getElementById('langSelect').addEventListener('change', (e) => {
    currentLang = e.target.value;
    updatePlayerEmbed();
  });
  document.getElementById('playerSeasonSelect').addEventListener('change', async (e) => {
    currentSeason = parseInt(e.target.value, 10);
    await loadSeriesEpisodes(currentMedia.id, currentSeason);
    saveHistory(currentMedia, currentSeason, currentEpisode);
    updatePlayerEmbed();
  });
  document.getElementById('playerEpisodeSelect').addEventListener('change', (e) => {
    currentEpisode = parseInt(e.target.value, 10);
    saveHistory(currentMedia, currentSeason, currentEpisode);
    updatePlayerEmbed();
  });
  document.getElementById('markWatchedBtn').addEventListener('click', () => {
    if (currentMedia) toggleCompleted(currentMedia);
  });

  // Échap pour fermer les modales
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closePlayer();
      closePreviewModal();
      document.getElementById('settingsModal').classList.remove('active');
      document.getElementById('castModal').classList.remove('active');
    }
  });
}

// ===================== ACCUEIL STYLE NETFLIX (CARROUSELS) =====================
async function loadHomeRows() {
  stopBillboardCycle();
  const billboardHero = document.getElementById('billboardHero');
  const rowsContainer = document.getElementById('rowsContainer');
  const gridContainer = document.getElementById('gridContainer');
  const filterHeader = document.getElementById('filterHeader');
  const emptyState = document.getElementById('emptyState');

  filterHeader.style.display = 'none';
  gridContainer.style.display = 'none';
  emptyState.style.display = 'none';
  rowsContainer.style.display = 'flex';
  rowsContainer.innerHTML = '';
  showPageLoader();

  try {
    const responses = await Promise.allSettled(
      HOMEPAGE_ROWS.map(row => fetchTMDB(row.endpoint, row.params || {}))
    );

    let rowsCount = 0;
    billboardItems = [];

    responses.forEach((resp, idx) => {
      if (resp.status !== 'fulfilled') return;
      const items = (resp.value.results || []).filter(item => item.poster_path && (item.title || item.name));
      if (!items.length) return;

      if (idx === 0) {
        billboardItems = items.slice(0, 6);
      }

      const rowConfig = HOMEPAGE_ROWS[idx];
      const rowElem = document.createElement('section');
      rowElem.className = 'netflix-row';

      const titleElem = document.createElement('h3');
      titleElem.className = 'row-title';
      titleElem.textContent = rowConfig.title;
      rowElem.appendChild(titleElem);

      const sliderElem = document.createElement('div');
      sliderElem.className = 'row-slider';

      const trackElem = document.createElement('div');
      trackElem.className = 'row-cards-track';

      items.forEach((item, pos) => {
        const card = createMediaCard(item, rowConfig.isTop10 ? (pos + 1) : null);
        trackElem.appendChild(card);
      });
      sliderElem.appendChild(trackElem);

      // Flèches de défilement horizontal
      const leftBtn = document.createElement('button');
      leftBtn.className = 'slider-arrow left';
      leftBtn.innerHTML = '‹';
      leftBtn.onclick = () => trackElem.scrollBy({ left: -window.innerWidth * 0.7, behavior: 'smooth' });

      const rightBtn = document.createElement('button');
      rightBtn.className = 'slider-arrow right';
      rightBtn.innerHTML = '›';
      rightBtn.onclick = () => trackElem.scrollBy({ left: window.innerWidth * 0.7, behavior: 'smooth' });

      sliderElem.append(leftBtn, rightBtn);
      rowElem.appendChild(sliderElem);
      rowsContainer.appendChild(rowElem);
      rowsCount++;
    });

    hidePageLoader();

    // Lancer la grande bannière Billboard Netflix
    if (billboardItems.length > 0) {
      billboardIndex = 0;
      renderBillboard(billboardItems[0]);
      billboardHero.style.display = 'flex';
      startBillboardCycle();
    }
  } catch (err) {
    hidePageLoader();
    showEmptyView('⚠️ Oups !', 'Impossible de charger le catalogue. Vérifiez votre clé TMDB dans les réglages.');
  }
}

// ===================== BILLBOARD HERO NETFLIX =====================
function renderBillboard(item) {
  const isMov = isMovie(item);
  const title = item.title || item.name || '';
  const backdrop = item.backdrop_path ? `${TMDB_IMG_BACKDROP}${item.backdrop_path}` : `${TMDB_IMG_POSTER}${item.poster_path}`;

  document.getElementById('heroBackdrop').style.backgroundImage = `url('${backdrop}')`;
  document.getElementById('heroTitle').textContent = title;
  document.getElementById('heroSynopsis').textContent = item.overview || 'Regardez dès maintenant sur Zetflix.';
  document.getElementById('heroTypeBadge').textContent = isMov ? 'FILM' : 'SÉRIE';
  document.getElementById('heroYear').textContent = (item.release_date || item.first_air_date || '2026').slice(0, 4);

  const inWish = wishlist.some(w => w.id === item.id);
  document.getElementById('heroWishlistIcon').textContent = inWish ? '✓' : '+';

  document.getElementById('heroPlayBtn').onclick = () => openPlayer({ ...item, media_type: isMov ? 'movie' : 'tv' });
  document.getElementById('heroInfoBtn').onclick = () => openPreviewModal({ ...item, media_type: isMov ? 'movie' : 'tv' });
  document.getElementById('heroWishlistBtn').onclick = () => {
    toggleWishlist({ ...item, media_type: isMov ? 'movie' : 'tv' });
    const nowIn = wishlist.some(w => w.id === item.id);
    document.getElementById('heroWishlistIcon').textContent = nowIn ? '✓' : '+';
  };
}

function startBillboardCycle() {
  billboardTimer = setInterval(() => {
    if (!billboardItems.length) return;
    billboardIndex = (billboardIndex + 1) % billboardItems.length;
    renderBillboard(billboardItems[billboardIndex]);
  }, 9000);
}

function stopBillboardCycle() {
  if (billboardTimer) {
    clearInterval(billboardTimer);
    billboardTimer = null;
  }
}

// ===================== CRÉATION DES CARTES MÉDIAS =====================
function createMediaCard(item, topRank = null) {
  const isMov = isMovie(item);
  const type = isMov ? 'movie' : 'tv';
  const title = item.title || item.name || '';
  const poster = `${TMDB_IMG_POSTER}${item.poster_path}`;
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';

  const card = document.createElement('div');
  card.className = 'netflix-card';
  if (topRank) {
    card.classList.add('is-top10');
    card.dataset.rank = topRank;
  }

  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${poster}" alt="${title}" loading="lazy">
      <span class="card-badge-top">${isMov ? 'Film' : 'Série'}</span>
      <!-- Trailer overlay au survol (Feature 2) -->
      <div class="trailer-overlay">
        <span class="trailer-badge-pill">Bande-annonce</span>
        <div class="trailer-frame-box"></div>
        <div class="trailer-gradient-bottom"></div>
      </div>
    </div>
    <div class="card-bottom-info">
      <div class="card-title" title="${title}">${title}</div>
      <div class="card-meta-line">
        <span>${year}</span>
        <span>★ ${rating}</span>
      </div>
    </div>
  `;

  card.addEventListener('click', () => {
    openPreviewModal({ ...item, media_type: type });
  });

  // Activer le hover trailer desktop
  initCardTrailerHover(card, { ...item, media_type: type });

  return card;
}

// ===================== FEATURE 2 : BANDE-ANNONCE AU SURVOL (TRAILER HOVER) =====================
function initCardTrailerHover(cardEl, item) {
  if (window.matchMedia('(hover: none)').matches) return; // Désactivé sur écran tactile

  cardEl.addEventListener('mouseenter', () => {
    clearTimeout(hoverTrailerTimer);
    hoverTrailerTimer = setTimeout(async () => {
      const type = item.media_type || (isMovie(item) ? 'movie' : 'tv');
      const trailerKey = await fetchTrailerKey(item.id, type);
      if (trailerKey && cardEl.matches(':hover')) {
        playCardTrailer(cardEl, trailerKey);
      }
    }, 1300); // 1.3 secondes de survol intentionnel
  });

  cardEl.addEventListener('mouseleave', () => {
    clearTimeout(hoverTrailerTimer);
    stopCardTrailer(cardEl);
  });
}

async function fetchTrailerKey(id, type) {
  const cacheKey = `zetflix_trailer_${type}_${id}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) return cached;

  try {
    // Essayer en français d'abord
    let data = await fetchTMDB(`/${type}/${id}/videos`, { language: 'fr-FR' });
    let trailer = (data.results || []).find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser') && v.key);

    // Repli en anglais si pas de VF
    if (!trailer) {
      data = await fetchTMDB(`/${type}/${id}/videos`, { language: 'en-US' });
      trailer = (data.results || []).find(v => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser') && v.key);
    }

    if (trailer && trailer.key) {
      sessionStorage.setItem(cacheKey, trailer.key);
      return trailer.key;
    }
  } catch (e) {}

  return null;
}

function playCardTrailer(cardEl, youtubeKey) {
  if (activeTrailerCard && activeTrailerCard !== cardEl) {
    stopCardTrailer(activeTrailerCard);
  }

  const overlay = cardEl.querySelector('.trailer-overlay');
  const frameBox = cardEl.querySelector('.trailer-frame-box');
  if (!overlay || !frameBox) return;

  overlay.style.display = 'block';
  frameBox.innerHTML = `
    <iframe 
      src="https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${youtubeKey}&playsinline=1" 
      allow="autoplay; encrypted-media" 
      loading="lazy">
    </iframe>
  `;

  activeTrailerCard = cardEl;
}

function stopCardTrailer(cardEl) {
  if (!cardEl) return;
  const overlay = cardEl.querySelector('.trailer-overlay');
  const frameBox = cardEl.querySelector('.trailer-frame-box');
  if (overlay) overlay.style.display = 'none';
  if (frameBox) frameBox.innerHTML = '';
  if (activeTrailerCard === cardEl) activeTrailerCard = null;
}

// ===================== FEATURE 3 : EXPLORATION PAR GENRE & AMBIANCE =====================
function renderGenresMoodView() {
  stopBillboardCycle();
  document.getElementById('billboardHero').style.display = 'none';
  document.getElementById('rowsContainer').style.display = 'none';
  document.getElementById('gridContainer').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('filterHeader').style.display = 'none';

  const section = document.getElementById('genreMoodSection');
  const grid = document.getElementById('genreBubblesGrid');
  section.style.display = 'block';
  grid.innerHTML = '';

  GENRES_CATALOG.forEach(genre => {
    const btn = document.createElement('button');
    btn.className = 'genre-bubble-btn';
    btn.innerHTML = `
      <span class="genre-bubble-icon">${genre.icon}</span>
      <span class="genre-bubble-label">${genre.label}</span>
    `;
    btn.onclick = () => loadByGenreDiscover(genre);
    grid.appendChild(btn);
  });

  const surpriseBtn = document.getElementById('surpriseMoodBtn');
  surpriseBtn.onclick = () => {
    const randomGenre = GENRES_CATALOG[Math.floor(Math.random() * GENRES_CATALOG.length)];
    loadByGenreDiscover(randomGenre);
  };
}

let activeDiscoveredGenre = null;
async function loadByGenreDiscover(genre, page = 1) {
  activeDiscoveredGenre = genre;
  document.getElementById('genreMoodSection').style.display = 'none';
  document.getElementById('rowsContainer').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';

  const filterHeader = document.getElementById('filterHeader');
  const gridContainer = document.getElementById('gridContainer');
  filterHeader.style.display = 'flex';
  document.getElementById('filterTitle').textContent = `${genre.icon} ${genre.label}`;

  if (page === 1) {
    gridContainer.style.display = 'grid';
    gridContainer.innerHTML = '';
    showPageLoader();
  }

  try {
    const type = genre.type === 'tv' ? 'tv' : 'movie';
    const data = await fetchTMDB(`/discover/${type}`, {
      with_genres: genre.id,
      sort_by: 'vote_average.desc',
      'vote_count.gte': 300,
      page
    });

    totalPages = data.total_pages || 1;
    const items = (data.results || []).filter(item => item.poster_path).map(item => ({ ...item, media_type: type }));

    hidePageLoader();
    if (items.length > 0) {
      document.getElementById('filterCount').textContent = `${data.total_results || items.length} titres recommandés`;
      items.forEach(item => {
        gridContainer.appendChild(createMediaCard(item));
      });
      setupInfiniteScroll(() => {
        if (currentPage < totalPages && activeDiscoveredGenre === genre) {
          currentPage++;
          loadByGenreDiscover(genre, currentPage);
        }
      });
    } else if (page === 1) {
      showEmptyView('🍿', 'Aucun film trouvé dans cette catégorie.');
    }
  } catch (err) {
    hidePageLoader();
    showEmptyView('⚠️', 'Erreur lors du chargement des films de cette catégorie.');
  }
}

// ===================== VUES CATÉGORIES (FILMS, SÉRIES, TOP) =====================
async function loadCategoryView(category, titleText, page = 1) {
  stopBillboardCycle();
  document.getElementById('billboardHero').style.display = 'none';
  document.getElementById('rowsContainer').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';

  const filterHeader = document.getElementById('filterHeader');
  const gridContainer = document.getElementById('gridContainer');
  filterHeader.style.display = 'flex';
  document.getElementById('filterTitle').textContent = titleText;

  if (page === 1) {
    gridContainer.style.display = 'grid';
    gridContainer.innerHTML = '';
    showPageLoader();
  }

  try {
    let endpoint = '/trending/all/week';
    let params = { page };

    if (category === 'movie') endpoint = '/movie/popular';
    else if (category === 'tv') endpoint = '/tv/popular';
    else if (category === 'top') endpoint = '/trending/all/day';

    const data = await fetchTMDB(endpoint, params);
    totalPages = data.total_pages || 1;
    const items = (data.results || []).filter(item => item.poster_path && (item.title || item.name));

    hidePageLoader();
    if (items.length > 0) {
      document.getElementById('filterCount').textContent = `Page ${page} sur ${totalPages}`;
      items.forEach(item => {
        gridContainer.appendChild(createMediaCard(item));
      });
      setupInfiniteScroll(() => {
        if (currentPage < totalPages) {
          currentPage++;
          loadCategoryView(category, titleText, currentPage);
        }
      });
    } else if (page === 1) {
      showEmptyView('🍿', 'Aucun résultat dans cette catégorie.');
    }
  } catch (err) {
    hidePageLoader();
    showEmptyView('⚠️', 'Erreur lors du chargement des titres.');
  }
}

// ===================== RECHERCHE =====================
async function performSearch(query, page = 1) {
  stopBillboardCycle();
  document.getElementById('billboardHero').style.display = 'none';
  document.getElementById('rowsContainer').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';

  const filterHeader = document.getElementById('filterHeader');
  const gridContainer = document.getElementById('gridContainer');
  filterHeader.style.display = 'flex';
  document.getElementById('filterTitle').textContent = `Résultats pour "${query}"`;

  if (page === 1) {
    gridContainer.style.display = 'grid';
    gridContainer.innerHTML = '';
    showPageLoader();
  }

  try {
    const data = await fetchTMDB('/search/multi', { query, page });
    totalPages = data.total_pages || 1;
    const items = (data.results || []).filter(item => (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path);

    hidePageLoader();
    if (items.length > 0) {
      document.getElementById('filterCount').textContent = `${data.total_results || items.length} titres trouvés`;
      items.forEach(item => {
        gridContainer.appendChild(createMediaCard(item));
      });
    } else if (page === 1) {
      showEmptyView('🔍', `Aucun film ou série ne correspond à "${query}".`, 'Explorez les tendances', () => switchTab('home'));
    }
  } catch (err) {
    hidePageLoader();
    showEmptyView('⚠️', 'Erreur lors de la recherche.');
  }
}

// ===================== MA LISTE & HISTORIQUE =====================
function renderWishlist() {
  stopBillboardCycle();
  document.getElementById('billboardHero').style.display = 'none';
  document.getElementById('rowsContainer').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';

  const filterHeader = document.getElementById('filterHeader');
  const gridContainer = document.getElementById('gridContainer');
  filterHeader.style.display = 'flex';
  document.getElementById('filterTitle').textContent = 'Ma Liste';
  document.getElementById('filterCount').textContent = `${wishlist.length} titres enregistrés`;

  gridContainer.style.display = 'grid';
  gridContainer.innerHTML = '';

  if (wishlist.length === 0) {
    gridContainer.style.display = 'none';
    showEmptyView('⭐', 'Votre liste est vide', 'Ajoutez des films et séries en cliquant sur l\'icône + pour les retrouver ici à tout moment.', 'Découvrir des programmes', () => switchTab('home'));
    return;
  }

  wishlist.forEach(item => {
    gridContainer.appendChild(createMediaCard(item));
  });
}

function renderHistory() {
  stopBillboardCycle();
  document.getElementById('billboardHero').style.display = 'none';
  document.getElementById('rowsContainer').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';

  const filterHeader = document.getElementById('filterHeader');
  const gridContainer = document.getElementById('gridContainer');
  filterHeader.style.display = 'flex';
  document.getElementById('filterTitle').textContent = 'Historique de lecture';
  document.getElementById('filterCount').textContent = `${historyList.length} titres visionnés`;

  gridContainer.style.display = 'grid';
  gridContainer.innerHTML = '';

  if (historyList.length === 0) {
    gridContainer.style.display = 'none';
    showEmptyView('🕒', 'Aucun historique', 'Les films et séries que vous commencez apparaîtront ici pour reprendre instantanément là où vous vous étiez arrêté.', 'Explorer l\'accueil', () => switchTab('home'));
    return;
  }

  const sorted = [...historyList].sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0));
  sorted.forEach(item => {
    gridContainer.appendChild(createMediaCard(item));
  });
}

// ===================== MODALE APERÇU NETFLIX (PREVIEW) =====================
function openPreviewModal(item) {
  currentPreviewMedia = item;
  const isMov = isMovie(item);
  const title = item.title || item.name || '';
  const backdrop = item.backdrop_path ? `${TMDB_IMG_BACKDROP}${item.backdrop_path}` : `${TMDB_IMG_POSTER}${item.poster_path}`;
  const year = (item.release_date || item.first_air_date || '2026').slice(0, 4);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';

  document.getElementById('previewBackdropImg').src = backdrop;
  document.getElementById('previewTitle').textContent = title;
  document.getElementById('previewYear').textContent = year;
  document.getElementById('previewTypeBadge').textContent = isMov ? 'Film' : 'Série';
  document.getElementById('previewRating').textContent = `⭐ ${rating}`;
  document.getElementById('previewOverview').textContent = item.overview || 'Aucun synopsis disponible.';

  updatePreviewWishlistState();
  document.getElementById('previewModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePreviewModal() {
  document.getElementById('previewModal').classList.remove('active');
  document.body.style.overflow = '';
}

function updatePreviewWishlistState() {
  if (!currentPreviewMedia) return;
  const inWish = wishlist.some(w => w.id === currentPreviewMedia.id);
  document.getElementById('previewWishlistIcon').textContent = inWish ? '✓' : '+';
}

// ===================== MODALE LECTEUR VIDÉO (VIDZY + MULTI-SERVEURS) =====================
async function openPlayer(item) {
  currentMedia = item;
  const isMov = isMovie(item);
  const title = item.title || item.name || '';

  document.getElementById('playerMediaTitle').textContent = title;
  document.getElementById('playerSubBadge').textContent = isMov ? 'Film' : 'Série';

  const seriesGroup = document.getElementById('seriesNavGroup');
  if (!isMov) {
    seriesGroup.style.display = 'flex';
    const historyItem = historyList.find(h => h.id === item.id);
    currentSeason = historyItem ? historyItem.season : 1;
    currentEpisode = historyItem ? historyItem.episode : 1;
    await loadSeriesSeasons(item.id, currentSeason, currentEpisode);
  } else {
    seriesGroup.style.display = 'none';
  }

  saveHistory(item, currentSeason, currentEpisode);
  updatePlayerEmbed();
  updateWatchedBtnState();

  document.getElementById('playerModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closePlayer() {
  document.getElementById('playerModal').classList.remove('active');
  document.getElementById('videoIframe').src = '';
  document.body.style.overflow = '';
  currentMedia = null;

  if (currentTab === 'history') renderHistory();
  else if (currentTab === 'wishlist') renderWishlist();
}

async function loadSeriesSeasons(tvId, targetSeason = 1, targetEpisode = 1) {
  const select = document.getElementById('playerSeasonSelect');
  select.innerHTML = '<option>Chargement...</option>';
  try {
    const data = await fetchTMDB(`/tv/${tvId}`);
    const valid = (data.seasons || []).filter(s => s.season_number > 0);
    select.innerHTML = '';
    valid.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.season_number;
      opt.textContent = `Saison ${s.season_number} (${s.episode_count} ép.)`;
      select.appendChild(opt);
    });
    currentSeason = targetSeason;
    select.value = currentSeason;
    await loadSeriesEpisodes(tvId, currentSeason, targetEpisode);
  } catch (err) {
    select.innerHTML = '<option value="1">Saison 1</option>';
    document.getElementById('playerEpisodeSelect').innerHTML = '<option value="1">Épisode 1</option>';
  }
}

async function loadSeriesEpisodes(tvId, seasonNum, targetEpisode = 1) {
  const select = document.getElementById('playerEpisodeSelect');
  select.innerHTML = '<option>Chargement...</option>';
  try {
    const data = await fetchTMDB(`/tv/${tvId}/season/${seasonNum}`);
    select.innerHTML = '';
    (data.episodes || []).forEach(ep => {
      const opt = document.createElement('option');
      opt.value = ep.episode_number;
      opt.textContent = `Ép. ${ep.episode_number} - ${ep.name || 'Épisode ' + ep.episode_number}`;
      select.appendChild(opt);
    });
    currentEpisode = targetEpisode;
    select.value = currentEpisode;
  } catch (err) {
    select.innerHTML = '<option value="1">Épisode 1</option>';
  }
}

function updatePlayerEmbed() {
  if (!currentMedia) return;
  const loader = document.getElementById('playerLoading');
  const iframe = document.getElementById('videoIframe');
  loader.style.display = 'flex';

  const isMov = isMovie(currentMedia);
  const id = currentMedia.id;
  let embedUrl = '';

  const params = new URLSearchParams({ color: 'E50914', autoplay: '1' });
  if (currentLang) params.set('lang', currentLang);

  if (currentServer === 'vidzy') {
    if (isMov) {
      embedUrl = `https://vidzy.org/movie/${id}?${params.toString()}`;
    } else {
      params.set('autonext', '1');
      embedUrl = `https://vidzy.org/serie/${id}/${currentSeason}/${currentEpisode}?${params.toString()}`;
    }
  } else if (currentServer === 'vidsrc') {
    embedUrl = isMov ? `https://vidsrc.to/embed/movie/${id}` : `https://vidsrc.to/embed/tv/${id}/${currentSeason}/${currentEpisode}`;
  } else if (currentServer === 'embedsu') {
    embedUrl = isMov ? `https://embed.su/embed/movie/${id}` : `https://embed.su/embed/tv/${id}/${currentSeason}/${currentEpisode}`;
  } else if (currentServer === 'superembed') {
    embedUrl = isMov ? `https://multiembed.mov/?video_id=${id}&tmdb=1` : `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${currentSeason}&e=${currentEpisode}`;
  }

  iframe.src = embedUrl;
  iframe.onload = () => {
    loader.style.display = 'none';
  };
}

// ===================== GESTION HISTORIQUE & WISHLIST =====================
function saveHistory(item, season = 1, episode = 1) {
  const isMov = isMovie(item);
  const title = item.title || item.name || '';
  const idx = historyList.findIndex(h => h.id === item.id);

  const entry = {
    id: item.id,
    media_type: isMov ? 'movie' : 'tv',
    title,
    poster_path: item.poster_path,
    backdrop_path: item.backdrop_path,
    vote_average: item.vote_average,
    release_date: item.release_date || item.first_air_date,
    overview: item.overview,
    season,
    episode,
    lastWatched: Date.now(),
    completed: idx >= 0 ? historyList[idx].completed : false,
  };

  if (idx >= 0) historyList[idx] = entry;
  else historyList.unshift(entry);

  storageSet(STORAGE_KEYS.history, historyList);
  updateStatsBadges();
}

function toggleWishlist(item) {
  const isMov = isMovie(item);
  const title = item.title || item.name || '';
  const idx = wishlist.findIndex(w => w.id === item.id);

  if (idx >= 0) {
    wishlist.splice(idx, 1);
  } else {
    wishlist.unshift({
      id: item.id,
      media_type: isMov ? 'movie' : 'tv',
      title,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average,
      release_date: item.release_date || item.first_air_date,
      overview: item.overview,
      addedAt: Date.now(),
    });
  }

  storageSet(STORAGE_KEYS.wishlist, wishlist);
  updateStatsBadges();
}

function toggleCompleted(item) {
  const h = historyList.find(entry => entry.id === item.id);
  if (h) {
    h.completed = !h.completed;
  } else {
    saveHistory(item, currentSeason, currentEpisode);
    const created = historyList.find(entry => entry.id === item.id);
    if (created) created.completed = true;
  }
  storageSet(STORAGE_KEYS.history, historyList);
  updateWatchedBtnState();
}

function updateWatchedBtnState() {
  if (!currentMedia) return;
  const h = historyList.find(entry => entry.id === currentMedia.id);
  const btn = document.getElementById('markWatchedBtn');
  const isWatched = h && h.completed;
  btn.classList.toggle('active', !!isWatched);
  btn.textContent = isWatched ? '✓ Vu' : 'Marquer comme vu';
}

function updateStatsBadges() {
  const watched = historyList.length;
  const listed = wishlist.length;

  const mobBadge = document.getElementById('mobWishlistCount');
  if (mobBadge) {
    mobBadge.textContent = listed;
    mobBadge.style.display = listed > 0 ? 'inline-block' : 'none';
  }

  const profileCount = document.getElementById('profileStatsCount');
  if (profileCount) profileCount.textContent = `${watched} vus · ${listed} en liste`;

  const statWatched = document.getElementById('statsWatchedCount');
  const statWishlist = document.getElementById('statsWishlistCount');
  if (statWatched) statWatched.textContent = watched;
  if (statWishlist) statWishlist.textContent = listed;
}

// ===================== SAUVEGARDE & IMPORTATION JSON =====================
function openSettingsModal() {
  document.getElementById('apiKeyInput').value = apiKey;
  updateStatsBadges();
  document.getElementById('settingsModal').classList.add('active');
}

function exportUserData() {
  const data = {
    app: 'Zetflix',
    version: '2.0',
    date: new Date().toISOString(),
    history: historyList,
    wishlist: wishlist,
    notifications: notifications,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `zetflix-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importUserData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.history) {
        historyList = data.history;
        storageSet(STORAGE_KEYS.history, historyList);
      }
      if (data.wishlist) {
        wishlist = data.wishlist;
        storageSet(STORAGE_KEYS.wishlist, wishlist);
      }
      if (data.notifications) {
        notifications = data.notifications;
        storageSet(STORAGE_KEYS.notifications, notifications);
      }
      updateStatsBadges();
      document.getElementById('settingsModal').classList.remove('active');
      alert(`✅ Sauvegarde restaurée avec succès !\n${historyList.length} visionnages et ${wishlist.length} titres en liste.`);
      restoreTab();
    } catch (err) {
      alert('❌ Fichier invalide. Veuillez importer un fichier JSON provenant de Zetflix.');
    }
  };
  reader.readAsText(file);
}

// ===================== NOTIFICATIONS DE NOUVELLES SORTIES =====================
function checkWishlistReleases() {
  const today = new Date().toISOString().slice(0, 10);
  const newReleases = [];

  wishlist.forEach(item => {
    if (item.release_date && item.release_date <= today && !item.notified) {
      item.notified = true;
      newReleases.push(item);
      notifications.unshift({
        id: item.id,
        title: item.title,
        poster_path: item.poster_path,
        date: item.release_date,
        type: item.media_type,
      });
    }
  });

  if (newReleases.length > 0) {
    storageSet(STORAGE_KEYS.wishlist, wishlist);
    storageSet(STORAGE_KEYS.notifications, notifications);
    const badge = document.getElementById('notifBadge');
    badge.textContent = notifications.length;
    badge.style.display = 'block';

    if (Notification.permission === 'granted') {
      newReleases.forEach(r => {
        new Notification(`🎬 ${r.title} est disponible !`, {
          body: 'Ce titre de votre liste Zetflix est maintenant en ligne.',
          icon: `${TMDB_IMG_POSTER}${r.poster_path}`,
        });
      });
    }
  }

  renderNotificationsList();
}

function renderNotificationsList() {
  const container = document.getElementById('notifList');
  if (!container) return;
  if (notifications.length === 0) {
    container.innerHTML = '<p class="empty-text">Aucune nouvelle sortie pour le moment.</p>';
    return;
  }

  container.innerHTML = '';
  notifications.slice(0, 8).forEach(n => {
    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML = `
      <img src="${TMDB_IMG_POSTER}${n.poster_path}" alt="${n.title}">
      <div class="notif-item-info">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-date">Disponible maintenant (${n.date})</div>
      </div>
    `;
    item.onclick = () => {
      openPlayer({ id: n.id, media_type: n.type, title: n.title, poster_path: n.poster_path });
      document.getElementById('notifDropdown').classList.remove('active');
    };
    container.appendChild(item);
  });
}

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(p => {
    if (p === 'granted') {
      document.getElementById('enableNotifBtn').textContent = 'Alertes actives ✓';
      new Notification('Zetflix', { body: 'Les notifications de sorties sont activées !' });
    }
  });
}

// ===================== DÉFILEMENT INFINI (INFINITE SCROLL) =====================
let scrollObserver = null;
function setupInfiniteScroll(callback) {
  const old = document.getElementById('scrollSentinel');
  if (old) old.remove();

  const sentinel = document.createElement('div');
  sentinel.id = 'scrollSentinel';
  sentinel.style.cssText = 'height:1px;margin-top:20px;';
  document.getElementById('netflixContainer').appendChild(sentinel);

  if (scrollObserver) scrollObserver.disconnect();
  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isLoadingMore) {
        callback();
      }
    });
  }, { rootMargin: '300px' });

  scrollObserver.observe(sentinel);
}

// ===================== ÉTATS CHARGEMENT & VIDE =====================
function showPageLoader() {
  document.getElementById('pageLoader').style.display = 'flex';
}

function hidePageLoader() {
  document.getElementById('pageLoader').style.display = 'none';
}

function showEmptyView(icon, title, desc = '', btnText = '', btnCallback = null) {
  const empty = document.getElementById('emptyState');
  document.getElementById('emptyIcon').textContent = icon;
  document.getElementById('emptyTitle').textContent = title;
  document.getElementById('emptyDesc').textContent = desc;

  const btn = document.getElementById('emptyActionBtn');
  if (btnText && btnCallback) {
    btn.style.display = 'inline-flex';
    btn.textContent = btnText;
    btn.onclick = btnCallback;
  } else {
    btn.style.display = 'none';
  }
  empty.style.display = 'block';
}
