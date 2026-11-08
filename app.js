// ===================== CONFIG =====================
const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_W500  = 'https://image.tmdb.org/t/p/w500';
const IMG_ORI   = 'https://image.tmdb.org/t/p/original';

let apiKey = (window.CONFIG && window.CONFIG.TMDB_API_KEY) || localStorage.getItem('tmdb_api_key') || 'b50b12e7db90800c59536e2bbd8f4aa7';
let currentFilter  = localStorage.getItem('moviez_active_tab') || 'all';
let currentSearchQuery = '';
let currentMedia   = null;
let currentSeason  = 1;
let currentEpisode = 1;
let currentLang    = '';
let currentServer  = 'vidzy';
let autoplay       = true;
let searchTimeout  = null;
let searchFilter   = 'all'; // 'all','movie','tv' in search overlay
let recentSearches = JSON.parse(localStorage.getItem('moviez_recent_searches') || '[]');

// Pagination
let currentPage  = 1;
let totalPages   = 1;
let isLoadingMore = false;

// Hover trailer
let hoverTimer = null;
let activeTrailerCard = null;

// ===================== FEATURED (Netflix style) =====================
let featuredItems = [];
let featuredIndex = 0;
let featuredCycleTimer = null;
const CAROUSEL_ROWS = [
  { title: '🔥 Tendances du moment', endpoint: '/trending/all/day', top10: true },
  { title: '🎬 En ce moment au cinéma', endpoint: '/movie/now_playing' },
  { title: '📺 Séries en cours',        endpoint: '/tv/on_the_air' },
  { title: '⭐ Les mieux notés',         endpoint: '/movie/top_rated' },
  { title: '😱 Horreur',                endpoint: '/discover/movie', params: { with_genres: 27 } },
  { title: '🔫 Action & Aventure',       endpoint: '/discover/movie', params: { with_genres: '28,12' } },
  { title: '😂 Comédie',                endpoint: '/discover/movie', params: { with_genres: 35 } },
  { title: '🇫🇷 Films français',         endpoint: '/discover/movie', params: { with_original_language: 'fr' } },
];

const GENRES = [
  { id: 28,    label: 'Action',       icon: '🔥', type: 'movie' },
  { id: 35,    label: 'Comédie',      icon: '😂', type: 'both'  },
  { id: 27,    label: 'Horreur',      icon: '😱', type: 'movie' },
  { id: 53,    label: 'Thriller',     icon: '🧠', type: 'movie' },
  { id: 10749, label: 'Romance',      icon: '💕', type: 'both'  },
  { id: 878,   label: 'Sci-Fi',       icon: '👽', type: 'movie' },
  { id: 18,    label: 'Drame',        icon: '🎭', type: 'both'  },
  { id: 80,    label: 'Crime',        icon: '🕵️', type: 'both'  },
  { id: 16,    label: 'Animation',    icon: '🧚', type: 'both'  },
  { id: 10402, label: 'Musical',      icon: '🎶', type: 'movie' },
  { id: 36,    label: 'Histoire',     icon: '📜', type: 'movie' },
  { id: 99,    label: 'Documentaire', icon: '🌍', type: 'movie' },
];

// ===================== STORAGE =====================
const SK = { history: 'moviez_history', wishlist: 'moviez_wishlist', notifications: 'moviez_notifications' };

function storageGet(key, fb = '[]') {
  try { const v = localStorage.getItem(key); if (v) return JSON.parse(v); } catch(e) {}
  try {
    const m = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
    if (m) return JSON.parse(decodeURIComponent(m[2]));
  } catch(e) {}
  return JSON.parse(fb);
}
function storageSet(key, data) {
  const json = JSON.stringify(data);
  try { localStorage.setItem(key, json); } catch(e) {}
  try {
    const exp = new Date(Date.now() + 365*864e5).toUTCString();
    const trunc = json.length > 3800 ? JSON.stringify(data.slice(0,20)) : json;
    document.cookie = `${key}=${encodeURIComponent(trunc)};expires=${exp};path=/;SameSite=Lax`;
  } catch(e) {}
}

let historyList   = storageGet(SK.history);
let wishlist      = storageGet(SK.wishlist);
let notifications = storageGet(SK.notifications);

// ===================== HELPERS =====================
function isMovieMedia(item) {
  if (!item) return true;
  if (item.media_type === 'tv'    || item.type === 'tv')    return false;
  if (item.media_type === 'movie' || item.type === 'movie') return true;
  if (item.first_air_date || (item.name && !item.release_date)) return false;
  return true;
}

