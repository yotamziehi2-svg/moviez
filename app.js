// Configuration TMDB & Vidzy
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';

// État de l'application
let apiKey = (window.CONFIG && window.CONFIG.TMDB_API_KEY) || localStorage.getItem('tmdb_api_key') || 'b50b12e7db90800c59536e2bbd8f4aa7';
let currentFilter = localStorage.getItem('moviez_active_tab') || 'all'; // 'all', 'movie', 'tv', 'history', 'wishlist'
let currentSearchQuery = '';
let currentMedia = null;
let currentSeason = 1;
let currentEpisode = 1;
let currentLang = '';
let currentServer = 'vidzy'; // 'vidzy', 'vidsrc', 'embedsu', 'superembed'
let autoplay = true;
let searchTimeout = null;

// Pagination / Infinite Scroll
let currentPage = 1;
let totalPages = 1;
let isLoadingMore = false;
let heroShown = false;

// Helper pour détecter fidèlement si un média est un film ou une série
function isMovieMedia(item) {
  if (!item) return true;
  if (item.media_type === 'tv' || item.type === 'tv') return false;
  if (item.media_type === 'movie' || item.type === 'movie') return true;
  if (item.first_air_date || (item.name && !item.release_date)) return false;
  return true;
}

// Stockage Local : Historique et Wishlist
let historyList = JSON.parse(localStorage.getItem('moviez_history') || '[]');
let wishlist = JSON.parse(localStorage.getItem('moviez_wishlist') || '[]');
let notifications = JSON.parse(localStorage.getItem('moviez_notifications') || '[]');

// Éléments du DOM
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const mediaGrid = document.getElementById('mediaGrid');
const statusMessage = document.getElementById('statusMessage');
const sectionTitle = document.getElementById('sectionTitle');
const resultsCount = document.getElementById('resultsCount');
const navButtons = document.querySelectorAll('.nav-btn');
const historyBadgeCount = document.getElementById('historyBadgeCount');
const wishlistBadgeCount = document.getElementById('wishlistBadgeCount');
const clearHistoryBtnWrapper = document.getElementById('clearHistoryBtnWrapper');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Hero elements
const heroSection = document.getElementById('heroSection');
const heroBackdrop = document.getElementById('heroBackdrop');
const heroTitle = document.getElementById('heroTitle');
const heroOverview = document.getElementById('heroOverview');
const heroPlayBtn = document.getElementById('heroPlayBtn');
const heroWishlistBtn = document.getElementById('heroWishlistBtn');
const heroWishlistText = document.getElementById('heroWishlistText');
const heroBadge = document.getElementById('heroBadge');

// Notifications
const notifBtn = document.getElementById('notifBtn');
const notifDot = document.getElementById('notifDot');
const notifDropdown = document.getElementById('notifDropdown');
const notifList = document.getElementById('notifList');
const enableNotifBtn = document.getElementById('enableNotifBtn');

// Cast Modal
const castBtn = document.getElementById('castBtn');
const castModal = document.getElementById('castModal');
const closeCastBtn = document.getElementById('closeCastBtn');
const closeCastBackdrop = document.getElementById('closeCastBackdrop');
const copyUrlBtn = document.getElementById('copyUrlBtn');
const localNetworkUrl = document.getElementById('localNetworkUrl');

