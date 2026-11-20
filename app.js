/**
 * =========================================================================
 * ZETFLIX — APPLICATION CLIENT COMPLÈTE (DARK CINEMA PREMIUM)
 * Architecture SPA : Sidebar persistante, 9 Vues, Carrousels, Recherche avancée,
 * Fiche détaillée avec saisons/épisodes, Lecteur plein écran multi-serveurs
 * (Vidzy, VidSrc, EmbedSu, SuperEmbed), Profil avec statistiques, Sauvegardes JSON.
 * =========================================================================
 */

(function () {
  'use strict';

  // =========================================================================
  // 1. CONFIGURATION & CONSTANTES TMDB
  // =========================================================================
  const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
  const TMDB_IMG_POSTER = 'https://image.tmdb.org/t/p/w500';
  const TMDB_IMG_BACKDROP = 'https://image.tmdb.org/t/p/original';
  const FALLBACK_POSTER = 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80';
  const FALLBACK_BACKDROP = 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=1400&q=80';

  // Récupération de la clé API TMDB
  let apiKey = (window.CONFIG && window.CONFIG.TMDB_API_KEY) ||
    localStorage.getItem('tmdb_api_key') ||
    'b50b12e7db90800c59536e2bbd8f4aa7';

  // Clés de stockage persistant (Local Storage + Cookies de secours)
  const STORAGE_KEYS = {
    wishlist: 'zetflix_wishlist',
    history: 'zetflix_history',
    downloads: 'zetflix_downloads',
    settings: 'zetflix_settings',
    profile: 'zetflix_profile',
    notifications: 'zetflix_notifications',
  };

  function storageGet(key, fallback = []) {
    try {
      const val = localStorage.getItem(key);
      if (val) return JSON.parse(val);
    } catch (e) {}
    try {
      const match = document.cookie.match(new RegExp('(^| )' + key + '=([^;]+)'));
      if (match) return JSON.parse(decodeURIComponent(match[2]));
    } catch (e) {}
    return fallback;
  }

  function storageSet(key, data) {
    const json = JSON.stringify(data);
    try {
      localStorage.setItem(key, json);
    } catch (e) {}
    try {
      const expires = new Date(Date.now() + 365 * 864e5).toUTCString();
      const truncated = json.length > 3800 ? JSON.stringify(data.slice(0, 15)) : json;
      document.cookie = `${key}=${encodeURIComponent(truncated)};expires=${expires};path=/;SameSite=Lax`;
    } catch (e) {}
  }

  // Listes persistantes en mémoire
  let wishlist = storageGet(STORAGE_KEYS.wishlist, []);
  let historyList = storageGet(STORAGE_KEYS.history, []);
  let settings = storageGet(STORAGE_KEYS.settings, {
    preferredServer: 'vidzy',
    playbackQuality: 'auto',
    smoothAnim: true,
  });

  // Profil par défaut (Conforme à la maquette)
  let profile = storageGet(STORAGE_KEYS.profile, {
    name: 'Ziehi Yotam',
    tier: 'Premium',
    email: 'ziehi.yotam@gmail.com',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=260&q=80',
    joinedDate: 'Abonné depuis le 12 janv. 2026',
    expiryDate: 'Actif jusqu\'au 12 fév. 2027',
  });

  // Bibliothèque de téléchargements simulée par défaut (12 titres premium)
  let defaultDownloads = [
    { id: 603692, title: 'John Wick: Chapter 4', media_type: 'movie', poster_path: '/vZloFAK7NKnMGKEsl6Zi7GJfMeF.jpg', vote_average: 8.2, release_date: '2023', size: '3.4 Go', progress: 100 },
    { id: 634649, title: 'Spider-Man: No Way Home', media_type: 'movie', poster_path: '/1g0dhYtq4irTY1GPXvft6k4YLjm.jpg', vote_average: 8.0, release_date: '2021', size: '2.8 Go', progress: 100 },
    { id: 27205, title: 'Inception', media_type: 'movie', poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg', vote_average: 8.4, release_date: '2010', size: '2.9 Go', progress: 100 },
    { id: 157336, title: 'Interstellar', media_type: 'movie', poster_path: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', vote_average: 8.4, release_date: '2014', size: '3.6 Go', progress: 100 },
    { id: 76600, title: 'Avatar: The Way of Water', media_type: 'movie', poster_path: '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg', vote_average: 7.7, release_date: '2022', size: '3.8 Go', progress: 100 },
    { id: 414906, title: 'The Batman', media_type: 'movie', poster_path: '/74xTEgt7R36Fpooo50r9T25onhq.jpg', vote_average: 7.7, release_date: '2022', size: '3.1 Go', progress: 100 },
    { id: 693134, title: 'Dune: Part Two', media_type: 'movie', poster_path: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', vote_average: 8.3, release_date: '2024', size: '3.9 Go', progress: 100 },
    { id: 85937, title: 'Demon Slayer: Kimetsu no Yaiba', media_type: 'tv', poster_path: '/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg', vote_average: 8.7, release_date: '2019', size: '1.9 Go', progress: 100 },
    { id: 299534, title: 'Avengers: Endgame', media_type: 'movie', poster_path: '/or06FN3Dka5tukK1e9sl16pB3iy.jpg', vote_average: 8.3, release_date: '2019', size: '3.7 Go', progress: 100 },
    { id: 155, title: 'The Dark Knight', media_type: 'movie', poster_path: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', vote_average: 8.5, release_date: '2008', size: '2.7 Go', progress: 100 },
    { id: 475557, title: 'Joker', media_type: 'movie', poster_path: '/udDclJoHjfjb8Ekgsd4FDteOkCU.jpg', vote_average: 8.2, release_date: '2019', size: '2.5 Go', progress: 100 },
    { id: 361743, title: 'Top Gun: Maverick', media_type: 'movie', poster_path: '/62HCnUTziyWcpDaBO2i1DX17ljH.jpg', vote_average: 8.2, release_date: '2022', size: '2.6 Go', progress: 100 },
  ];
  let downloadsList = storageGet(STORAGE_KEYS.downloads, defaultDownloads);

  // =========================================================================
  // 2. ÉTAT GLOBAL DE L'APPLICATION
  // =========================================================================
  let currentView = 'home';
  let catalogType = 'movie'; // 'movie' ou 'tv'
  let heroSlides = [];
  let currentHeroIdx = 0;
  let heroRotationTimer = null;

  // État lecteur vidéo
  let activeMedia = null;
  let currentSeason = 1;
  let currentEpisode = 1;
  let currentServer = settings.preferredServer || 'vidzy';
  let currentLang = '';
  let playerCurrentSeconds = 1458; // 24m 18s (comme dans la maquette)
  let playerTotalSeconds = 8895;   // 2h 28m 15s
  let isPlaying = true;
  let isMuted = false;
  let playerTicker = null;

  // État recherche avancée
  let searchDebounceTimer = null;
  let activeSearchCategory = 'all'; // 'all', 'movie', 'tv', ou genre id

  // =========================================================================
  // 3. APPELS API TMDB (AVEC GESTION D'ERREURS & FALLBACKS)
  // =========================================================================
  async function fetchTMDB(endpoint, params = {}) {
    if (!apiKey) throw new Error('Clé API TMDB non configurée.');
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('language', 'fr-FR');
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v);
      }
    }

    const headers = { Accept: 'application/json' };
    if (apiKey.startsWith('eyJ')) {
      headers['Authorization'] = `Bearer ${apiKey.trim()}`;
    } else {
      url.searchParams.set('api_key', apiKey.trim());
    }

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`TMDB error ${res.status}`);
    return res.json();
  }

  function isMovie(item) {
    if (!item) return true;
    if (item.media_type === 'tv' || item.type === 'tv') return false;
    if (item.media_type === 'movie' || item.type === 'movie') return true;
    if (item.first_air_date || (item.name && !item.release_date)) return false;
    return true;
  }

  function formatTime(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    const hours = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    if (hours > 0) {
      return `${hours}:${pad(mins)}:${pad(secs)}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }

  // =========================================================================
  // 4. ROUTEUR SPA (SWITCHVIEW) & GESTION DE L'INTERFACE
  // =========================================================================
  function switchView(viewName) {
    currentView = viewName;

    // Fermer les menus déroulants ouverts
    closeAllDropdowns();

    // Mettre à jour la navigation active (Sidebar & Mobile)
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    document.querySelectorAll('.mobile-bottom-bar .mob-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Masquer toutes les sections et afficher la vue courante
    document.querySelectorAll('.view-screen').forEach(sec => {
      sec.classList.remove('active');
    });

    // Adapter les vues composites (ex: 'movies' ou 'series' -> view-catalog)
    let targetSectionId = `view-${viewName}`;
    if (viewName === 'movies' || viewName === 'series') {
      targetSectionId = 'view-catalog';
    }

    const targetSection = document.getElementById(targetSectionId);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Scroll tout en haut du viewport
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Initialisation ou rechargement selon la vue sélectionnée
    switch (viewName) {
      case 'home':
        loadHomeData();
        break;
      case 'movies':
        catalogType = 'movie';
        document.getElementById('catalogViewTitle').textContent = 'Films & Blockbusters';
        document.getElementById('catalogViewSubtitle').textContent = 'Explorez tous les chefs-d\'œuvre cinématographiques en haute définition.';
        loadCatalogData();
        break;
      case 'series':
        catalogType = 'tv';
        document.getElementById('catalogViewTitle').textContent = 'Séries Télévisées';
        document.getElementById('catalogViewSubtitle').textContent = 'Découvrez les saisons complètes et les nouvelles séries événement.';
        loadCatalogData();
        break;
      case 'explore':
        loadExploreData();
        break;
      case 'search':
        document.getElementById('dedicatedSearchInput').focus();
        if (!document.getElementById('dedicatedSearchInput').value.trim()) {
          loadSearchDiscovery();
        }
        break;
      case 'library':
        renderWishlist();
        break;
      case 'history':
        renderHistory();
        break;
      case 'downloads':
        renderDownloads();
        break;
      case 'profile':
        updateProfileUI();
        break;
      case 'settings':
        updateSettingsUI();
        break;
    }

    updateStatsCounters();
  }

  // =========================================================================
  // 5. VUE ACCUEIL : HERO BANNER & CARROUSELS MULTIPLES
  // =========================================================================
  const HOME_ROWS_CONFIG = [
    { title: 'Recommandations pour toi', endpoint: '/movie/top_rated', isTop10: false, filterType: 'movie' },
    { title: '🔥 Tendances du moment', endpoint: '/trending/all/day', isTop10: false },
    { title: '🎬 Sorties cinéma récentes', endpoint: '/movie/now_playing', isTop10: false, filterType: 'movie' },
    { title: 'Top 10 des programmes en France', endpoint: '/trending/all/week', isTop10: true },
    { title: '📺 Séries télévisées populaires', endpoint: '/tv/popular', isTop10: false, filterType: 'tv' },
    { title: '👽 Science-Fiction & Fantastique', endpoint: '/discover/movie', params: { with_genres: 878 } },
    { title: '💥 Action & Thrillers explosifs', endpoint: '/discover/movie', params: { with_genres: '28,53' } },
    { title: '😂 Comédies pour se détendre', endpoint: '/discover/movie', params: { with_genres: 35 } },
    { title: '🇫🇷 Productions françaises', endpoint: '/discover/movie', params: { with_original_language: 'fr' } },
  ];

  let homeDataLoaded = false;
  async function loadHomeData() {
    if (homeDataLoaded) return;
    try {
      // 1. Charger les données du Hero Spotlight
      const trendingData = await fetchTMDB('/trending/all/day');
      heroSlides = (trendingData.results || []).filter(item => item.backdrop_path && item.overview).slice(0, 5);
      
      if (heroSlides.length > 0) {
        setupHeroBanner(heroSlides);
      }

      // 2. Charger les rangées horizontales
      const container = document.getElementById('homeRowsContainer');
      container.innerHTML = '';

      for (const rowConfig of HOME_ROWS_CONFIG) {
        const rowData = await fetchTMDB(rowConfig.endpoint, rowConfig.params || {});
        let items = (rowData.results || []).filter(i => i.poster_path);
        if (rowConfig.filterType) {
          items = items.map(i => ({ ...i, media_type: rowConfig.filterType }));
        }
        if (rowConfig.isTop10) {
          items = items.slice(0, 10);
        }

        if (items.length > 0) {
          const rowElem = renderCarouselRow(rowConfig.title, items, rowConfig.isTop10);
          container.appendChild(rowElem);
        }
      }

      homeDataLoaded = true;
    } catch (err) {
      console.error('Erreur chargement accueil:', err);
    }
  }

  function setupHeroBanner(slides) {
    const dotsContainer = document.getElementById('heroDots');
    dotsContainer.innerHTML = '';

    slides.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.className = `hero-dot ${idx === 0 ? 'active' : ''}`;
      dot.onclick = () => showHeroSlide(idx);
      dotsContainer.appendChild(dot);
    });

    showHeroSlide(0);

    // Rotation automatique toutes les 8 secondes
    if (heroRotationTimer) clearInterval(heroRotationTimer);
    heroRotationTimer = setInterval(() => {
      currentHeroIdx = (currentHeroIdx + 1) % heroSlides.length;
      showHeroSlide(currentHeroIdx);
    }, 8500);
  }

  function showHeroSlide(index) {
    currentHeroIdx = index;
    const item = heroSlides[index];
    if (!item) return;

    const isMov = isMovie(item);
    const title = item.title || item.name || '';
    const year = (item.release_date || item.first_air_date || '2024').slice(0, 4);
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '8.0';
    const backdropUrl = item.backdrop_path ? `${TMDB_IMG_BACKDROP}${item.backdrop_path}` : FALLBACK_BACKDROP;

    document.getElementById('heroBackdrop').style.backgroundImage = `url('${backdropUrl}')`;
    document.getElementById('heroTitle').textContent = title;
    document.getElementById('heroYear').textContent = year;
    document.getElementById('heroGenre').textContent = isMov ? 'Film Cinéma' : 'Série TV';
    document.getElementById('heroRating').textContent = `★ ${rating}`;
    document.getElementById('heroSynopsis').textContent = item.overview || 'Regardez dès maintenant sur ZETFLIX.';

    // État du bouton Wishlist
    const inWishlist = wishlist.some(w => w.id === item.id);
    document.getElementById('heroWishlistText').textContent = inWishlist ? 'Dans ma liste' : 'Ajouter à ma liste';

    document.getElementById('heroPlayBtn').onclick = () => openPlayer({ ...item, media_type: isMov ? 'movie' : 'tv' });
    document.getElementById('heroWishlistBtn').onclick = () => {
      toggleWishlist({ ...item, media_type: isMov ? 'movie' : 'tv' });
      const nowIn = wishlist.some(w => w.id === item.id);
      document.getElementById('heroWishlistText').textContent = nowIn ? 'Dans ma liste' : 'Ajouter à ma liste';
    };

    // Actualiser les dots
    document.querySelectorAll('#heroDots .hero-dot').forEach((dot, idx) => {
      dot.classList.toggle('active', idx === index);
    });
  }

  function renderCarouselRow(title, items, isTop10 = false) {
    const row = document.createElement('div');
    row.className = 'catalog-row';

    const header = document.createElement('div');
    header.className = 'catalog-row-header';
    header.innerHTML = `
      <h3 class="row-heading-text">${title}</h3>
      <span class="row-view-all-link">Voir tout →</span>
    `;
    header.querySelector('.row-view-all-link').onclick = () => switchView('explore');
    row.appendChild(header);

    const slider = document.createElement('div');
    slider.className = 'catalog-row-slider';

    const track = document.createElement('div');
    track.className = 'catalog-track';

    items.forEach((item, pos) => {
      const card = createMediaCard(item, {
        topRank: isTop10 ? (pos + 1) : null,
      });
      track.appendChild(card);
    });

    const leftBtn = document.createElement('button');
    leftBtn.className = 'slider-arrow-btn left';
    leftBtn.innerHTML = '‹';
    leftBtn.onclick = () => track.scrollBy({ left: -window.innerWidth * 0.65, behavior: 'smooth' });

    const rightBtn = document.createElement('button');
    rightBtn.className = 'slider-arrow-btn right';
    rightBtn.innerHTML = '›';
    rightBtn.onclick = () => track.scrollBy({ left: window.innerWidth * 0.65, behavior: 'smooth' });

    slider.append(leftBtn, track, rightBtn);
    row.appendChild(slider);
    return row;
  }

  // =========================================================================
  // 6. GÉNÉRATEUR DE CARTES DE MÉDIAS (MEDIA CARD)
  // =========================================================================
  function createMediaCard(item, options = {}) {
    const {
      topRank = null,
      showProgress = false,
      progressPercent = 0,
      isDownload = false,
    } = options;

    const isMov = isMovie(item);
    const mediaType = isMov ? 'movie' : 'tv';
    const title = item.title || item.name || 'Titre inconnu';
    const posterUrl = item.poster_path ? `${TMDB_IMG_POSTER}${item.poster_path}` : FALLBACK_POSTER;
    const year = (item.release_date || item.first_air_date || '').slice(0, 4) || '2024';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '8.1';

    const card = document.createElement('div');
    card.className = 'media-card';
    if (topRank) {
      card.classList.add('is-top-ranked');
      card.dataset.rank = topRank;
    }

    const inWishlist = wishlist.some(w => w.id === item.id);

    card.innerHTML = `
      <div class="card-poster-box">
        <img src="${posterUrl}" alt="${title}" loading="lazy">
        <span class="card-pill-tag">${isMov ? 'Film' : 'Série'}</span>
        <span class="card-rating-float">★ ${rating}</span>
        
        <div class="card-hover-actions">
          <button class="card-circle-btn quick-play-btn" title="Regarder immédiatement">▶</button>
          <button class="card-circle-btn quick-wish-btn" title="${inWishlist ? 'Retirer' : 'Ajouter à ma liste'}">${inWishlist ? '✓' : '+'}</button>
          <button class="card-circle-btn quick-info-btn" title="Plus de détails">ℹ</button>
        </div>

        ${showProgress ? `
          <div class="card-progress-bar">
            <div class="card-progress-fill" style="width: ${progressPercent || 35}%;"></div>
          </div>
        ` : ''}
      </div>

      <div class="card-meta-caption">
        <div class="card-caption-title" title="${title}">${title}</div>
        <div class="card-caption-sub">
          <span>${year}</span>
          <span>${isDownload ? (item.size || '3.2 Go') : (isMov ? 'Ultra HD' : 'Série TV')}</span>
        </div>
      </div>
    `;

    // Événements sur la carte
    card.addEventListener('click', (e) => {
      // Si on clique sur un bouton hover spécifique
      if (e.target.closest('.quick-play-btn')) {
        e.stopPropagation();
        openPlayer({ ...item, media_type: mediaType });
        return;
      }
      if (e.target.closest('.quick-wish-btn')) {
        e.stopPropagation();
        toggleWishlist({ ...item, media_type: mediaType });
        const nowIn = wishlist.some(w => w.id === item.id);
        const btn = card.querySelector('.quick-wish-btn');
        if (btn) {
          btn.textContent = nowIn ? '✓' : '+';
          btn.title = nowIn ? 'Retirer' : 'Ajouter à ma liste';
        }
        return;
      }
      if (e.target.closest('.quick-info-btn')) {
        e.stopPropagation();
        openDetailsModal({ ...item, media_type: mediaType });
        return;
      }

      // Par défaut au clic sur la carte : ouvrir la fiche détaillée
      openDetailsModal({ ...item, media_type: mediaType });
    });

    return card;
  }

  // =========================================================================
  // 7. VUE CATALOGUE (FILMS / SÉRIES AVEC TRI)
  // =========================================================================
  async function loadCatalogData() {
    const grid = document.getElementById('catalogGrid');
    const loader = document.getElementById('catalogLoader');
    grid.innerHTML = '';
    loader.style.display = 'flex';

    try {
      const sortVal = document.getElementById('catalogSortSelect').value;
      let endpoint = catalogType === 'movie' ? '/movie/popular' : '/tv/popular';
      let params = { page: 1 };

      if (sortVal === 'rating') {
        endpoint = catalogType === 'movie' ? '/movie/top_rated' : '/tv/top_rated';
      } else if (sortVal === 'recent') {
        endpoint = catalogType === 'movie' ? '/movie/now_playing' : '/tv/on_the_air';
      }

      const data = await fetchTMDB(endpoint, params);
      loader.style.display = 'none';

      const items = (data.results || []).filter(i => i.poster_path);
      items.forEach(item => {
        grid.appendChild(createMediaCard({ ...item, media_type: catalogType }));
      });
    } catch (err) {
      loader.style.display = 'none';
      grid.innerHTML = `<div class="empty-state-card"><p>Erreur lors du chargement des titres.</p></div>`;
    }
  }

  // =========================================================================
  // 8. VUE EXPLORER (FILTRES COMBINABLES)
  // =========================================================================
  let exploreDataCache = [];
  async function loadExploreData() {
    const grid = document.getElementById('exploreGrid');
    const loader = document.getElementById('exploreLoader');
    grid.innerHTML = '';
    loader.style.display = 'flex';

    try {
      const genre = document.getElementById('exploreGenreSelect').value;
      const type = document.getElementById('exploreTypeSelect').value;
      const year = document.getElementById('exploreYearSelect').value;
      const sort = document.getElementById('exploreOrderSelect').value;

      const targetType = type === 'tv' ? 'tv' : 'movie';
      const params = {
        sort_by: sort,
        page: 1,
      };

      if (genre) params.with_genres = genre;
      if (year) {
        if (year === '2020s') {
          params['primary_release_date.gte'] = '2020-01-01';
        } else if (year === '2010s') {
          params['primary_release_date.gte'] = '2010-01-01';
          params['primary_release_date.lte'] = '2019-12-31';
        } else if (year === '2000s') {
          params['primary_release_date.lte'] = '2009-12-31';
        } else {
          params.primary_release_year = year;
        }
      }

      const data = await fetchTMDB(`/discover/${targetType}`, params);
      loader.style.display = 'none';

      exploreDataCache = (data.results || []).filter(i => i.poster_path);
      exploreDataCache.forEach(item => {
        grid.appendChild(createMediaCard({ ...item, media_type: targetType }));
      });
    } catch (err) {
      loader.style.display = 'none';
      grid.innerHTML = `<div class="empty-state-card"><p>Aucun titre trouvé avec ces filtres.</p></div>`;
    }
  }

  // =========================================================================
  // 9. VUE RECHERCHE AVANCÉE (LIVE RECHERCHE AVEC FILTRES PILLS)
  // =========================================================================
  async function loadSearchDiscovery() {
    const grid = document.getElementById('searchResultsGrid');
    const meta = document.getElementById('searchResultsMeta');
    const empty = document.getElementById('searchEmptyState');
    grid.innerHTML = '';
    empty.style.display = 'none';
    meta.style.display = 'block';
    document.getElementById('searchResultsCount').textContent = 'Titres populaires recommandés';

    try {
      const data = await fetchTMDB('/trending/all/day');
      const items = (data.results || []).filter(i => i.poster_path).slice(0, 18);
      items.forEach(item => grid.appendChild(createMediaCard(item)));
    } catch (e) {}
  }

  async function performDedicatedSearch(query) {
    const grid = document.getElementById('searchResultsGrid');
    const meta = document.getElementById('searchResultsMeta');
    const empty = document.getElementById('searchEmptyState');
    const countLabel = document.getElementById('searchResultsCount');

    if (!query || query.length < 2) {
      loadSearchDiscovery();
      return;
    }

    grid.innerHTML = '';
    empty.style.display = 'none';
    meta.style.display = 'block';
    countLabel.textContent = `Recherche de « ${query} » en cours...`;

    try {
      let endpoint = '/search/multi';
      if (activeSearchCategory === 'movie') endpoint = '/search/movie';
      else if (activeSearchCategory === 'tv') endpoint = '/search/tv';

      const data = await fetchTMDB(endpoint, { query });
      let results = (data.results || []).filter(i => i.poster_path && (i.title || i.name));

      // Filtrer par genre si sélectionné
      if (typeof activeSearchCategory === 'number') {
        results = results.filter(i => i.genre_ids && i.genre_ids.includes(activeSearchCategory));
      }

      if (results.length > 0) {
        countLabel.textContent = `${results.length} résultat${results.length > 1 ? 's' : ''} trouvé${results.length > 1 ? 's' : ''}`;
        results.forEach(item => grid.appendChild(createMediaCard(item)));
      } else {
        meta.style.display = 'none';
        empty.style.display = 'flex';
      }
    } catch (err) {
      countLabel.textContent = 'Erreur lors de la recherche.';
    }
  }

  // =========================================================================
  // 10. MA LISTE (WISHLIST) & HISTORIQUE DE VISIONNAGE
  // =========================================================================
  function toggleWishlist(item) {
    const idx = wishlist.findIndex(w => w.id === item.id);
    if (idx >= 0) {
      wishlist.splice(idx, 1);
    } else {
      wishlist.unshift({
        id: item.id,
        title: item.title || item.name || '',
        media_type: isMovie(item) ? 'movie' : 'tv',
        poster_path: item.poster_path,
        backdrop_path: item.backdrop_path,
        vote_average: item.vote_average,
        release_date: item.release_date || item.first_air_date,
        overview: item.overview,
        addedAt: Date.now(),
      });
    }
    storageSet(STORAGE_KEYS.wishlist, wishlist);
    updateStatsCounters();
    if (currentView === 'library') renderWishlist();
  }

  function renderWishlist() {
    const grid = document.getElementById('libraryGrid');
    const empty = document.getElementById('libraryEmptyState');
    grid.innerHTML = '';

    if (wishlist.length === 0) {
      empty.style.display = 'flex';
      document.getElementById('wishlistStatsSubtitle').textContent = 'Votre bibliothèque est actuellement vide.';
    } else {
      empty.style.display = 'none';
      document.getElementById('wishlistStatsSubtitle').textContent = `${wishlist.length} titre${wishlist.length > 1 ? 's' : ''} enregistré${wishlist.length > 1 ? 's' : ''} pour plus tard.`;
      wishlist.forEach(item => {
        grid.appendChild(createMediaCard(item));
      });
    }
  }

  function saveHistory(item, season = 1, episode = 1, progress = 25) {
    const isMov = isMovie(item);
    const existingIdx = historyList.findIndex(h => h.id === item.id);

    const historyEntry = {
      id: item.id,
      title: item.title || item.name || '',
      media_type: isMov ? 'movie' : 'tv',
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average,
      release_date: item.release_date || item.first_air_date,
      overview: item.overview,
      season,
      episode,
      progress,
      updatedAt: Date.now(),
    };

    if (existingIdx >= 0) {
      historyList.splice(existingIdx, 1);
    }
    historyList.unshift(historyEntry);
    storageSet(STORAGE_KEYS.history, historyList);
    updateStatsCounters();
  }

  function renderHistory() {
    const grid = document.getElementById('historyGrid');
    const empty = document.getElementById('historyEmptyState');
    grid.innerHTML = '';

    if (historyList.length === 0) {
      empty.style.display = 'flex';
    } else {
      empty.style.display = 'none';
      historyList.forEach(item => {
        grid.appendChild(createMediaCard(item, {
          showProgress: true,
          progressPercent: item.progress || 35,
        }));
      });
    }
  }

  function renderDownloads() {
    const grid = document.getElementById('downloadsGrid');
    grid.innerHTML = '';
    downloadsList.forEach(item => {
      grid.appendChild(createMediaCard(item, {
        isDownload: true,
        showProgress: true,
        progressPercent: 100,
      }));
    });
  }

  function updateStatsCounters() {
    const wCount = wishlist.length;
    const hCount = historyList.length;
    const dCount = downloadsList.length;

    // Badge sidebar
    const sideBadge = document.getElementById('sidebarWishlistCount');
    if (sideBadge) {
      sideBadge.textContent = wCount;
      sideBadge.style.display = wCount > 0 ? 'inline-block' : 'none';
    }

    // Statistiques profil
    const statH = document.getElementById('profileStatHistoryVal');
    const statW = document.getElementById('profileStatWishlistVal');
    const statD = document.getElementById('profileStatDownloadsVal');
    if (statH) statH.textContent = `(${hCount})`;
    if (statW) statW.textContent = `(${wCount})`;
    if (statD) statD.textContent = `(${dCount})`;
  }

  // =========================================================================
  // 11. FICHE DÉTAILLÉE D'UN FILM / SÉRIE (DETAILS MODAL)
  // =========================================================================
  let currentModalMedia = null;
  async function openDetailsModal(item) {
    currentModalMedia = item;
    const isMov = isMovie(item);
    const id = item.id;

    // Remplissage initial immédiat avec les données disponibles
    const title = item.title || item.name || '';
    const rating = item.vote_average ? item.vote_average.toFixed(1) : '8.2';
    const year = (item.release_date || item.first_air_date || '2024').slice(0, 4);
    const backdropUrl = item.backdrop_path ? `${TMDB_IMG_BACKDROP}${item.backdrop_path}` : (item.poster_path ? `${TMDB_IMG_POSTER}${item.poster_path}` : FALLBACK_BACKDROP);

    document.getElementById('modalBackdropImg').src = backdropUrl;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalTypeBadge').textContent = isMov ? 'FILM' : 'SÉRIE';
    document.getElementById('modalRating').textContent = `★ ${rating}`;
    document.getElementById('modalYear').textContent = year;
    document.getElementById('modalRuntime').textContent = isMov ? '2h 15min' : 'Saisons complètes';
    document.getElementById('modalOverview').textContent = item.overview || 'Synopsis détaillé indisponible.';

    // Wishlist état
    const inWish = wishlist.some(w => w.id === id);
    document.getElementById('modalWishlistText').textContent = inWish ? 'Dans ma liste' : 'Ajouter à ma liste';

    document.getElementById('modalPlayBtn').onclick = () => {
      closeDetailsModal();
      openPlayer({ ...item, media_type: isMov ? 'movie' : 'tv' });
    };

    document.getElementById('modalWishlistBtn').onclick = () => {
      toggleWishlist({ ...item, media_type: isMov ? 'movie' : 'tv' });
      const nowIn = wishlist.some(w => w.id === id);
      document.getElementById('modalWishlistText').textContent = nowIn ? 'Dans ma liste' : 'Ajouter à ma liste';
    };

    // Gestion des saisons si c'est une série
    const episodesBlock = document.getElementById('modalSeriesEpisodesBlock');
    if (!isMov) {
      episodesBlock.style.display = 'block';
      loadModalSeasons(id);
    } else {
      episodesBlock.style.display = 'none';
    }

    // Charger les détails approfondis et titres similaires
    loadModalDeepDetails(id, isMov);

    // Afficher la modale
    document.getElementById('detailsModal').classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('active');
    document.body.style.overflow = '';
    currentModalMedia = null;
  }

  async function loadModalDeepDetails(id, isMov) {
    try {
      const type = isMov ? 'movie' : 'tv';
      const details = await fetchTMDB(`/${type}/${id}`);

      if (details.genres && details.genres.length > 0) {
        document.getElementById('modalGenres').textContent = details.genres.map(g => g.name).join(', ');
      }
      if (details.runtime) {
        const hrs = Math.floor(details.runtime / 60);
        const mins = details.runtime % 60;
        document.getElementById('modalRuntime').textContent = `${hrs}h ${mins}min`;
      }

      // Titres similaires
      const simData = await fetchTMDB(`/${type}/${id}/similar`);
      const simTrack = document.getElementById('modalSimilarTrack');
      simTrack.innerHTML = '';
      (simData.results || []).filter(i => i.poster_path).slice(0, 8).forEach(simItem => {
        simTrack.appendChild(createMediaCard({ ...simItem, media_type: type }));
      });
    } catch (e) {}
  }

  async function loadModalSeasons(tvId) {
    const seasonSelect = document.getElementById('modalSeasonSelect');
    seasonSelect.innerHTML = '<option>Chargement des saisons...</option>';
    try {
      const tvData = await fetchTMDB(`/tv/${tvId}`);
      const seasons = (tvData.seasons || []).filter(s => s.season_number > 0);
      seasonSelect.innerHTML = '';

      seasons.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.season_number;
        opt.textContent = `Saison ${s.season_number} (${s.episode_count} épisodes)`;
        seasonSelect.appendChild(opt);
      });

      seasonSelect.onchange = () => loadModalEpisodes(tvId, seasonSelect.value);
      if (seasons.length > 0) {
        loadModalEpisodes(tvId, seasons[0].season_number);
      }
    } catch (e) {
      seasonSelect.innerHTML = '<option value="1">Saison 1</option>';
    }
  }

  async function loadModalEpisodes(tvId, seasonNumber) {
    const list = document.getElementById('modalEpisodesList');
    list.innerHTML = '<div style="color:var(--text-muted);padding:8px;">Chargement des épisodes...</div>';
    try {
      const seasonData = await fetchTMDB(`/tv/${tvId}/season/${seasonNumber}`);
      list.innerHTML = '';
      (seasonData.episodes || []).forEach(ep => {
        const row = document.createElement('div');
        row.className = 'episode-card-row';
        row.innerHTML = `
          <span>Épisode ${ep.episode_number} — ${ep.name || 'Épisode'}</span>
          <span style="color:var(--secondary-purple);font-size:0.8rem;">▶ Regarder</span>
        `;
        row.onclick = () => {
          closeDetailsModal();
          openPlayer(currentModalMedia, seasonNumber, ep.episode_number);
        };
        list.appendChild(row);
      });
    } catch (e) {
      list.innerHTML = '<div style="color:var(--text-muted);padding:8px;">Épisodes non disponibles.</div>';
    }
  }

  // =========================================================================
  // 12. LECTEUR VIDÉO IMMERSIF (VIDZY + MULTI-SERVEURS SANS PUB)
  // =========================================================================
  function openPlayer(item, season = 1, episode = 1) {
    activeMedia = item;
    currentSeason = season;
    currentEpisode = episode;
    const isMov = isMovie(item);
    const title = item.title || item.name || 'Titre inconnu';

    document.getElementById('playerTitle').textContent = title;
    const epBadge = document.getElementById('playerEpisodeBadge');
    if (!isMov) {
      epBadge.textContent = `S${season} : E${episode}`;
      epBadge.style.display = 'inline-block';
    } else {
      epBadge.style.display = 'none';
    }

    // Réinitialiser la progression et le temps
    playerCurrentSeconds = 1458; // 24:18 (maquette)
    playerTotalSeconds = 8895;   // 2:28:15
    updatePlayerTimeUI();

    // Mettre à jour l'iframe
    updatePlayerEmbed();

    // Sauvegarder dans l'historique
    saveHistory(item, season, episode, 25);

    // Afficher l'overlay
    document.getElementById('videoPlayerModal').classList.add('active');
    document.body.style.overflow = 'hidden';

    // Démarrer le ticker de progression
    startPlayerTicker();
  }

  function closePlayer() {
    document.getElementById('videoPlayerModal').classList.remove('active');
    document.getElementById('streamingIframe').src = '';
    document.body.style.overflow = '';
    activeMedia = null;
    if (playerTicker) clearInterval(playerTicker);

    if (currentView === 'history') renderHistory();
  }

  function updatePlayerEmbed() {
    if (!activeMedia) return;
    const loader = document.getElementById('playerLoaderSpinner');
    const iframe = document.getElementById('streamingIframe');
    loader.style.display = 'flex';

    const isMov = isMovie(activeMedia);
    const id = activeMedia.id;
    let embedUrl = '';

    const params = new URLSearchParams({
      color: '751BEB', // Violet officiel Dark Cinema
      autoplay: '1',
    });
    if (currentLang) params.set('lang', currentLang);

    if (currentServer === 'vidzy') {
      if (isMov) {
        embedUrl = `https://vidzy.org/movie/${id}?${params.toString()}`;
      } else {
        params.set('autonext', '1');
        embedUrl = `https://vidzy.org/serie/${id}/${currentSeason}/${currentEpisode}?${params.toString()}`;
      }
    } else if (currentServer === 'vidsrc') {
      embedUrl = isMov
        ? `https://vidsrc.to/embed/movie/${id}`
        : `https://vidsrc.to/embed/tv/${id}/${currentSeason}/${currentEpisode}`;
    } else if (currentServer === 'embedsu') {
      embedUrl = isMov
        ? `https://embed.su/embed/movie/${id}`
        : `https://embed.su/embed/tv/${id}/${currentSeason}/${currentEpisode}`;
    } else if (currentServer === 'superembed') {
      embedUrl = isMov
        ? `https://multiembed.mov/?video_id=${id}&tmdb=1`
        : `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${currentSeason}&e=${currentEpisode}`;
    }

    iframe.src = embedUrl;
    iframe.onload = () => {
      loader.style.display = 'none';
    };
  }

  function startPlayerTicker() {
    if (playerTicker) clearInterval(playerTicker);
    playerTicker = setInterval(() => {
      if (isPlaying && playerCurrentSeconds < playerTotalSeconds) {
        playerCurrentSeconds += 1;
        updatePlayerTimeUI();
      }
    }, 1000);
  }

  function updatePlayerTimeUI() {
    const fill = document.getElementById('playerProgressFill');
    const timeDisp = document.getElementById('playerTimeDisplay');
    const pct = Math.min(100, Math.max(0, (playerCurrentSeconds / playerTotalSeconds) * 100));

    fill.style.width = `${pct}%`;
    timeDisp.textContent = `${formatTime(playerCurrentSeconds)} / ${formatTime(playerTotalSeconds)}`;
  }

  // =========================================================================
  // 13. PROFIL & PARAMÈTRES (SETTINGS)
  // =========================================================================
  function updateProfileUI() {
    document.getElementById('profileHeroName').innerHTML = `${profile.name} <span class="crown-hero">👑</span>`;
    document.getElementById('sidebarUserName').textContent = profile.name;
    document.getElementById('profilePageAvatar').src = profile.avatar;
    document.getElementById('sidebarAvatarImg').src = profile.avatar;
    document.getElementById('topbarAvatarImg').src = profile.avatar;
    document.querySelector('.profile-mini-name').textContent = profile.name;
    document.getElementById('settingsAccountName').textContent = profile.name;
  }

  function updateSettingsUI() {
    document.getElementById('tmdbApiKeyInput').value = apiKey;
    document.getElementById('preferredServerSelect').value = settings.preferredServer || 'vidzy';
    document.getElementById('playbackQualitySelect').value = settings.playbackQuality || 'auto';
    document.getElementById('smoothAnimToggle').checked = settings.smoothAnim !== false;

    // IP locale pour TV Cast
    const host = window.location.hostname || '192.168.1.8';
    const port = window.location.port ? `:${window.location.port}` : '';
    document.getElementById('tvLocalUrl').textContent = `http://${host}${port}/`;
  }

  function exportUserData() {
    const data = {
      version: '3.0',
      exportDate: new Date().toISOString(),
      profile,
      wishlist,
      history: historyList,
      downloads: downloadsList,
      settings,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zetflix_sauvegarde_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importUserData(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed.wishlist) {
          wishlist = parsed.wishlist;
          storageSet(STORAGE_KEYS.wishlist, wishlist);
        }
        if (parsed.history) {
          historyList = parsed.history;
          storageSet(STORAGE_KEYS.history, historyList);
        }
        if (parsed.profile) {
          profile = parsed.profile;
          storageSet(STORAGE_KEYS.profile, profile);
          updateProfileUI();
        }
        alert('✅ Sauvegarde ZETFLIX restaurée avec succès !');
        updateStatsCounters();
        switchView('home');
      } catch (err) {
        alert('⚠️ Fichier de sauvegarde invalide.');
      }
    };
    reader.readAsText(file);
  }

  // =========================================================================
  // 14. MENUS DÉROULANTS (NOTIFICATIONS, PROFIL, FULLSCREEN)
  // =========================================================================
  function closeAllDropdowns() {
    document.getElementById('notifDropdownPanel').classList.remove('active');
    document.getElementById('profileDropdownPanel').classList.remove('active');
    document.getElementById('searchGenreDropdown').classList.remove('active');
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }

  // =========================================================================
  // 15. INITIALISATION DES ÉCOUTEURS D'ÉVÉNEMENTS
  // =========================================================================
  function initEventListeners() {
    // 1. Navigation Sidebar & Mobile
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.querySelectorAll('.mobile-bottom-bar .mob-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => switchView(btn.dataset.view));
    });
    document.getElementById('sidebarUserCard').addEventListener('click', () => switchView('profile'));
    document.getElementById('brandLogo').addEventListener('click', () => switchView('home'));

    // 2. Recherche Globale (Topbar)
    const globalInput = document.getElementById('globalSearchInput');
    const globalClear = document.getElementById('globalSearchClear');
    globalInput.addEventListener('input', (e) => {
      const q = e.target.value;
      globalClear.style.display = q ? 'block' : 'none';
      if (currentView !== 'search') {
        switchView('search');
      }
      document.getElementById('dedicatedSearchInput').value = q;
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => performDedicatedSearch(q.trim()), 350);
    });

    globalClear.addEventListener('click', () => {
      globalInput.value = '';
      globalClear.style.display = 'none';
      document.getElementById('dedicatedSearchInput').value = '';
      loadSearchDiscovery();
    });

    // 3. Recherche Avancée (Vue dédiée)
    const dedicatedInput = document.getElementById('dedicatedSearchInput');
    const dedicatedClear = document.getElementById('dedicatedSearchClear');
    dedicatedInput.addEventListener('input', (e) => {
      const q = e.target.value;
      dedicatedClear.style.display = q ? 'block' : 'none';
      globalInput.value = q;
      globalClear.style.display = q ? 'block' : 'none';
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => performDedicatedSearch(q.trim()), 350);
    });

    dedicatedClear.addEventListener('click', () => {
      dedicatedInput.value = '';
      dedicatedClear.style.display = 'none';
      globalInput.value = '';
      globalClear.style.display = 'none';
      loadSearchDiscovery();
    });

    // Filtres pills de recherche
    document.querySelectorAll('.search-filter-pills .filter-pill[data-sfilter]').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.search-filter-pills .filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        activeSearchCategory = pill.dataset.sfilter;
        performDedicatedSearch(dedicatedInput.value.trim());
      });
    });

    // Dropdown Genre de recherche
    const genrePillBtn = document.getElementById('searchGenreFilterBtn');
    const genreDropdown = document.getElementById('searchGenreDropdown');
    genrePillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      genreDropdown.classList.toggle('active');
    });

    genreDropdown.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const gid = parseInt(btn.dataset.genreId, 10);
        genrePillBtn.textContent = btn.textContent;
        activeSearchCategory = gid;
        genreDropdown.classList.remove('active');
        performDedicatedSearch(dedicatedInput.value.trim());
      });
    });

    // 4. Filtres de la vue Catalogue & Explorer
    document.getElementById('catalogSortSelect').addEventListener('change', loadCatalogData);
    document.getElementById('exploreGenreSelect').addEventListener('change', loadExploreData);
    document.getElementById('exploreTypeSelect').addEventListener('change', loadExploreData);
    document.getElementById('exploreYearSelect').addEventListener('change', loadExploreData);
    document.getElementById('exploreOrderSelect').addEventListener('change', loadExploreData);

    document.getElementById('resetExploreFiltersBtn').addEventListener('click', () => {
      document.getElementById('exploreGenreSelect').value = '';
      document.getElementById('exploreTypeSelect').value = 'all';
      document.getElementById('exploreYearSelect').value = '';
      document.getElementById('exploreOrderSelect').value = 'popularity.desc';
      loadExploreData();
    });

    document.getElementById('surpriseMeBtn').addEventListener('click', () => {
      if (exploreDataCache.length > 0) {
        const randomItem = exploreDataCache[Math.floor(Math.random() * exploreDataCache.length)];
        openDetailsModal(randomItem);
      }
    });

    // 5. Actions Vues Bibliothèque & Historique
    document.getElementById('clearWishlistBtn').addEventListener('click', () => {
      if (confirm('Voulez-vous retirer tous les titres de votre liste ?')) {
        wishlist = [];
        storageSet(STORAGE_KEYS.wishlist, wishlist);
        renderWishlist();
        updateStatsCounters();
      }
    });

    document.getElementById('clearHistoryBtn').addEventListener('click', () => {
      if (confirm('Effacer tout votre historique de visionnage ?')) {
        historyList = [];
        storageSet(STORAGE_KEYS.history, historyList);
        renderHistory();
        updateStatsCounters();
      }
    });

    // 6. Profil Edit
    document.getElementById('editProfileBtn').addEventListener('click', () => {
      const newName = prompt('Nom de votre profil :', profile.name);
      if (newName && newName.trim()) {
        profile.name = newName.trim();
        storageSet(STORAGE_KEYS.profile, profile);
        updateProfileUI();
      }
    });

    // 7. Paramètres (Settings)
    document.querySelectorAll('.settings-nav-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        document.querySelectorAll('.settings-nav-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        const targetId = `spanel-${pill.dataset.spanel}`;
        document.querySelectorAll('.settings-panel').forEach(pan => pan.classList.remove('active'));
        const pan = document.getElementById(targetId);
        if (pan) pan.classList.add('active');
      });
    });

    document.getElementById('saveApiKeyBtn').addEventListener('click', () => {
      const val = document.getElementById('tmdbApiKeyInput').value.trim();
      if (val) {
        apiKey = val;
        localStorage.setItem('tmdb_api_key', apiKey);
        alert('✅ Clé TMDB enregistrée !');
        homeDataLoaded = false;
        loadHomeData();
      }
    });

    document.getElementById('exportBackupBtn').addEventListener('click', exportUserData);
    document.getElementById('importBackupInput').addEventListener('change', importUserData);

    document.getElementById('preferredServerSelect').addEventListener('change', (e) => {
      currentServer = e.target.value;
      settings.preferredServer = currentServer;
      storageSet(STORAGE_KEYS.settings, settings);
      const playerServer = document.getElementById('playerServerSelect');
      if (playerServer) playerServer.value = currentServer;
    });

    document.getElementById('copyTvUrlBtn').addEventListener('click', () => {
      const text = document.getElementById('tvLocalUrl').textContent;
      navigator.clipboard.writeText(text).then(() => {
        alert(`📺 Adresse copiée :\n${text}\nOuvrez ce lien dans le navigateur de votre TV !`);
      }).catch(() => {
        prompt('Copiez ce lien pour votre TV :', text);
      });
    });

    // 8. Modale Détails
    document.getElementById('closeDetailsBtn').addEventListener('click', closeDetailsModal);
    document.getElementById('closeDetailsBackdrop').addEventListener('click', closeDetailsModal);

    // 9. Lecteur Vidéo
    document.getElementById('playerExitBtn').addEventListener('click', closePlayer);
    document.getElementById('playerServerSelect').addEventListener('change', (e) => {
      currentServer = e.target.value;
      updatePlayerEmbed();
    });
    document.getElementById('playerLangSelect').addEventListener('change', (e) => {
      currentLang = e.target.value;
      updatePlayerEmbed();
    });

    // Barre de progression cliquable dans le lecteur
    const progWrap = document.getElementById('playerProgressWrap');
    progWrap.addEventListener('click', (e) => {
      const rect = progWrap.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const ratio = Math.max(0, Math.min(1, clickX / rect.width));
      playerCurrentSeconds = Math.floor(ratio * playerTotalSeconds);
      updatePlayerTimeUI();
    });

    // Boutons -10s, +10s, Play/Pause
    document.getElementById('playerRewind10Btn').addEventListener('click', () => {
      playerCurrentSeconds = Math.max(0, playerCurrentSeconds - 10);
      updatePlayerTimeUI();
    });
    document.getElementById('playerForward10Btn').addEventListener('click', () => {
      playerCurrentSeconds = Math.min(playerTotalSeconds, playerCurrentSeconds + 10);
      updatePlayerTimeUI();
    });
    document.getElementById('playerPlayPauseBtn').addEventListener('click', () => {
      isPlaying = !isPlaying;
      document.getElementById('iconPlay').style.display = isPlaying ? 'none' : 'block';
      document.getElementById('iconPause').style.display = isPlaying ? 'block' : 'none';
    });

    document.getElementById('playerVolumeBtn').addEventListener('click', () => {
      isMuted = !isMuted;
      document.getElementById('playerVolumeBtn').style.opacity = isMuted ? '0.4' : '1';
    });

    document.getElementById('playerFullscreenToggleBtn').addEventListener('click', () => {
      const player = document.getElementById('videoPlayerModal');
      if (!document.fullscreenElement) {
        player.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    document.getElementById('playerCastBtn').addEventListener('click', () => {
      const url = document.getElementById('tvLocalUrl').textContent;
      alert(`📺 Diffusion Smart TV :\nOuvrez l'adresse ${url} sur votre téléviseur pour lire ce film en direct.`);
    });

    document.getElementById('markWatchedCheckBtn').addEventListener('click', () => {
      if (activeMedia) {
        saveHistory(activeMedia, currentSeason, currentEpisode, 100);
        playerCurrentSeconds = playerTotalSeconds;
        updatePlayerTimeUI();
        alert('✓ Marqué comme vu !');
      }
    });

    // 10. Topbar Menus Déroulants & Fullscreen
    document.getElementById('toggleFullscreenBtn').addEventListener('click', toggleFullscreen);

    const notifBtn = document.getElementById('notifBellBtn');
    const notifPanel = document.getElementById('notifDropdownPanel');
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifPanel.classList.toggle('active');
      document.getElementById('profileDropdownPanel').classList.remove('active');
    });

    const profTrigger = document.getElementById('topbarProfileTrigger');
    const profPanel = document.getElementById('profileDropdownPanel');
    profTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      profPanel.classList.toggle('active');
      notifPanel.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
      if (!notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
        notifPanel.classList.remove('active');
      }
      if (!profPanel.contains(e.target) && !profTrigger.contains(e.target)) {
        profPanel.classList.remove('active');
      }
      if (!genreDropdown.contains(e.target) && !genrePillBtn.contains(e.target)) {
        genreDropdown.classList.remove('active');
      }
    });

    // Actions dans le menu profil
    document.querySelectorAll('.profile-panel [data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        profPanel.classList.remove('active');
        const act = btn.dataset.action;
        if (act === 'go-profile') switchView('profile');
        else if (act === 'go-library') switchView('library');
        else if (act === 'go-settings') switchView('settings');
        else if (act === 'cast-tv') {
          switchView('settings');
          const pill = document.querySelector('.settings-nav-pill[data-spanel="playback"]');
          if (pill) pill.click();
        } else if (act === 'logout') {
          if (confirm('Voulez-vous vous déconnecter ?')) {
            switchView('home');
          }
        }
      });
    });

    // Raccourci touche Échap pour fermer les modales
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (document.getElementById('videoPlayerModal').classList.contains('active')) {
          closePlayer();
        } else if (document.getElementById('detailsModal').classList.contains('active')) {
          closeDetailsModal();
        } else {
          closeAllDropdowns();
        }
      }
    });
  }

  // =========================================================================
  // 16. EXPOSITION DE L'OBJET GLOBAL WINDOW.APP & DÉMARRAGE
  // =========================================================================
  window.app = {
    switchView,
    openDetailsModal,
    closeDetailsModal,
    openPlayer,
    closePlayer,
    toggleWishlist,
  };

  document.addEventListener('DOMContentLoaded', () => {
    updateProfileUI();
    updateStatsCounters();
    initEventListeners();
    switchView('home');
  });

})();