// ===================== TMDB FETCH =====================
async function fetchTMDB(endpoint, params = {}) {
  if (!apiKey) throw new Error('Clé API manquante');
  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('language', 'fr-FR');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers = { Accept: 'application/json' };
  if (apiKey.startsWith('eyJ')) headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  else url.searchParams.set('api_key', apiKey.trim());
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

// ===================== INIT =====================
window.addEventListener('DOMContentLoaded', () => {
  localStorage.setItem('tmdb_api_key', apiKey);
  updateBadges();
  checkWishlistReleases();
  restoreActiveTab();
  setupEventListeners();
  setupInfiniteScroll();
});

// ===================== RESTORE TAB =====================
function restoreActiveTab() {
  setActiveNavBtn(currentFilter);
  if (currentFilter === 'history')      renderHistory();
  else if (currentFilter === 'wishlist') renderWishlist();
  else if (currentFilter === 'genres')   renderGenreSelector();
  else { currentPage = 1; loadContent(1); }
}

function setActiveNavBtn(filter) {
  document.querySelectorAll('.nav-btn, .bnav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
}

// ===================== EVENT LISTENERS =====================
function setupEventListeners() {
  // Logo
  document.getElementById('brandLogo')?.addEventListener('click', () => switchTab('all'));

  // Desktop nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', e => handleNavClick(e.currentTarget));
  });
  // Bottom nav buttons
  document.querySelectorAll('.bnav-btn').forEach(btn => {
    btn.addEventListener('click', e => handleNavClick(e.currentTarget));
  });

  // Search toggle
  document.getElementById('searchToggleBtn')?.addEventListener('click', openSearch);
  document.getElementById('searchCloseBtn')?.addEventListener('click', closeSearch);
  document.getElementById('searchInput')?.addEventListener('input', onSearchInput);
  document.getElementById('clearSearch')?.addEventListener('click', () => {
    document.getElementById('searchInput').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    showRecentSearches();
    currentSearchQuery = '';
  });
  document.querySelectorAll('.sf-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sf-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      searchFilter = btn.dataset.sf;
      const q = document.getElementById('searchInput').value.trim();
      if (q.length >= 2) { currentPage = 1; performSearch(q, 1); }
    });
  });
  document.getElementById('clearRecentBtn')?.addEventListener('click', () => {
    recentSearches = [];
    localStorage.setItem('moviez_recent_searches', '[]');
    renderRecentSearches();
  });

  // Settings modal
  document.getElementById('openSettingsBtn')?.addEventListener('click', openSettings);
  document.getElementById('closeSettingsBtn')?.addEventListener('click', closeSettings);
  document.getElementById('closeSettingsBackdrop')?.addEventListener('click', closeSettings);
  document.getElementById('saveApiKeyBtn')?.addEventListener('click', () => {
    const val = document.getElementById('apiKeyInput').value.trim();
    if (!val) return;
    apiKey = val;
    localStorage.setItem('tmdb_api_key', apiKey);
    closeSettings();
    loadContent(1);
  });
  document.getElementById('exportDataBtn')?.addEventListener('click', exportData);
  document.getElementById('importDataInput')?.addEventListener('change', e => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });
  document.getElementById('enableNotifBtn')?.addEventListener('click', requestNotificationPermission);
  document.getElementById('castBtn')?.addEventListener('click', () => {
    closeSettings();
    document.getElementById('castModal').classList.add('active');
  });

  // Cast modal
  document.getElementById('closeCastBtn')?.addEventListener('click', () => document.getElementById('castModal').classList.remove('active'));
  document.getElementById('closeCastBackdrop')?.addEventListener('click', () => document.getElementById('castModal').classList.remove('active'));
  document.getElementById('copyUrlBtn')?.addEventListener('click', () => {
    const btn = document.getElementById('copyUrlBtn');
    navigator.clipboard.writeText(document.getElementById('localNetworkUrl').textContent);
    btn.textContent = 'Copié !';
    setTimeout(() => btn.textContent = 'Copier', 2000);
  });

  // Player modal
  document.getElementById('closeModalBtn')?.addEventListener('click', closePlayer);
  document.getElementById('closeModalBackdrop')?.addEventListener('click', closePlayer);
  document.getElementById('modalWishlistBtn')?.addEventListener('click', () => {
    if (currentMedia) { toggleWishlist(currentMedia); updateModalWishlistState(); }
  });
  document.getElementById('markCompletedBtn')?.addEventListener('click', () => {
    if (currentMedia) toggleCompleted(currentMedia);
  });

  // Server pills
  document.getElementById('serverPillGroup')?.addEventListener('click', e => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    document.getElementById('serverPillGroup').querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentServer = btn.dataset.server;
    updatePlayerEmbed();
  });

  // Lang pills
  document.getElementById('langPillGroup')?.addEventListener('click', e => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    document.getElementById('langPillGroup').querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentLang = btn.dataset.lang;
    updatePlayerEmbed();
  });

  // Autoplay
  document.getElementById('autoplayToggle')?.addEventListener('change', () => {
    autoplay = document.getElementById('autoplayToggle').checked;
    updatePlayerEmbed();
  });

  // Season / Episode
  document.getElementById('seasonSelect')?.addEventListener('change', async () => {
    currentSeason = parseInt(document.getElementById('seasonSelect').value, 10);
    await loadEpisodes(currentMedia.id, currentSeason);
    saveHistory(currentMedia, currentSeason, currentEpisode);
    updatePlayerEmbed();
  });
  document.getElementById('episodeSelect')?.addEventListener('change', () => {
    currentEpisode = parseInt(document.getElementById('episodeSelect').value, 10);
    saveHistory(currentMedia, currentSeason, currentEpisode);
    updatePlayerEmbed();
  });

  // iframe load
  document.getElementById('videoIframe')?.addEventListener('load', () => {
    document.getElementById('playerLoader').style.display = 'none';
  });

  // History clear
  document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
    if (confirm('Vider tout votre historique ?')) {
      historyList = [];
      storageSet(SK.history, historyList);
      updateBadges();
      renderHistory();
    }
  });

  // Genre grid
  document.getElementById('genreGrid')?.addEventListener('click', e => {
    const b = e.target.closest('[data-genre-index]');
    if (b) loadByGenre(GENRES[Number(b.dataset.genreIndex)]);
  });
  document.getElementById('surpriseBtn')?.addEventListener('click', () =>
    loadByGenre(GENRES[Math.floor(Math.random() * GENRES.length)]));

  // Hero dots (delegated, created dynamically)
  document.getElementById('heroDots')?.addEventListener('click', e => {
    const dot = e.target.closest('.hero-dot');
    if (!dot) return;
    const idx = parseInt(dot.dataset.idx, 10);
    jumpHero(idx);
  });

  // Keyboard ESC closes overlays
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeSearch();
      closePlayer();
      closeSettings();
      document.getElementById('castModal').classList.remove('active');
    }
  });
}

// ===================== NAV CLICK =====================
function handleNavClick(btn) {
  const filter = btn.dataset.filter;
  if (!filter) return;
  currentFilter = filter;
  localStorage.setItem('moviez_active_tab', filter);
  setActiveNavBtn(filter);
  currentSearchQuery = '';
  currentPage = 1; totalPages = 1; isLoadingMore = false;
  if (filter === 'history')      renderHistory();
  else if (filter === 'wishlist') renderWishlist();
  else if (filter === 'genres')   renderGenreSelector();
  else { loadContent(1); }
}

function switchTab(filterName) {
  const btn = document.querySelector(`.bnav-btn[data-filter="${filterName}"], .nav-btn[data-filter="${filterName}"]`);
  if (btn) handleNavClick(btn);
}

// ===================== SEARCH OVERLAY =====================
function openSearch() {
  document.getElementById('searchOverlay').classList.add('active');
  document.getElementById('searchInput').focus();
  renderRecentSearches();
}
function closeSearch() {
  document.getElementById('searchOverlay').classList.remove('active');
  if (!currentSearchQuery) return;
  // If was searching, stay on results
}

function showRecentSearches() {
  const rEl = document.getElementById('recentSearches');
  if (rEl) rEl.style.display = '';
  renderRecentSearches();
}