// Modal Player elements
const playerModal = document.getElementById('playerModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const closeModalBackdrop = document.getElementById('closeModalBackdrop');
const modalMediaTitle = document.getElementById('modalMediaTitle');
const modalMediaType = document.getElementById('modalMediaType');
const modalCurrentEpBadge = document.getElementById('modalCurrentEpBadge');
const modalWishlistBtn = document.getElementById('modalWishlistBtn');
const modalRating = document.getElementById('modalRating');
const modalReleaseDate = document.getElementById('modalReleaseDate');
const modalGenres = document.getElementById('modalGenres');
const modalOverview = document.getElementById('modalOverview');
const videoIframe = document.getElementById('videoIframe');
const playerLoader = document.getElementById('playerLoader');
const seriesControls = document.getElementById('seriesControls');
const seasonSelect = document.getElementById('seasonSelect');
const episodeSelect = document.getElementById('episodeSelect');
const autoplayToggle = document.getElementById('autoplayToggle');
const langPillGroup = document.getElementById('langPillGroup');
const markCompletedBtn = document.getElementById('markCompletedBtn');

// Modal Settings elements
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const closeSettingsBackdrop = document.getElementById('closeSettingsBackdrop');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveApiKeyBtn = document.getElementById('saveApiKeyBtn');

// Initialisation au chargement de la page
window.addEventListener('DOMContentLoaded', () => {
  if (apiKey) {
    localStorage.setItem('tmdb_api_key', apiKey);
    apiKeyInput.value = apiKey;
    updateBadges();
    checkWishlistReleases();
    restoreActiveTab();
  } else {
    openSettings();
  }
  setupEventListeners();
});

// Restaurer l'onglet actif
function restoreActiveTab() {
  navButtons.forEach(b => {
    b.classList.toggle('active', b.dataset.filter === currentFilter);
  });

  if (currentFilter === 'history') {
    renderHistory();
  } else if (currentFilter === 'wishlist') {
    renderWishlist();
  } else {
    currentPage = 1;
    loadContent(1);
  }
}

// Gestionnaire d'appels API TMDB
async function fetchTMDB(endpoint, params = {}) {
  if (!apiKey) throw new Error('Clé d\'API manquante');

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('language', 'fr-FR');
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }

  const headers = { 'Accept': 'application/json' };
  if (apiKey.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${apiKey.trim()}`;
  } else {
    url.searchParams.set('api_key', apiKey.trim());
  }

  const res = await fetch(url.toString(), { headers });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Clé TMDB invalide ou non autorisée');
    }
    throw new Error(`Erreur TMDB (${res.status})`);
  }
  return res.json();
}

// ============ INFINITE SCROLL ============
let scrollObserver = null;

function setupInfiniteScroll() {
  // Remove old sentinel if exists
  const oldSentinel = document.getElementById('scrollSentinel');
  if (oldSentinel) oldSentinel.remove();

  const sentinel = document.createElement('div');
  sentinel.id = 'scrollSentinel';
  sentinel.style.cssText = 'height:1px;margin-top:20px;';
  document.querySelector('.main-container').appendChild(sentinel);

  if (scrollObserver) scrollObserver.disconnect();

  scrollObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !isLoadingMore && currentPage < totalPages) {
        loadMoreContent();
      }
    });
  }, { rootMargin: '200px' });

  scrollObserver.observe(sentinel);
}

function loadMoreContent() {
  if (isLoadingMore || currentPage >= totalPages) return;
  isLoadingMore = true;
  currentPage++;
  showScrollLoader();

  if (currentSearchQuery) {
    performSearch(currentSearchQuery, currentPage);
  } else if (['all', 'movie', 'tv'].includes(currentFilter)) {
    loadContent(currentPage);
  }
}

function showScrollLoader() {
  let loader = document.getElementById('scrollLoader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'scrollLoader';
    loader.innerHTML = '<div class="scroll-loading"><div class="spinner"></div><span>Chargement...</span></div>';
    document.querySelector('.main-container').appendChild(loader);
  }
  loader.style.display = 'flex';
}

function hideScrollLoader() {
  const loader = document.getElementById('scrollLoader');
  if (loader) loader.style.display = 'none';
}

function updateLoadMoreBtn() {
  // Setup infinite scroll on first page load
  if (currentPage === 1 || !document.getElementById('scrollSentinel')) {
    setupInfiniteScroll();
  }
}

// ============ ÉCOUTEURS D'ÉVÉNEMENTS ============
// Configuration des écouteurs d'événements
function setupEventListeners() {
  // Logo click
  const brandLogo = document.getElementById('brandLogo');
  if (brandLogo) {
    brandLogo.addEventListener('click', () => switchTab('all'));
  }

  // Navigation / Filtres
  navButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetBtn = e.target.closest('.nav-btn');
      if (!targetBtn) return;
      
      navButtons.forEach(b => b.classList.remove('active'));
      targetBtn.classList.add('active');
      currentFilter = targetBtn.dataset.filter;
      localStorage.setItem('moviez_active_tab', currentFilter);

      clearTimeout(searchTimeout);
      searchInput.value = '';
      currentSearchQuery = '';
      clearSearchBtn.style.display = 'none';
      currentPage = 1;
      totalPages = 1;
      isLoadingMore = false;

      if (currentFilter === 'history') {
        renderHistory();
      } else if (currentFilter === 'wishlist') {
        renderWishlist();
      } else {
        loadContent(1);
      }
    });
  });

  // Vider l'historique
  clearHistoryBtn.addEventListener('click', () => {
    if (confirm('Voulez-vous vraiment effacer tout votre historique de lecture ?')) {
      historyList = [];
      localStorage.setItem('moviez_history', '[]');
      updateBadges();
      renderHistory();
    }
  });

  // Recherche avec debounce
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearSearchBtn.style.display = query ? 'block' : 'none';
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentSearchQuery = query;
      if (query.length >= 2) {
        currentPage = 1;
        totalPages = 1;
        performSearch(query, 1);
      } else if (query.length === 0) {
        currentPage = 1;
        restoreActiveTab();
      }
    }, 400);
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    currentSearchQuery = '';
    clearSearchBtn.style.display = 'none';
    restoreActiveTab();
  });

  // Notifications
  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    notifDropdown.classList.toggle('active');
    notifDot.style.display = 'none';
  });

  document.addEventListener('click', (e) => {
    if (!notifDropdown.contains(e.target) && e.target !== notifBtn) {
      notifDropdown.classList.remove('active');
    }
  });

  enableNotifBtn.addEventListener('click', requestNotificationPermission);

  // Cast Modal
  castBtn.addEventListener('click', () => {
    castModal.classList.add('active');
  });
  closeCastBtn.addEventListener('click', () => castModal.classList.remove('active'));
  closeCastBackdrop.addEventListener('click', () => castModal.classList.remove('active'));

  copyUrlBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(localNetworkUrl.textContent);
    copyUrlBtn.textContent = 'Copié !';
    setTimeout(() => { copyUrlBtn.textContent = 'Copier l\'adresse'; }, 2000);
  });

  // Paramètres Clé API
  openSettingsBtn.addEventListener('click', openSettings);
  closeSettingsBtn.addEventListener('click', closeSettings);
  closeSettingsBackdrop.addEventListener('click', closeSettings);

  saveApiKeyBtn.addEventListener('click', () => {
    const val = apiKeyInput.value.trim();
    if (!val) {
      alert('Veuillez coller votre clé ou jeton TMDB');
      return;
    }
    apiKey = val;
    localStorage.setItem('tmdb_api_key', apiKey);
    closeSettings();
    loadContent();
  });

  // Modal Player
  closeModalBtn.addEventListener('click', closePlayer);
  closeModalBackdrop.addEventListener('click', closePlayer);

  modalWishlistBtn.addEventListener('click', () => {
    if (currentMedia) {
      toggleWishlist(currentMedia);
      updateModalWishlistState();
    }
  });

  markCompletedBtn.addEventListener('click', () => {
    if (currentMedia) {
      toggleCompleted(currentMedia);
    }
  });

  // Choix Serveur
  const serverPillGroup = document.getElementById('serverPillGroup');
  if (serverPillGroup) {
    serverPillGroup.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      serverPillGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentServer = btn.dataset.server;
      updatePlayerEmbed();
    });
  }

  // Choix langue
  langPillGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    langPillGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentLang = btn.dataset.lang;
    updatePlayerEmbed();
  });

  // Autoplay
  autoplayToggle.addEventListener('change', () => {
    autoplay = autoplayToggle.checked;
    updatePlayerEmbed();
  });

  // Sélecteur de saison & épisode (pour séries)
  seasonSelect.addEventListener('change', async () => {
    currentSeason = parseInt(seasonSelect.value, 10);
    await loadEpisodes(currentMedia.id, currentSeason);
    saveHistory(currentMedia, currentSeason, currentEpisode);
    updatePlayerEmbed();
  });

  episodeSelect.addEventListener('change', () => {
    currentEpisode = parseInt(episodeSelect.value, 10);
    saveHistory(currentMedia, currentSeason, currentEpisode);
    updatePlayerEmbed();
  });

  // Iframe loaded
  videoIframe.addEventListener('load', () => {
    playerLoader.style.display = 'none';
  });
}

// Chargement du contenu d'accueil
async function loadContent(page = 1) {
  clearHistoryBtnWrapper.style.display = 'none';
  if (page === 1) {
    showLoader();
    heroShown = false;
  }

  try {
    let data;
    if (currentFilter === 'movie') {
      sectionTitle.textContent = 'Films Populaires';
      data = await fetchTMDB('/movie/popular', { page });
    } else if (currentFilter === 'tv') {
      sectionTitle.textContent = 'Séries Populaires';
      data = await fetchTMDB('/tv/popular', { page });
    } else {
      sectionTitle.textContent = 'Tendances du moment';
      data = await fetchTMDB('/trending/all/day', { page });
    }

    totalPages = data.total_pages || 1;
    const items = (data.results || []).filter(item => item.poster_path && (item.title || item.name));

    if (items.length > 0) {
      if (page === 1) {
        mediaGrid.innerHTML = '';
        mediaGrid.style.display = 'grid';
        statusMessage.style.display = 'none';
        renderHero(items[0]);
        heroShown = true;
      }
      appendCards(items);
      resultsCount.textContent = `Page ${page} / ${totalPages}`;
      updateLoadMoreBtn();
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

// Recherche
async function performSearch(query, page = 1) {
  clearHistoryBtnWrapper.style.display = 'none';
  if (page === 1) showLoader();
  sectionTitle.textContent = `Résultats pour "${query}"`;
  try {
    const data = await fetchTMDB('/search/multi', { query, page });
    totalPages = data.total_pages || 1;
    let items = (data.results || []).filter(item =>
      (item.media_type === 'movie' || item.media_type === 'tv') && item.poster_path
    );

    if (currentFilter === 'movie') {
      items = items.filter(i => i.media_type === 'movie');
    } else if (currentFilter === 'tv') {
      items = items.filter(i => i.media_type === 'tv');
    }

    if (items.length > 0) {
      if (page === 1) {
        heroSection.style.display = 'none';
        mediaGrid.innerHTML = '';
        mediaGrid.style.display = 'grid';
        statusMessage.style.display = 'none';
      }
      appendCards(items);
      resultsCount.textContent = `${data.total_results || items.length} résultats`;
      updateLoadMoreBtn();
    } else if (page === 1) {
      showEmpty(`Aucun résultat pour "${query}".`);
    }
  } catch (err) {
    showError(err.message);
  } finally {
    isLoadingMore = false;
    hideScrollLoader();
  }
}

// Rendu Hero
function renderHero(item) {
  heroSection.style.display = 'flex';
  const isMovie = isMovieMedia(item);
  const title = item.name || item.title || 'À l\'affiche';
  const backdrop = item.backdrop_path ? `${TMDB_BACKDROP_BASE}${item.backdrop_path}` : `${TMDB_IMAGE_BASE}${item.poster_path}`;

  heroBackdrop.style.backgroundImage = `url('${backdrop}')`;
  heroTitle.textContent = title;
  heroOverview.textContent = item.overview || 'Aucun résumé disponible.';
  heroBadge.textContent = isMovie ? 'Film en vedette' : 'Série en vedette';

  heroPlayBtn.onclick = () => openPlayer({ ...item, media_type: isMovie ? 'movie' : 'tv' });

  // État wishlist hero
  const inWishlist = wishlist.some(w => w.id === item.id);
  heroWishlistText.textContent = inWishlist ? '✓ Dans ma liste' : 'Ajouter à ma liste';
  heroWishlistBtn.onclick = () => {
    toggleWishlist({ ...item, media_type: isMovie ? 'movie' : 'tv' });
    const nowIn = wishlist.some(w => w.id === item.id);
    heroWishlistText.textContent = nowIn ? '✓ Dans ma liste' : 'Ajouter à ma liste';
  };
}

// Rendu standard de la grille
function appendCards(items) { renderGrid(items, 'standard', true); }

function renderGrid(items, mode = 'standard', append = false) {
  statusMessage.style.display = 'none';
  mediaGrid.style.display = 'grid';
  if (!append) mediaGrid.innerHTML = '';

  items.forEach(item => {
    const isMovie = isMovieMedia(item);
    const type = isMovie ? 'movie' : 'tv';
    const title = item.name || item.title || 'Vidéo';
    const releaseDate = isMovie ? item.release_date : item.first_air_date;
    const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : 'NR';
    const posterUrl = `${TMDB_IMAGE_BASE}${item.poster_path}`;

    // Vérifier l'historique de cet item
    const historyItem = historyList.find(h => h.id === item.id);
    const inWishlist = wishlist.some(w => w.id === item.id);

    const card = document.createElement('div');
    card.className = 'media-card';

    let progressBadgeHtml = '';
    if (historyItem) {
      if (historyItem.completed) {
        progressBadgeHtml = `<span class="card-progress-badge completed">✓ Vu</span>`;
      } else if (historyItem.type === 'tv') {
        progressBadgeHtml = `<span class="card-progress-badge">S${historyItem.season} E${historyItem.episode}</span>`;
      } else {
        progressBadgeHtml = `<span class="card-progress-badge">En cours</span>`;
      }
    }

    card.innerHTML = `
      <div class="poster-wrapper">
        <img src="${posterUrl}" alt="${title}" loading="lazy">
        <span class="card-type-tag">${isMovie ? 'Film' : 'Série'}</span>
        <span class="card-rating-tag">★ ${rating}</span>
        ${progressBadgeHtml}
        <div class="card-quick-actions">
          <button class="card-act-btn quick-wishlist-btn" title="${inWishlist ? 'Retirer de ma liste' : 'Ajouter à ma liste'}">
            ${inWishlist ? '★' : '☆'}
          </button>
          ${mode === 'history' ? '<button class="card-act-btn quick-remove-history-btn" title="Supprimer de l\'historique">✕</button>' : ''}
          ${mode === 'wishlist' ? '<button class="card-act-btn quick-remove-wishlist-btn" title="Retirer de ma liste">✕</button>' : ''}
        </div>
        <div class="card-play-overlay">
          <div class="play-circle">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title" title="${title}">${title}</div>
        <div class="card-meta-row">
          <span>${year}</span>
          <span>${inWishlist ? '⭐ Favori' : ''}</span>
        </div>
      </div>
    `;

    // Clic pour lire
    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-act-btn')) return; // ignorer les clics boutons rapides
      openPlayer({ ...item, media_type: type });
    });

    // Bouton rapide Wishlist
    const quickWishlistBtn = card.querySelector('.quick-wishlist-btn');
    quickWishlistBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWishlist({ ...item, media_type: type });
      renderGrid(items, mode);
    });

    // Bouton suppression rapide historique
    const quickRemoveHistoryBtn = card.querySelector('.quick-remove-history-btn');
    if (quickRemoveHistoryBtn) {
      quickRemoveHistoryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        historyList = historyList.filter(h => h.id !== item.id);
        localStorage.setItem('moviez_history', JSON.stringify(historyList));
        updateBadges();
        renderHistory();
      });
    }

    // Bouton suppression rapide wishlist
    const quickRemoveWishlistBtn = card.querySelector('.quick-remove-wishlist-btn');
    if (quickRemoveWishlistBtn) {
      quickRemoveWishlistBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        wishlist = wishlist.filter(w => w.id !== item.id);
        localStorage.setItem('moviez_wishlist', JSON.stringify(wishlist));
        updateBadges();
        renderWishlist();
      });
    }

    mediaGrid.appendChild(card);
  });
}

// Affichage de l'Historique
function renderHistory() {
  heroSection.style.display = 'none';
  clearHistoryBtnWrapper.style.display = historyList.length > 0 ? 'block' : 'none';
  sectionTitle.textContent = 'Reprendre la lecture (Historique)';
  resultsCount.textContent = `${historyList.length} titres`;

  if (historyList.length === 0) {
    mediaGrid.innerHTML = '';
    showEmptyState(
      '🕒',
      'Aucun visionnage en cours',
      'Les films et séries que vous commencez apparaîtront ici pour vous permettre de reprendre la lecture là où vous vous étiez arrêté.',
      'Explorer les tendances',
      () => switchTab('all')
    );
    return;
  }

  // Trier par le plus récemment regardé
  const sorted = [...historyList].sort((a, b) => (b.lastWatched || 0) - (a.lastWatched || 0));
  renderGrid(sorted, 'history');
}

// Affichage de la Wishlist
function renderWishlist() {
  heroSection.style.display = 'none';
  clearHistoryBtnWrapper.style.display = 'none';
  sectionTitle.textContent = 'Ma Liste (À voir)';
  resultsCount.textContent = `${wishlist.length} titres`;

  if (wishlist.length === 0) {
    mediaGrid.innerHTML = '';
    showEmptyState(
      '⭐',
      'Votre liste est vide',
      'Vous n\'avez pas encore ajouté de films ou de séries. Cliquez sur l\'étoile sur une affiche pour la retrouver ici.',
      'Découvrir des films',
      () => switchTab('movie')
    );
    return;
  }

  const sorted = [...wishlist].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
  renderGrid(sorted, 'wishlist');
}

// Changer d'onglet par programmation
function switchTab(filterName) {
  const btn = Array.from(navButtons).find(b => b.dataset.filter === filterName);
  if (btn) btn.click();
}

// État vide élégant avec bouton d'action
function showEmptyState(icon, title, desc, actionText, actionCallback) {
  statusMessage.style.display = 'block';
  mediaGrid.style.display = 'none';
  mediaGrid.innerHTML = '';

  statusMessage.innerHTML = `
    <div class="empty-state-box">
      <div class="empty-state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${desc}</p>
      ${actionText ? `<button id="emptyStateActionBtn" class="btn btn-primary" style="margin-top:16px;">${actionText}</button>` : ''}
    </div>
  `;

  if (actionText && actionCallback) {
    const actBtn = document.getElementById('emptyStateActionBtn');
    if (actBtn) actBtn.onclick = actionCallback;
  }
}

// Gestion de l'historique
function saveHistory(item, season = 1, episode = 1) {
  const isMovie = isMovieMedia(item);
  const title = item.name || item.title || 'Vidéo';

  const existingIdx = historyList.findIndex(h => h.id === item.id);
  const entry = {
    id: item.id,
    media_type: isMovie ? 'movie' : 'tv',
    title: title,
    name: title,
    poster_path: item.poster_path,
    vote_average: item.vote_average,
    release_date: item.release_date || item.first_air_date,
    season: season,
    episode: episode,
    lastWatched: Date.now(),
    completed: existingIdx >= 0 ? historyList[existingIdx].completed : false
  };

  if (existingIdx >= 0) {
    historyList[existingIdx] = entry;
  } else {
    historyList.unshift(entry);
  }

  localStorage.setItem('moviez_history', JSON.stringify(historyList));
  updateBadges();
}

function toggleCompleted(item) {
  const existing = historyList.find(h => h.id === item.id);
  if (existing) {
    existing.completed = !existing.completed;
  } else {
    saveHistory(item, currentSeason, currentEpisode);
    const created = historyList.find(h => h.id === item.id);
    if (created) created.completed = true;
  }
  localStorage.setItem('moviez_history', JSON.stringify(historyList));
  updateModalCompletedState();
  updateBadges();
}

// Gestion de la Wishlist
function toggleWishlist(item) {
  const isMovie = isMovieMedia(item);
  const title = item.name || item.title || 'Vidéo';
  const existingIdx = wishlist.findIndex(w => w.id === item.id);

  if (existingIdx >= 0) {
    wishlist.splice(existingIdx, 1);
  } else {
    wishlist.unshift({
      id: item.id,
      media_type: isMovie ? 'movie' : 'tv',
      title: title,
      name: title,
      poster_path: item.poster_path,
      vote_average: item.vote_average,
      release_date: item.release_date || item.first_air_date,
      overview: item.overview,
      addedAt: Date.now(),
      notified: false
    });
  }

  localStorage.setItem('moviez_wishlist', JSON.stringify(wishlist));
  updateBadges();
  checkWishlistReleases();
}

// Mise à jour des badges dans la barre de navigation
function updateBadges() {
  historyBadgeCount.textContent = historyList.length;
  historyBadgeCount.style.display = historyList.length > 0 ? 'inline-block' : 'none';

  wishlistBadgeCount.textContent = wishlist.length;
  wishlistBadgeCount.style.display = wishlist.length > 0 ? 'inline-block' : 'none';
}

// Vérification des sorties de films de la wishlist & notifications
function checkWishlistReleases() {
  const today = new Date().toISOString().split('T')[0];
  const newReleases = [];

  wishlist.forEach(item => {
    if (item.release_date && item.release_date <= today && !item.notified) {
      item.notified = true;
      newReleases.push(item);
      notifications.unshift({
        id: item.id,
        title: item.title || item.name,
        poster_path: item.poster_path,
        date: item.release_date,
        type: item.media_type
      });
    }
  });

  if (newReleases.length > 0) {
    localStorage.setItem('moviez_wishlist', JSON.stringify(wishlist));
    localStorage.setItem('moviez_notifications', JSON.stringify(notifications));
    notifDot.style.display = 'block';

    // Déclencher notification de bureau si autorisé
    if (Notification.permission === 'granted') {
      newReleases.forEach(rel => {
        new Notification(`🎬 Sortie disponible : ${rel.title || rel.name}`, {
          body: 'Ce titre de votre liste est maintenant disponible !',
          icon: `${TMDB_IMAGE_BASE}${rel.poster_path}`
        });
      });
    }
  }

  renderNotificationsList();
}

function renderNotificationsList() {
  if (notifications.length === 0) {
    notifList.innerHTML = '<p class="empty-notif">Aucune notification de sortie pour le moment.</p>';
    return;
  }

  notifList.innerHTML = '';
  notifications.slice(0, 8).forEach(n => {
    const item = document.createElement('div');
    item.className = 'notif-item';
    item.innerHTML = `
      <img src="${TMDB_IMAGE_BASE}${n.poster_path}" alt="${n.title}">
      <div class="notif-item-body">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-desc">Disponible maintenant ! (${n.date})</div>
      </div>
    `;
    item.onclick = () => {
      openPlayer({ id: n.id, media_type: n.type, title: n.title, name: n.title, poster_path: n.poster_path });
      notifDropdown.classList.remove('active');
    };
    notifList.appendChild(item);
  });
}

function requestNotificationPermission() {
  if (!('Notification' in window)) {
    alert('Ce navigateur ne supporte pas les notifications.');
    return;
  }
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      enableNotifBtn.textContent = 'Alertes actives ✓';
      enableNotifBtn.style.color = 'var(--green)';
      new Notification('MovieZ', { body: 'Les notifications de sorties sont activées !' });
    }
  });
}

// Ouverture du lecteur
async function openPlayer(item) {
  currentMedia = item;
  const isMovie = isMovieMedia(item);
  const title = item.name || item.title || 'Vidéo';
  const releaseDate = isMovie ? item.release_date : item.first_air_date;
  const year = releaseDate ? releaseDate.split('-')[0] : 'N/A';

  modalMediaTitle.textContent = title;
  modalMediaType.textContent = isMovie ? 'Film' : 'Série';
  modalRating.textContent = `⭐ ${item.vote_average ? item.vote_average.toFixed(1) : 'NR'}`;
  modalReleaseDate.textContent = year;
  modalOverview.textContent = item.overview || 'Aucun synopsis disponible.';

  updateModalWishlistState();
  updateModalCompletedState();

  // Pour les séries : charger l'historique de saison/épisode si existant
  if (!isMovie) {
    seriesControls.style.display = 'flex';
    modalCurrentEpBadge.style.display = 'inline-block';

    const historyItem = historyList.find(h => h.id === item.id);
    currentSeason = historyItem ? historyItem.season : 1;
    currentEpisode = historyItem ? historyItem.episode : 1;

    await loadSeasons(item.id, currentSeason, currentEpisode);
  } else {
    seriesControls.style.display = 'none';
    modalCurrentEpBadge.style.display = 'none';
  }

  saveHistory(item, currentSeason, currentEpisode);
  updatePlayerEmbed();
  playerModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function updateModalWishlistState() {
  if (!currentMedia) return;
  const inWishlist = wishlist.some(w => w.id === currentMedia.id);
  modalWishlistBtn.classList.toggle('active', inWishlist);
  modalWishlistBtn.title = inWishlist ? 'Retirer de ma liste' : 'Ajouter à ma liste';
}

function updateModalCompletedState() {
  if (!currentMedia) return;
  const historyItem = historyList.find(h => h.id === currentMedia.id);
  const isCompleted = historyItem && historyItem.completed;
  markCompletedBtn.classList.toggle('active', !!isCompleted);
  markCompletedBtn.textContent = isCompleted ? '✓ Vu (Terminé)' : '✓ Marquer comme vu';
}

// Chargement des saisons TMDB
async function loadSeasons(tvId, targetSeason = 1, targetEpisode = 1) {
  seasonSelect.innerHTML = '<option>Chargement...</option>';
  try {
    const details = await fetchTMDB(`/tv/${tvId}`);
    const validSeasons = (details.seasons || []).filter(s => s.season_number > 0);
    seasonSelect.innerHTML = '';
    validSeasons.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.season_number;
      opt.textContent = `Saison ${s.season_number} (${s.episode_count} ép.)`;
      seasonSelect.appendChild(opt);
    });

    currentSeason = targetSeason;
    seasonSelect.value = currentSeason;
    await loadEpisodes(tvId, currentSeason, targetEpisode);
  } catch (err) {
    console.error('Erreur chargement saisons:', err);
    seasonSelect.innerHTML = '<option value="1">Saison 1</option>';
    episodeSelect.innerHTML = '<option value="1">Épisode 1</option>';
  }
}

// Chargement des épisodes d'une saison
async function loadEpisodes(tvId, seasonNum, targetEpisode = 1) {
  episodeSelect.innerHTML = '<option>Chargement...</option>';
  try {
    const seasonData = await fetchTMDB(`/tv/${tvId}/season/${seasonNum}`);
    episodeSelect.innerHTML = '';
    (seasonData.episodes || []).forEach(ep => {
      const opt = document.createElement('option');
      opt.value = ep.episode_number;
      opt.textContent = `Ép. ${ep.episode_number} - ${ep.name || 'Épisode ' + ep.episode_number}`;
      episodeSelect.appendChild(opt);
    });
    currentEpisode = targetEpisode;
    episodeSelect.value = currentEpisode;
    modalCurrentEpBadge.textContent = `S${seasonNum} : E${currentEpisode}`;
  } catch (err) {
    console.error('Erreur chargement épisodes:', err);
    episodeSelect.innerHTML = '<option value="1">Épisode 1</option>';
  }
}

// Génération de l'URL du lecteur Vidzy
function updatePlayerEmbed() {
  if (!currentMedia) return;
  playerLoader.style.display = 'flex';

  const isMovie = isMovieMedia(currentMedia);
  const id = currentMedia.id;
  let embedUrl = '';

  const params = new URLSearchParams();
  params.set('color', 'ff3b41');
  if (autoplay) params.set('autoplay', '1');
  if (currentLang) params.set('lang', currentLang);

  if (currentServer === 'vidzy') {
    if (isMovie) {
      embedUrl = `https://vidzy.org/movie/${id}?${params.toString()}`;
    } else {
      modalCurrentEpBadge.textContent = `S${currentSeason} : E${currentEpisode}`;
      params.set('autonext', '1');
      embedUrl = `https://vidzy.org/serie/${id}/${currentSeason}/${currentEpisode}?${params.toString()}`;
    }
  } else if (currentServer === 'vidsrc') {
    if (isMovie) {
      embedUrl = `https://vidsrc.to/embed/movie/${id}`;
    } else {
      modalCurrentEpBadge.textContent = `S${currentSeason} : E${currentEpisode}`;
      embedUrl = `https://vidsrc.to/embed/tv/${id}/${currentSeason}/${currentEpisode}`;
    }
  } else if (currentServer === 'embedsu') {
    if (isMovie) {
      embedUrl = `https://embed.su/embed/movie/${id}`;
    } else {
      modalCurrentEpBadge.textContent = `S${currentSeason} : E${currentEpisode}`;
      embedUrl = `https://embed.su/embed/tv/${id}/${currentSeason}/${currentEpisode}`;
    }
  } else if (currentServer === 'superembed') {
    if (isMovie) {
      embedUrl = `https://multiembed.mov/?video_id=${id}&tmdb=1`;
    } else {
      modalCurrentEpBadge.textContent = `S${currentSeason} : E${currentEpisode}`;
      embedUrl = `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${currentSeason}&e=${currentEpisode}`;
    }
  }

  videoIframe.src = embedUrl;
}

// Fermeture du lecteur
function closePlayer() {
  playerModal.classList.remove('active');
  videoIframe.src = '';
  document.body.style.overflow = '';
  currentMedia = null;

  // Rafraîchir la vue actuelle si on était dans l'historique ou la wishlist
  if (currentFilter === 'history') {
    renderHistory();
  } else if (currentFilter === 'wishlist') {
    renderWishlist();
  }
}

// Paramètres TMDB
function openSettings() {
  settingsModal.classList.add('active');
  apiKeyInput.focus();
}

function closeSettings() {
  settingsModal.classList.remove('active');
}

// Messages d'état
function showLoader() {
  statusMessage.textContent = 'Chargement en cours...';
  statusMessage.style.display = 'block';
  mediaGrid.style.display = 'none';
}

function showEmpty(msg) {
  statusMessage.textContent = msg;
  statusMessage.style.display = 'block';
  mediaGrid.style.display = 'none';
}

function showError(msg) {
  statusMessage.innerHTML = `⚠️ Une erreur est survenue : <strong>${msg}</strong><br><br><button class="btn btn-primary" onclick="openSettings()">Vérifier la clé TMDB</button>`;
  statusMessage.style.display = 'block';
  mediaGrid.style.display = 'none';
}