function onSearchInput(e) {
  const q = e.target.value.trim();
  document.getElementById('clearSearch').style.display = q ? 'block' : 'none';
  const rEl = document.getElementById('recentSearches');
  if (rEl) rEl.style.display = q ? 'none' : '';
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    currentSearchQuery = q;
    if (q.length >= 2) {
      currentPage = 1; totalPages = 1;
      performSearch(q, 1);
    } else if (q.length === 0) {
      currentPage = 1;
      restoreActiveTab();
    }
  }, 380);
}

function renderRecentSearches() {
  const list = document.getElementById('recentList');
  if (!list) return;
  if (recentSearches.length === 0) { list.innerHTML = '<p style="color:var(--muted);font-size:.85rem;padding:4px 0">Aucune recherche récente.</p>'; return; }
  list.innerHTML = recentSearches.slice(0, 8).map(q => `
    <div class="recent-item" data-q="${q.replace(/"/g,'&quot;')}">
      <svg viewBox="0 0 24 24"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 0 .5-4"/></svg>
      ${q}
    </div>`).join('');
  list.querySelectorAll('.recent-item').forEach(item => {
    item.addEventListener('click', () => {
      document.getElementById('searchInput').value = item.dataset.q;
      document.getElementById('clearSearch').style.display = 'block';
      document.getElementById('recentSearches').style.display = 'none';
      currentSearchQuery = item.dataset.q;
      currentPage = 1;
      performSearch(item.dataset.q, 1);
    });
  });
}

function saveRecentSearch(q) {
  recentSearches = [q, ...recentSearches.filter(r => r !== q)].slice(0, 10);
  localStorage.setItem('moviez_recent_searches', JSON.stringify(recentSearches));
}

// ===================== CONTENT LOADING =====================
async function loadContent(page = 1) {
  const catalogContainer = document.getElementById('catalogContainer');
  const catalogHeader    = document.getElementById('catalogHeader');
  const mediaGrid        = document.getElementById('mediaGrid');
  const featuredSection  = document.getElementById('featuredSection');
  const genreSection     = document.getElementById('genreSection');
  const statusMessage    = document.getElementById('statusMessage');

  if (page === 1) {
    genreSection.style.display  = 'none';
    catalogContainer.style.display = 'none';
    mediaGrid.style.display     = 'none';
    catalogHeader.style.display = 'none';
    statusMessage.style.display = 'none';
  }

  // "Tous" → carousels
  if (currentFilter === 'all' && !currentSearchQuery) {
    if (page === 1) {
      catalogContainer.style.display = 'block';
      catalogContainer.innerHTML = '';
      showLoader();
    }
    await buildCarousels();
    return;
  }

  if (page === 1) {
    if (featuredSection) featuredSection.style.display = 'none';
    mediaGrid.innerHTML = '';
    catalogHeader.style.display = 'flex';
    document.getElementById('clearHistoryBtnWrapper').style.display = 'none';
    showLoader();
  }

  try {
    let data, title;
    if (currentFilter === 'movie') {
      title = 'Films Populaires';
      data = await fetchTMDB('/movie/popular', { page });
    } else if (currentFilter === 'tv') {
      title = 'Séries Populaires';
      data = await fetchTMDB('/tv/popular', { page });
    } else {
      title = 'Tendances du moment';
      data = await fetchTMDB('/trending/all/day', { page });
    }

    document.getElementById('sectionTitle').textContent = title;
    totalPages = data.total_pages || 1;
    const items = (data.results || []).filter(i => i.poster_path && (i.title || i.name));

    if (items.length > 0) {
      if (page === 1) { mediaGrid.innerHTML = ''; mediaGrid.style.display = 'grid'; statusMessage.style.display = 'none'; }
      appendCards(items);
      document.getElementById('resultsCount').textContent = `Page ${page}/${totalPages}`;
      setupInfiniteScroll();
    } else if (page === 1) {
      showEmpty('Aucun titre trouvé.');
    }
  } catch (err) {
    showError(err.message);
  } finally {
    isLoadingMore = false;
    hideScrollLoader();
  }
}

// ===================== CAROUSELS =====================
async function buildCarousels() {
  stopFeaturedCycle();
  const catalogContainer = document.getElementById('catalogContainer');
  const statusMessage    = document.getElementById('statusMessage');
  const featuredSection  = document.getElementById('featuredSection');

  const responses = await Promise.allSettled(
    CAROUSEL_ROWS.map(r => fetchTMDB(r.endpoint, r.params || {}))
  );
  if (currentFilter !== 'all' || currentSearchQuery) return;

  catalogContainer.innerHTML = '';
  statusMessage.style.display = 'none';
  let count = 0;
  featuredItems = [];

  responses.forEach((resp, idx) => {
    if (resp.status !== 'fulfilled') return;
    const items = (resp.value.results || []).filter(i => i.poster_path && (i.title || i.name));
    if (!items.length) return;

    // Collect candidates for the Netflix featured layout
    if (idx === 0) featuredItems = items.slice(0, 5);

    const row   = document.createElement('section');
    row.className = 'carousel-row';

    const header = document.createElement('div');
    header.className = 'carousel-header';
    header.innerHTML = `<h3 class="carousel-title">${CAROUSEL_ROWS[idx].title}</h3>`;
    row.appendChild(header);

    const track = document.createElement('div');
    track.className = 'carousel-track';

    items.forEach((item, pos) => {
      const card = buildCard(item, CAROUSEL_ROWS[idx].top10 ? (pos + 1) : null);
      track.appendChild(card);
    });
    row.appendChild(track);

    // Arrow buttons
    ['left','right'].forEach(dir => {
      const btn = document.createElement('button');
      btn.className = `carousel-arrow ${dir}`;
      btn.type = 'button';
      btn.textContent = dir === 'left' ? '‹' : '›';
      btn.onclick = () => track.scrollBy({ left: (dir === 'left' ? -1 : 1) * Math.max(500, track.clientWidth * .8), behavior: 'smooth' });
      row.appendChild(btn);
    });

    catalogContainer.appendChild(row);
    count++;
  });

  hideScrollLoader();
  isLoadingMore = false;
  document.getElementById('resultsCount').textContent = '';

  // Start featured header
  if (featuredItems.length > 0) {
    featuredIndex = 0;
    renderFeatured(featuredItems[featuredIndex]);
    renderFeaturedSideItems();
    if (featuredSection) featuredSection.style.display = 'block';
    startFeaturedCycle();
  }
}

// ===================== FEATURED (Netflix Style) =====================
function renderFeatured(item) {
  const isMovie = isMovieMedia(item);
  const title   = item.name || item.title || '';
  const imgUrl  = item.backdrop_path ? `${IMG_ORI}${item.backdrop_path}` : `${IMG_W500}${item.poster_path}`;

  const featuredImg = document.getElementById('featuredImg');
  const featuredTitle = document.getElementById('featuredCardTitle');
  const featuredOverview = document.getElementById('featuredOverview');
  const featuredMeta = document.getElementById('featuredMetaRow');
  const featuredPlay = document.getElementById('featuredPlayBtn');
  const featuredCardPlay = document.getElementById('featuredCardPlay');
  const featuredWishlistBtn = document.getElementById('featuredWishlistBtn');
  const featuredWishlistText = document.getElementById('featuredWishlistText');

  if (featuredImg) featuredImg.src = imgUrl;
  if (featuredTitle) featuredTitle.textContent = title;
  if (featuredOverview) featuredOverview.textContent = item.overview || 'Aucun résumé disponible pour le moment.';

  const rating = item.vote_average ? item.vote_average.toFixed(1) : null;
  const year   = (item.release_date || item.first_air_date || '').slice(0, 4);
  const typeLabel = isMovie ? 'Film' : 'Série';

  if (featuredMeta) {
    featuredMeta.innerHTML = [
      `<span style="color:var(--text);font-weight:700;">${typeLabel}</span>`,
      year ? `<span class="featured-meta-dot"></span><span>${year}</span>` : '',
      rating ? `<span class="featured-meta-dot"></span><span class="featured-meta-highlight">★ ${rating}</span>` : '',
      `<span class="featured-meta-dot"></span><span>HD</span>`
    ].filter(Boolean).join('');
  }

  const playAction = () => openPlayer({ ...item, media_type: isMovie ? 'movie' : 'tv' });
  if (featuredPlay) featuredPlay.onclick = playAction;
  if (featuredCardPlay) featuredCardPlay.onclick = (e) => { e.stopPropagation(); playAction(); };
  const cardWrap = document.getElementById('featuredCardWrap');
  if (cardWrap) cardWrap.onclick = playAction;

  const inWish = wishlist.some(w => w.id === item.id);
  if (featuredWishlistText) featuredWishlistText.textContent = inWish ? '✓ Dans ma liste' : '+ Ma liste';
  if (featuredWishlistBtn) {
    featuredWishlistBtn.onclick = () => {
      toggleWishlist({ ...item, media_type: isMovie ? 'movie' : 'tv' });
      const nowIn = wishlist.some(w => w.id === item.id);
      if (featuredWishlistText) featuredWishlistText.textContent = nowIn ? '✓ Dans ma liste' : '+ Ma liste';
    };
  }
}

function renderFeaturedSideItems() {
  const container = document.getElementById('featuredSideCards');
  if (!container) return;
  container.innerHTML = '';

  featuredItems.forEach((item, idx) => {
    if (idx === featuredIndex) return; // on affiche les autres
    const sideItem = document.createElement('div');
    sideItem.className = 'featured-side-item';
    const poster = item.poster_path ? `${IMG_W500}${item.poster_path}` : (item.backdrop_path ? `${IMG_W500}${item.backdrop_path}` : '');
    const title = item.name || item.title || '';

    sideItem.innerHTML = `
      <img src="${poster}" alt="${title}" loading="lazy">
      <div class="featured-side-item-title">${title}</div>
    `;

    sideItem.onclick = () => {
      featuredIndex = idx;
      renderFeatured(featuredItems[featuredIndex]);
      renderFeaturedSideItems();
      restartFeaturedCycle();
    };

    container.appendChild(sideItem);
  });
}

function startFeaturedCycle() {
  featuredCycleTimer = setInterval(() => {
    if (!featuredItems.length) return;
    featuredIndex = (featuredIndex + 1) % featuredItems.length;
    renderFeatured(featuredItems[featuredIndex]);
    renderFeaturedSideItems();
  }, 8000);
}

function stopFeaturedCycle() {
  if (featuredCycleTimer) {
    clearInterval(featuredCycleTimer);
    featuredCycleTimer = null;
  }
}

function restartFeaturedCycle() {
  stopFeaturedCycle();
  startFeaturedCycle();
}

// ===================== CARD BUILDER =====================
function buildCard(item, rank = null) {
  const isMovie = isMovieMedia(item);
  const type    = isMovie ? 'movie' : 'tv';
  const title   = item.title || item.name || '';
  const poster  = `${IMG_W500}${item.poster_path}`;
  const rating  = item.vote_average ? item.vote_average.toFixed(1) : 'NR';

  const card = document.createElement('article');
  card.className = 'media-card carousel-card';
  if (rank) {
    card.classList.add('top10');
    card.dataset.rank = rank;
  }

  card.innerHTML = `
    <div class="poster-wrapper">
      <img src="${poster}" alt="${title}" loading="lazy">
      <span class="card-type-tag">${isMovie ? 'Film' : 'Série'}</span>
      <span class="card-rating-tag">★ ${rating}</span>
      <div class="card-play-overlay"><div class="play-circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="#111" stroke="none"/></svg></div></div>
      <div class="trailer-overlay" hidden><div class="trailer-frame"></div><div class="trailer-fade-bottom"></div><div class="trailer-info"></div></div>
    </div>
    <div class="card-info">
      <div class="card-title"></div>
    </div>`;

  card.querySelector('.card-title').textContent = title;
  card.addEventListener('click', e => { if (!e.target.closest('.trailer-overlay')) openPlayer({ ...item, media_type: type }); });
  initCardHover(card, { ...item, media_type: type });
  return card;
}

function appendCards(items) { renderGrid(items, 'standard', true); }

// ===================== GRID RENDER =====================
function renderGrid(items, mode = 'standard', append = false) {
  const mediaGrid     = document.getElementById('mediaGrid');
  const statusMessage = document.getElementById('statusMessage');
  statusMessage.style.display = 'none';
  mediaGrid.style.display     = 'grid';
  if (!append) mediaGrid.innerHTML = '';

  items.forEach(item => {
    const isMovie  = isMovieMedia(item);
    const type     = isMovie ? 'movie' : 'tv';
    const title    = item.name || item.title || '';
    const year     = (item.release_date || item.first_air_date || '').slice(0, 4);
    const rating   = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
    const poster   = `${IMG_W500}${item.poster_path}`;

    const historyItem = historyList.find(h => h.id === item.id);
    const inWishlist  = wishlist.some(w => w.id === item.id);

    let progressBadge = '';
    if (historyItem) {
      if (historyItem.completed)       progressBadge = `<span class="card-progress-badge completed">✓ Vu</span>`;
      else if (historyItem.type==='tv') progressBadge = `<span class="card-progress-badge">S${historyItem.season} E${historyItem.episode}</span>`;
      else                             progressBadge = `<span class="card-progress-badge">En cours</span>`;
    }

    const card = document.createElement('div');
    card.className = 'media-card';
    card.innerHTML = `
      <div class="poster-wrapper">
        <img src="${poster}" alt="${title}" loading="lazy">
        <span class="card-type-tag">${isMovie ? 'Film' : 'Série'}</span>
        <span class="card-rating-tag">★ ${rating}</span>
        ${progressBadge}
        <div class="card-quick-actions">
          <button class="card-act-btn quick-wishlist-btn" title="${inWishlist ? 'Retirer de ma liste' : 'Ajouter à ma liste'}">${inWishlist ? '★' : '☆'}</button>
          ${mode==='history'  ? '<button class="card-act-btn quick-remove-history-btn" title="Supprimer">✕</button>' : ''}
          ${mode==='wishlist' ? '<button class="card-act-btn quick-remove-wishlist-btn" title="Retirer">✕</button>' : ''}
        </div>
        <div class="card-play-overlay"><div class="play-circle"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="#111" stroke="none"/></svg></div></div>
      </div>
      <div class="card-info">
        <div class="card-title" title="${title}">${title}</div>
        <div class="card-meta-row"><span>${year}</span><span>${inWishlist ? '⭐' : ''}</span></div>
      </div>`;

    card.addEventListener('click', e => { if (e.target.closest('.card-act-btn')) return; openPlayer({ ...item, media_type: type }); });

    card.querySelector('.quick-wishlist-btn').addEventListener('click', e => {
      e.stopPropagation(); toggleWishlist({ ...item, media_type: type }); renderGrid(items, mode);
    });
    const qh = card.querySelector('.quick-remove-history-btn');
    if (qh) qh.addEventListener('click', e => {
      e.stopPropagation(); historyList = historyList.filter(h => h.id !== item.id);
      storageSet(SK.history, historyList); updateBadges(); renderHistory();
    });
    const qw = card.querySelector('.quick-remove-wishlist-btn');
    if (qw) qw.addEventListener('click', e => {
      e.stopPropagation(); wishlist = wishlist.filter(w => w.id !== item.id);
      storageSet(SK.wishlist, wishlist); updateBadges(); renderWishlist();
    });

    mediaGrid.appendChild(card);
  });
}

// ===================== HISTORY / WISHLIST =====================
function renderHistory() {
  const featuredSection = document.getElementById('featuredSection');
  const catalogContainer = document.getElementById('catalogContainer');
  const catalogHeader = document.getElementById('catalogHeader');
  const mediaGrid = document.getElementById('mediaGrid');
  const genreSection = document.getElementById('genreSection');
  const statusMessage = document.getElementById('statusMessage');

  stopFeaturedCycle();
  if (featuredSection) featuredSection.style.display = 'none';
  catalogContainer.style.display = 'none';
  genreSection.style.display = 'none';
  catalogHeader.style.display = 'flex';
  document.getElementById('sectionTitle').textContent = 'Reprendre la lecture';
  document.getElementById('resultsCount').textContent = `${historyList.length} titres`;
  document.getElementById('clearHistoryBtnWrapper').style.display = historyList.length ? 'block' : 'none';

  if (!historyList.length) {
    mediaGrid.innerHTML = ''; mediaGrid.style.display = 'none';
    showEmptyState('🕒', 'Aucun visionnage', 'Les films et séries que vous commencez apparaîtront ici.', 'Explorer', () => switchTab('all'));
    return;
  }
  statusMessage.style.display = 'none';
  renderGrid([...historyList].sort((a, b) => (b.lastWatched||0) - (a.lastWatched||0)), 'history');
}

function renderWishlist() {
  const featuredSection = document.getElementById('featuredSection');
  const catalogContainer = document.getElementById('catalogContainer');
  const catalogHeader = document.getElementById('catalogHeader');
  const mediaGrid = document.getElementById('mediaGrid');
  const genreSection = document.getElementById('genreSection');
  const statusMessage = document.getElementById('statusMessage');

  stopFeaturedCycle();
  if (featuredSection) featuredSection.style.display = 'none';
  catalogContainer.style.display = 'none';
  genreSection.style.display = 'none';
  catalogHeader.style.display = 'flex';
  document.getElementById('sectionTitle').textContent = 'Ma Liste';
  document.getElementById('resultsCount').textContent = `${wishlist.length} titres`;
  document.getElementById('clearHistoryBtnWrapper').style.display = 'none';

  if (!wishlist.length) {
    mediaGrid.innerHTML = ''; mediaGrid.style.display = 'none';
    showEmptyState('⭐', 'Votre liste est vide', "Cliquez sur ☆ sur une affiche pour l'ajouter ici.", 'Découvrir des films', () => switchTab('movie'));
    return;
  }
  statusMessage.style.display = 'none';
  renderGrid([...wishlist].sort((a, b) => (b.addedAt||0) - (a.addedAt||0)), 'wishlist');
}

// ===================== GENRE SELECTOR =====================
function renderGenreSelector() {
  const featuredSection = document.getElementById('featuredSection');
  const catalogContainer = document.getElementById('catalogContainer');
  const catalogHeader = document.getElementById('catalogHeader');
  const mediaGrid = document.getElementById('mediaGrid');
  const genreSection = document.getElementById('genreSection');
  const statusMessage = document.getElementById('statusMessage');

  stopFeaturedCycle();
  if (featuredSection) featuredSection.style.display = 'none';
  catalogContainer.style.display = 'none';
  catalogHeader.style.display = 'none';
  mediaGrid.style.display = 'none';
  statusMessage.style.display = 'none';
  genreSection.style.display = 'block';

  const grid = document.getElementById('genreGrid');
  grid.innerHTML = '';
  GENRES.forEach((g, i) => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'genre-bubble'; btn.dataset.genreIndex = i;
    btn.innerHTML = `<span class="genre-icon">${g.icon}</span><span class="genre-label">${g.label}</span>`;
    grid.appendChild(btn);
  });
}

// ===================== LOAD BY GENRE =====================
let activeGenre = null;
async function loadByGenre(genre, page = 1) {
  activeGenre = genre;
  const featuredSection = document.getElementById('featuredSection');
  const catalogContainer = document.getElementById('catalogContainer');
  const catalogHeader = document.getElementById('catalogHeader');
  const mediaGrid = document.getElementById('mediaGrid');
  const genreSection = document.getElementById('genreSection');

  stopFeaturedCycle();
  genreSection.style.display = 'none';
  catalogContainer.style.display = 'none';
  catalogHeader.style.display = 'flex';
  if (featuredSection) featuredSection.style.display = 'none';
  document.getElementById('sectionTitle').textContent = `${genre.icon} ${genre.label}`;

  if (page === 1) { currentPage = 1; mediaGrid.innerHTML = ''; showLoader(); }

  try {
    const types = genre.type === 'both' ? ['movie','tv'] : [genre.type];
    const resps = await Promise.all(types.map(t =>
      fetchTMDB(`/discover/${t}`, { with_genres: genre.id, sort_by: 'vote_average.desc', 'vote_count.gte': 100, page })
    ));
    if (activeGenre !== genre) return;
    totalPages = Math.max(...resps.map(d => d.total_pages || 1));
    const items = resps.flatMap((d, i) => (d.results || []).map(it => ({ ...it, media_type: types[i] })))
      .filter(it => it.poster_path).sort((a, b) => (b.vote_average||0) - (a.vote_average||0));
    document.getElementById('resultsCount').textContent = `${items.length} titres`;
    appendCards(items); currentPage = page; setupInfiniteScroll();
  } catch(err) { showError(err.message); }
  finally { isLoadingMore = false; hideScrollLoader(); }
}

// ===================== SEARCH =====================
async function performSearch(query, page = 1) {
  const featuredSection = document.getElementById('featuredSection');
  const catalogContainer = document.getElementById('catalogContainer');
  const catalogHeader = document.getElementById('catalogHeader');
  const mediaGrid = document.getElementById('mediaGrid');
  const genreSection = document.getElementById('genreSection');
  const statusMessage = document.getElementById('statusMessage');

  if (page === 1) {
    stopFeaturedCycle();
    if (featuredSection) featuredSection.style.display = 'none';
    catalogContainer.style.display = 'none';
    genreSection.style.display = 'none';
    catalogHeader.style.display = 'flex';
    document.getElementById('clearHistoryBtnWrapper').style.display = 'none';
    document.getElementById('sectionTitle').textContent = `Résultats pour "${query}"`;
    showLoader();
  }

  try {
    const data = await fetchTMDB('/search/multi', { query, page });
    totalPages = data.total_pages || 1;
    let items = (data.results || []).filter(i => (i.media_type === 'movie' || i.media_type === 'tv') && i.poster_path);
    if (searchFilter === 'movie') items = items.filter(i => i.media_type === 'movie');
    if (searchFilter === 'tv')    items = items.filter(i => i.media_type === 'tv');

    if (items.length > 0) {
      if (page === 1) { mediaGrid.innerHTML = ''; mediaGrid.style.display = 'grid'; statusMessage.style.display = 'none'; }
      appendCards(items);
      document.getElementById('resultsCount').textContent = `${data.total_results || items.length} résultats`;
      setupInfiniteScroll();
      saveRecentSearch(query);
    } else if (page === 1) {
      showEmpty(`Aucun résultat pour "${query}".`);
    }
  } catch(err) { showError(err.message); }
  finally { isLoadingMore = false; hideScrollLoader(); }
}

// ===================== INFINITE SCROLL =====================
let scrollObserver = null;
function setupInfiniteScroll() {
  const old = document.getElementById('scrollSentinel');
  if (old) old.remove();
  const sentinel = document.createElement('div');
  sentinel.id = 'scrollSentinel';
  sentinel.style.cssText = 'height:1px;margin-top:16px;';
  document.querySelector('.main-container').appendChild(sentinel);
  if (scrollObserver) scrollObserver.disconnect();
  scrollObserver = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting && !isLoadingMore && currentPage < totalPages) loadMore(); });
  }, { rootMargin: '300px' });
  scrollObserver.observe(sentinel);
}

function loadMore() {
  if (isLoadingMore || currentPage >= totalPages) return;
  isLoadingMore = true; currentPage++; showScrollLoader();
  if (currentSearchQuery) performSearch(currentSearchQuery, currentPage);
  else if (activeGenre)   loadByGenre(activeGenre, currentPage);
  else if (['movie','tv'].includes(currentFilter)) loadContent(currentPage);
}

function showScrollLoader() {
  let l = document.getElementById('scrollLoader');
  if (!l) { l = document.createElement('div'); l.id = 'scrollLoader'; l.innerHTML = '<div class="scroll-loading"><div class="spinner"></div><span>Chargement...</span></div>'; document.querySelector('.main-container').appendChild(l); }
  l.style.display = 'flex';
}
function hideScrollLoader() { const l = document.getElementById('scrollLoader'); if (l) l.style.display = 'none'; }

// ===================== PLAYER =====================
async function openPlayer(item) {
  currentMedia = item;
  const isMovie = isMovieMedia(item);
  const title   = item.name || item.title || '';
  const year    = (item.release_date || item.first_air_date || '').slice(0,4);

  document.getElementById('modalMediaTitle').textContent = title;
  document.getElementById('modalMediaType').textContent  = isMovie ? 'Film' : 'Série';
  document.getElementById('modalRating').textContent     = `⭐ ${item.vote_average ? item.vote_average.toFixed(1) : 'NR'}`;
  document.getElementById('modalReleaseDate').textContent = year;
  document.getElementById('modalOverview').textContent   = item.overview || '';

  updateModalWishlistState();
  updateModalCompletedState();

  const seriesControls = document.getElementById('seriesControls');
  const modalCurrentEpBadge = document.getElementById('modalCurrentEpBadge');
  if (!isMovie) {
    seriesControls.style.display = 'flex';
    modalCurrentEpBadge.style.display = 'inline-block';
    const h = historyList.find(h => h.id === item.id);
    currentSeason = h ? h.season : 1;
    currentEpisode = h ? h.episode : 1;
    await loadSeasons(item.id, currentSeason, currentEpisode);
  } else {
    seriesControls.style.display = 'none';
    modalCurrentEpBadge.style.display = 'none';
  }

  saveHistory(item, currentSeason, currentEpisode);
  updatePlayerEmbed();
  document.getElementById('playerModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function updateModalWishlistState() {
  if (!currentMedia) return;
  const inW = wishlist.some(w => w.id === currentMedia.id);
  document.getElementById('modalWishlistBtn').classList.toggle('active', inW);
}
function updateModalCompletedState() {
  if (!currentMedia) return;
  const h = historyList.find(h => h.id === currentMedia.id);
  const done = h && h.completed;
  const btn = document.getElementById('markCompletedBtn');
  btn.classList.toggle('active', !!done);
  btn.textContent = done ? '✓ Vu (Terminé)' : '✓ Marquer comme vu';
}

async function loadSeasons(tvId, targetSeason = 1, targetEpisode = 1) {
  const ss = document.getElementById('seasonSelect');
  ss.innerHTML = '<option>Chargement...</option>';
  try {
    const d = await fetchTMDB(`/tv/${tvId}`);
    const valid = (d.seasons || []).filter(s => s.season_number > 0);
    ss.innerHTML = '';
    valid.forEach(s => { const o = document.createElement('option'); o.value = s.season_number; o.textContent = `Saison ${s.season_number} (${s.episode_count} ép.)`; ss.appendChild(o); });
    currentSeason = targetSeason; ss.value = currentSeason;
    await loadEpisodes(tvId, currentSeason, targetEpisode);
  } catch(e) { ss.innerHTML = '<option value="1">Saison 1</option>'; document.getElementById('episodeSelect').innerHTML = '<option value="1">Épisode 1</option>'; }
}
async function loadEpisodes(tvId, seasonNum, targetEpisode = 1) {
  const es = document.getElementById('episodeSelect');
  es.innerHTML = '<option>Chargement...</option>';
  try {
    const d = await fetchTMDB(`/tv/${tvId}/season/${seasonNum}`);
    es.innerHTML = '';
    (d.episodes || []).forEach(ep => { const o = document.createElement('option'); o.value = ep.episode_number; o.textContent = `Ép. ${ep.episode_number} – ${ep.name || 'Épisode '+ep.episode_number}`; es.appendChild(o); });
    currentEpisode = targetEpisode; es.value = currentEpisode;
    document.getElementById('modalCurrentEpBadge').textContent = `S${seasonNum}:E${currentEpisode}`;
  } catch(e) { es.innerHTML = '<option value="1">Épisode 1</option>'; }
}

function updatePlayerEmbed() {
  if (!currentMedia) return;
  document.getElementById('playerLoader').style.display = 'flex';
  const isMovie = isMovieMedia(currentMedia);
  const id = currentMedia.id;
  const p  = new URLSearchParams({ color: 'e50914' });
  if (autoplay) p.set('autoplay', '1');
  if (currentLang) p.set('lang', currentLang);
  let url = '';
  if (currentServer === 'vidzy') {
    url = isMovie ? `https://vidzy.org/movie/${id}?${p}` : (p.set('autonext','1'), `https://vidzy.org/serie/${id}/${currentSeason}/${currentEpisode}?${p}`);
  } else if (currentServer === 'vidsrc') {
    url = isMovie ? `https://vidsrc.to/embed/movie/${id}` : `https://vidsrc.to/embed/tv/${id}/${currentSeason}/${currentEpisode}`;
  } else if (currentServer === 'embedsu') {
    url = isMovie ? `https://embed.su/embed/movie/${id}` : `https://embed.su/embed/tv/${id}/${currentSeason}/${currentEpisode}`;
  } else {
    url = isMovie ? `https://multiembed.mov/?video_id=${id}&tmdb=1` : `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${currentSeason}&e=${currentEpisode}`;
  }
  document.getElementById('videoIframe').src = url;
}

function closePlayer() {
  document.getElementById('playerModal').classList.remove('active');
  document.getElementById('videoIframe').src = '';
  document.body.style.overflow = '';
  currentMedia = null;
  if (currentFilter === 'history')      renderHistory();
  else if (currentFilter === 'wishlist') renderWishlist();
}

// ===================== HISTORY SAVE =====================
function saveHistory(item, season = 1, episode = 1) {
  const isMovie = isMovieMedia(item);
  const title   = item.name || item.title || '';
  const idx     = historyList.findIndex(h => h.id === item.id);
  const entry = {
    id: item.id, media_type: isMovie ? 'movie' : 'tv', title, name: title,
    poster_path: item.poster_path, vote_average: item.vote_average,
    release_date: item.release_date || item.first_air_date,
    season, episode, lastWatched: Date.now(),
    completed: idx >= 0 ? historyList[idx].completed : false,
  };
  if (idx >= 0) historyList[idx] = entry; else historyList.unshift(entry);
  storageSet(SK.history, historyList); updateBadges();
}

function toggleCompleted(item) {
  const h = historyList.find(h => h.id === item.id);
  if (h) h.completed = !h.completed;
  else { saveHistory(item, currentSeason, currentEpisode); const c = historyList.find(h => h.id === item.id); if (c) c.completed = true; }
  storageSet(SK.history, historyList); updateModalCompletedState(); updateBadges();
}

// ===================== WISHLIST =====================
function toggleWishlist(item) {
  const isMovie = isMovieMedia(item);
  const title   = item.name || item.title || '';
  const idx     = wishlist.findIndex(w => w.id === item.id);
  if (idx >= 0) { wishlist.splice(idx, 1); }
  else { wishlist.unshift({ id: item.id, media_type: isMovie ? 'movie' : 'tv', title, name: title, poster_path: item.poster_path, vote_average: item.vote_average, release_date: item.release_date || item.first_air_date, overview: item.overview, addedAt: Date.now(), notified: false }); }
  storageSet(SK.wishlist, wishlist); updateBadges(); checkWishlistReleases();
}

// ===================== BADGES =====================
function updateBadges() {
  const hb = document.getElementById('historyBadgeCount');
  const wb = document.getElementById('wishlistBadgeCount');
  if (hb) { hb.textContent = historyList.length; hb.style.display = historyList.length ? 'inline-block' : 'none'; }
  if (wb) { wb.textContent = wishlist.length;     wb.style.display = wishlist.length ? 'inline-block' : 'none'; }
}

// ===================== NOTIFICATIONS =====================
function checkWishlistReleases() {
  const today = new Date().toISOString().slice(0,10);
  const newR  = [];
  wishlist.forEach(item => {
    if (item.release_date && item.release_date <= today && !item.notified) {
      item.notified = true; newR.push(item);
      notifications.unshift({ id: item.id, title: item.title||item.name, poster_path: item.poster_path, date: item.release_date, type: item.media_type });
    }
  });
  if (newR.length) {
    storageSet(SK.wishlist, wishlist); storageSet(SK.notifications, notifications);
    if (Notification.permission === 'granted') {
      newR.forEach(r => new Notification(`🎬 ${r.title||r.name}`, { body: 'Disponible maintenant !', icon: `${IMG_W500}${r.poster_path}` }));
    }
  }
}

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(p => {
    if (p === 'granted') {
      const btn = document.getElementById('enableNotifBtn');
      if (btn) { btn.textContent = '🔔 Alertes actives ✓'; btn.style.color = 'var(--green)'; }
      new Notification('MovieZ', { body: 'Notifications activées !' });
    }
  });
}

// ===================== SETTINGS =====================
function openSettings() {
  document.getElementById('statsHistory').textContent  = historyList.length;
  document.getElementById('statsWishlist').textContent = wishlist.length;
  document.getElementById('apiKeyInput').value = apiKey;
  document.getElementById('settingsModal').classList.add('active');
}
function closeSettings() { document.getElementById('settingsModal').classList.remove('active'); }

// ===================== EXPORT / IMPORT =====================
function exportData() {
  const data = { version: '1.3', exportDate: new Date().toISOString(), history: historyList, wishlist, notifications };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `moviez-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
}
function importData(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.history && !data.wishlist) throw new Error('Format invalide');
      if (data.history)       { historyList = data.history; storageSet(SK.history, historyList); }
      if (data.wishlist)      { wishlist    = data.wishlist; storageSet(SK.wishlist, wishlist); }
      if (data.notifications) { notifications = data.notifications; storageSet(SK.notifications, notifications); }
      updateBadges(); closeSettings();
      alert(`✅ Importé ! ${historyList.length} vus · ${wishlist.length} en liste`);
    } catch(err) { alert('❌ Fichier invalide.'); }
  };
  reader.readAsText(file);
}

// ===================== TRAILER HOVER =====================
function initCardHover(card, item) {
  if (window.matchMedia('(hover:none)').matches) return;
  card.addEventListener('mouseenter', () => {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(async () => {
      const key = await getTrailerKey(item.id, isMovieMedia(item) ? 'movie' : 'tv');
      if (key && card.matches(':hover')) showTrailer(card, item, key);
    }, 1500);
  });
  card.addEventListener('mouseleave', () => { clearTimeout(hoverTimer); hideTrailer(card); });
}

async function getTrailerKey(id, type) {
  const ck = `moviez_trailer_${type}_${id}`; const c = sessionStorage.getItem(ck); if (c) return c;
  for (const lang of ['fr-FR','en-US']) {
    try { const d = await fetchTMDB(`/${type}/${id}/videos`, { language: lang }); const t = (d.results||[]).find(v => v.site==='YouTube'&&v.type==='Trailer'&&v.key); if (t) { sessionStorage.setItem(ck,t.key); return t.key; } } catch(e) {}
  }
  return null;
}

function showTrailer(card, item, key) {
  if (activeTrailerCard && activeTrailerCard !== card) hideTrailer(activeTrailerCard);
  const ov = card.querySelector('.trailer-overlay');
  if (!ov || !window.YT || !YT.Player) return;
  ov.hidden = false; card.classList.add('trailer-active');
  ov.querySelector('.trailer-info').textContent = item.title || item.name || '';
  const target = document.createElement('div'); ov.querySelector('.trailer-frame').replaceChildren(target);
  try {
    const player = new YT.Player(target, { videoId: key, playerVars: { autoplay:1, mute:1, controls:0, modestbranding:1, playsinline:1, loop:1, playlist:key }, events: { onReady: e=>e.target.playVideo(), onStateChange: e=>{ if(e.data===YT.PlayerState.ENDED) e.target.playVideo(); } } });
    ov._player = player; activeTrailerCard = card;
  } catch(e) { ov.hidden=true; card.classList.remove('trailer-active'); }
}
function hideTrailer(card) {
  const ov = card && card.querySelector('.trailer-overlay'); if (!ov) return;
  try { if (ov._player) ov._player.destroy(); } catch(e) {}
  ov._player = null; ov.hidden = true; ov.querySelector('.trailer-frame').replaceChildren(); card.classList.remove('trailer-active');
  if (activeTrailerCard === card) activeTrailerCard = null;
}

// ===================== STATUS HELPERS =====================
function showLoader() {
  const sm = document.getElementById('statusMessage');
  const mg = document.getElementById('mediaGrid');
  sm.innerHTML = '<div class="spinner" style="margin:0 auto;width:36px;height:36px;flex-shrink:0"></div>';
  sm.style.display = 'block'; mg.style.display = 'none';
}
function showEmpty(msg) {
  const sm = document.getElementById('statusMessage');
  const mg = document.getElementById('mediaGrid');
  sm.textContent = msg; sm.style.display = 'block'; mg.style.display = 'none';
}
function showEmptyState(icon, title, desc, actionText, actionCb) {
  const sm = document.getElementById('statusMessage');
  const mg = document.getElementById('mediaGrid');
  sm.style.display = 'block'; mg.style.display = 'none'; mg.innerHTML = '';
  sm.innerHTML = `<div class="empty-state-box"><div class="empty-state-icon">${icon}</div><h3>${title}</h3><p>${desc}</p>${actionText ? `<button id="esaBtn" class="btn btn-primary" style="margin-top:16px">${actionText}</button>` : ''}</div>`;
  if (actionText && actionCb) { const b = document.getElementById('esaBtn'); if (b) b.onclick = actionCb; }
}
function showError(msg) {
  const sm = document.getElementById('statusMessage');
  const mg = document.getElementById('mediaGrid');
  sm.innerHTML = `⚠️ <strong>${msg}</strong><br><br><button class="btn btn-primary" onclick="openSettings()">Vérifier la clé TMDB</button>`;
  sm.style.display = 'block'; mg.style.display = 'none';
}
