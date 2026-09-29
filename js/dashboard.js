// Dashboard: loads data/movies_clean.csv, wires up filters/switches, and
// renders summary numbers, charts, a genre picker, movie search, a genre
// face-off, and a leaderboard/table — all recomputed live from the
// currently-filtered rows.

let ALL_ROWS = [];
let TOP_LANGUAGES = [];
let chart1ViewType = 'bar';

const state = { filters: { genre: '', decade: '', language: '', financial: '' } };

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';
const GENRE_ACCENT_ORDER = [
  'Drama', 'Comedy', 'Action', 'Horror', 'Documentary', 'Animation', 'Thriller', 'Crime',
  'Romance', 'Adventure', 'Family', 'Science Fiction', 'TV Movie', 'Music', 'Fantasy',
  'Mystery', 'Western', 'War', 'History',
];
const RATING_TIER_ORDER = ['<5', '5-6', '6-7', '7-8', '8+'];
const BREAKDOWN_LABELS_PLURAL = { genre: 'genres', decade: 'decades', language: 'original languages', rating_tier: 'rating tiers' };

function genreAccentColor(genre) {
  const idx = GENRE_ACCENT_ORDER.indexOf(genre);
  return idx === -1 ? cssVar('--gold') : cssVar(`--series-${(idx % 8) + 1}`);
}

function setAmbientAccent(genre) {
  if (genre) document.documentElement.style.setProperty('--accent-live', genreAccentColor(genre));
  else document.documentElement.style.removeProperty('--accent-live');
}

function renderHeroBackdrop(posters) {
  const el = document.getElementById('hero-backdrop');
  if (!el) return;
  el.innerHTML = posters.slice(0, 16).map((p) => `<img src="${POSTER_BASE}${p.poster_path}" alt="" loading="lazy">`).join('');
}

function renderMiniMarquee(posters) {
  const row = document.getElementById('marquee-row-1');
  if (!row) return;
  row.innerHTML = posters.concat(posters).map((p) => `
    <div class="poster-card" title="${p.title}"><img src="${POSTER_BASE}${p.poster_path}" alt="${p.title} poster" loading="lazy"></div>
  `).join('');
}

function breakdownKeyFns(topLangSet) {
  return {
    genre: (r) => r.primary_genre,
    decade: (r) => `${r.decade}s`,
    language: (r) => (topLangSet.has(r.original_language) ? r.original_language : 'Other'),
    rating_tier: (r) => r.rating_tier,
  };
}

function sortEntries(breakdownType, entries) {
  if (breakdownType === 'decade') return entries.sort((a, b) => parseInt(a.label) - parseInt(b.label));
  if (breakdownType === 'rating_tier') return entries.sort((a, b) => RATING_TIER_ORDER.indexOf(a.label) - RATING_TIER_ORDER.indexOf(b.label));
  if (breakdownType === 'language') return entries.sort((a, b) => (a.label === 'Other' ? 1 : b.label === 'Other' ? -1 : b.n - a.n));
  return entries.sort((a, b) => b.value - a.value);
}

function aggregateBreakdown(rows, breakdownType, measure) {
  const keyFn = breakdownKeyFns(new Set(TOP_LANGUAGES))[breakdownType];
  const groups = groupBy(rows, keyFn);
  const entries = [...groups.entries()].map(([label, g]) => ({ label, n: g.length, value: computeMeasure(g, measure) }));
  return sortEntries(breakdownType, entries);
}

function applyFilters() {
  return ALL_ROWS.filter((r) => {
    if (state.filters.genre && r.primary_genre !== state.filters.genre) return false;
    if (state.filters.decade && `${r.decade}s` !== state.filters.decade) return false;
    if (state.filters.language && r.original_language !== state.filters.language) return false;
    if (state.filters.financial === 'yes' && !r.has_financials) return false;
    return true;
  });
}

function renderStats(rows) {
  animateValue(document.getElementById('stat-count'), rows.length, { decimals: 0 });
  const rated = rows.filter((r) => r.vote_average > 0);
  animateValue(document.getElementById('stat-rating'), rated.length ? mean(rated.map((r) => r.vote_average)) : 0, { decimals: 2 });
  const popular = rows.filter((r) => r.popularity > 0);
  animateValue(document.getElementById('stat-popularity'), popular.length ? mean(popular.map((r) => r.popularity)) : 0, { decimals: 1 });
  const fin = rows.filter((r) => r.has_financials);
  const yEl = document.getElementById('stat-yield');
  if (fin.length) animateValue(yEl, median(fin.map((r) => r.yield)), { decimals: 2, suffix: 'x' });
  else { yEl.textContent = 'n/a'; yEl.dataset.raw = 0; }
}

function updateChart1Caption(breakdown, measure, entries) {
  const el = document.getElementById('chart1-caption');
  if (!el) return;
  if (!entries.length) { el.textContent = 'No rows match the current filters.'; return; }
  const top = entries[0];
  const hint = breakdown === 'genre' ? ' Hover a bar for its defining title.' : '';
  el.textContent = `Showing ${entries.length} ${BREAKDOWN_LABELS_PLURAL[breakdown]}, ranked by ${MEASURE_LABELS[measure].toLowerCase()}. `
    + `${top.label} leads at ${fmtNumber(top.value, measure)}.${hint}`;
}

function renderBarChart(chartNum, rows) {
  const measure = document.querySelector(`select[data-role="measure"][data-chart="${chartNum}"]`).value;
  const breakdown = document.querySelector(`select[data-role="breakdown"][data-chart="${chartNum}"]`).value;
  const entries = aggregateBreakdown(rows, breakdown, measure);
  const colorVar = ['--series-1', '--series-3', '--series-5'][chartNum - 1] || '--gold';
  const isGenre = breakdown === 'genre';

  if (chartNum === 1) updateChart1Caption(breakdown, measure, entries);

  if (chartNum === 1 && chart1ViewType === 'radial') {
    lazyChart('chart-1', () => radialBarOption(
      entries.map((e) => e.label), entries.map((e) => e.value),
      { color: cssVar(colorVar), valueFormatter: (v) => fmtNumber(v, measure) },
    ));
    return;
  }

  lazyChart(`chart-${chartNum}`, () => barOption(
    entries.map((e) => e.label), entries.map((e) => e.value),
    { color: cssVar(colorVar), valueFormatter: (v) => fmtNumber(v, measure), genreAware: isGenre },
  ), isGenre ? (chart) => addPosterToppers(chart, entries.map((e, i) => ({ label: e.label, x: i, y: e.value }))) : undefined);
}

function renderBubbleChart(rows) {
  const groupByType = document.getElementById('bubble-groupby').value;
  const sizeBy = document.getElementById('bubble-sizeby').value;
  const keyFn = breakdownKeyFns(new Set(TOP_LANGUAGES))[groupByType];
  const groups = groupBy(rows.filter((r) => r.has_financials), keyFn);

  const points = [...groups.entries()]
    .filter(([, g]) => g.length >= 5)
    .map(([label, g]) => ({
      label, x: mean(g.map((r) => r.budget)), y: mean(g.map((r) => r.revenue)),
      n: g.length, medYield: median(g.map((r) => r.yield)),
    }))
    .map((p) => ({ ...p, r: sizeBy === 'count' ? p.n : p.medYield, tooltipExtra: `n=${p.n} · median yield ${p.medYield.toFixed(2)}x` }));

  lazyChart('chart-4', () => bubbleOption(points, {
    xFmt: (v) => `$${(v / 1e6).toFixed(0)}M`, yFmt: (v) => `$${(v / 1e6).toFixed(0)}M`,
    xLabel: 'Avg budget', yLabel: 'Avg revenue',
  }), groupByType === 'genre' ? (chart) => addPosterToppers(chart, points.map((p) => ({ label: p.label, x: p.x, y: p.y })), { offsetY: 14 }) : undefined);
}

// ---- Leaderboard / table (shared computation) ----
function computeDataSection(rows) {
  const breakdown = document.querySelector('select[data-role="breakdown"][data-chart="1"]').value;
  const measure = document.querySelector('select[data-role="measure"][data-chart="1"]').value;
  const keyFn = breakdownKeyFns(new Set(TOP_LANGUAGES))[breakdown];
  const groups = groupBy(rows, keyFn);
  const entries = [...groups.entries()].map(([label, g]) => ({
    label, n: g.length,
    avgRating: mean(g.filter((r) => r.vote_average > 0).map((r) => r.vote_average)),
    totalRevenue: sum(g.filter((r) => r.revenue > 0).map((r) => r.revenue)),
    medYield: (() => { const fin = g.filter((r) => r.has_financials); return fin.length ? median(fin.map((r) => r.yield)) : null; })(),
    value: computeMeasure(g, measure),
  }));
  return { breakdown, measure, rows: sortEntries(breakdown, entries) };
}

function renderTable(data) {
  const tbody = document.querySelector('#data-table tbody');
  tbody.innerHTML = data.rows.map((row) => `
    <tr>
      <td>${row.label}</td>
      <td>${row.n.toLocaleString()}</td>
      <td>${row.avgRating ? row.avgRating.toFixed(2) : '—'}</td>
      <td>${fmtNumber(row.totalRevenue, 'total_revenue')}</td>
      <td>${row.medYield !== null ? row.medYield.toFixed(2) + 'x' : 'n/a'}</td>
    </tr>
  `).join('');
}

function renderLeaderboard(data) {
  const el = document.getElementById('leaderboard-view');
  const maxVal = Math.max(...data.rows.map((r) => Math.abs(r.value)), 1);
  el.innerHTML = data.rows.map((row, i) => {
    const info = data.breakdown === 'genre' ? GENRE_POSTERS[row.label] : null;
    const media = info
      ? `<img class="lb-poster" src="${posterUrl(info.poster_path)}" alt="">`
      : `<div class="lb-avatar">${row.label.charAt(0)}</div>`;
    const pct = Math.max(4, (Math.abs(row.value) / maxVal) * 100);
    return `
      <div class="lb-row">
        <div class="lb-rank">${i + 1}</div>
        ${media}
        <div class="lb-info">
          <div class="lb-name">${row.label}</div>
          <div class="lb-bar-track"><div class="lb-bar-fill" style="width:${pct}%"></div></div>
          <div class="lb-sub">Count ${row.n.toLocaleString()} · Rating ${row.avgRating ? row.avgRating.toFixed(2) : '—'} · Revenue ${fmtNumber(row.totalRevenue, 'total_revenue')} · Yield ${row.medYield !== null ? row.medYield.toFixed(2) + 'x' : 'n/a'}</div>
        </div>
        <div class="lb-value">${fmtNumber(row.value, data.measure)}</div>
      </div>`;
  }).join('');
}

function renderAll() {
  const rows = applyFilters();
  renderStats(rows);
  renderBarChart(1, rows);
  renderBarChart(2, rows);
  renderBarChart(3, rows);
  renderBubbleChart(rows);
  const data = computeDataSection(rows);
  renderTable(data);
  renderLeaderboard(data);
}

function setGenreFilter(genre) {
  playClick();
  state.filters.genre = genre;
  document.getElementById('filter-genre').value = genre;
  document.querySelectorAll('.gcard').forEach((c) => c.classList.toggle('active', c.dataset.genre === genre && genre !== ''));
  setAmbientAccent(genre);
  renderAll();
}

function setupPillGroup(containerId, filterKey) {
  const container = document.getElementById(containerId);
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    playTick();
    container.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    state.filters[filterKey] = btn.dataset.value;
    renderAll();
  });
}

function setupSegmented(id, onChange) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg');
    if (!btn) return;
    el.querySelectorAll('.seg').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    el.dataset.value = btn.dataset.value;
    onChange(btn.dataset.value);
  });
}

function populateFilters(rows) {
  const genres = [...new Set(rows.map((r) => r.primary_genre))].sort();
  const genreSel = document.getElementById('filter-genre');
  for (const g of genres) genreSel.add(new Option(g, g));

  const decades = [...new Set(rows.map((r) => r.decade))].sort((a, b) => a - b);
  const decadeGroup = document.getElementById('filter-decade');
  for (const d of decades) {
    const btn = document.createElement('button');
    btn.className = 'pill';
    btn.dataset.value = `${d}s`;
    btn.textContent = `${d}s`;
    decadeGroup.appendChild(btn);
  }

  const langCounts = [...groupBy(rows, (r) => r.original_language).entries()]
    .map(([lang, g]) => [lang, g.length]).sort((a, b) => b[1] - a[1]);
  TOP_LANGUAGES = langCounts.slice(0, 12).map(([lang]) => lang);
  const langSel = document.getElementById('filter-language');
  for (const [lang, count] of langCounts.slice(0, 20)) {
    langSel.add(new Option(`${lang} — ${count.toLocaleString()} titles`, lang));
  }

  return genres;
}

// ---- Genre picker (flip cards, doubles as a genre filter) ----
function renderGenrePicker(genres) {
  const el = document.getElementById('genre-picker');
  if (!el) return;
  const genreCounts = {};
  for (const [g, list] of groupBy(ALL_ROWS, (r) => r.primary_genre)) genreCounts[g] = list.length;

  const allCard = `
    <div class="gcard active" data-genre="">
      <div class="gcard-inner">
        <div class="gcard-front all-genres">🎬</div>
        <div class="gcard-back"><div class="g-name">All</div><div class="g-stat">${ALL_ROWS.length.toLocaleString()}</div></div>
      </div>
      <div class="gcard-label">All genres</div>
    </div>`;
  const cards = genres.map((g) => {
    const info = GENRE_POSTERS[g];
    const front = info ? `<img src="${posterUrl(info.poster_path)}" alt="${g}">` : '';
    return `
      <div class="gcard" data-genre="${g}">
        <div class="gcard-inner">
          <div class="gcard-front">${front}</div>
          <div class="gcard-back">
            <div class="g-name">${g}</div>
            <div class="g-stat">${(genreCounts[g] || 0).toLocaleString()} films</div>
          </div>
        </div>
        <div class="gcard-label">${g}</div>
      </div>`;
  }).join('');
  el.innerHTML = allCard + cards;

  el.addEventListener('click', (e) => {
    const card = e.target.closest('.gcard');
    if (!card) return;
    setGenreFilter(card.dataset.genre);
  });
}

// ---- Movie search ("find yourself in the data") ----
function genreMedianYield(genre) {
  const fin = ALL_ROWS.filter((r) => r.primary_genre === genre && r.has_financials);
  return fin.length >= 5 ? median(fin.map((r) => r.yield)) : null;
}

function showSearchCallout(movie) {
  let el = document.getElementById('search-callout');
  if (!el) {
    el = document.createElement('div');
    el.id = 'search-callout';
    el.className = 'search-callout';
    document.querySelector('.search-spotlight').appendChild(el);
  }
  const gYield = genreMedianYield(movie.primary_genre);
  el.innerHTML = `<strong>${movie.title}</strong> (${movie.release_year}) — a ${movie.primary_genre} film rated ${movie.vote_average.toFixed(1)}/10, popularity ${movie.popularity.toFixed(1)}.
    ${gYield !== null ? `${movie.primary_genre} overall has a median yield of ${gYield.toFixed(2)}x.` : ''} Dashboard filtered to ${movie.primary_genre}.`;
}

function setupMovieSearch() {
  const input = document.getElementById('movie-search');
  const results = document.getElementById('search-results');
  if (!input || !results) return;

  const closeResults = () => { results.hidden = true; results.innerHTML = ''; };

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { closeResults(); return; }
    const matches = ALL_ROWS.filter((r) => r.title && r.title.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) {
      results.innerHTML = `<div class="search-result-item"><span class="sr-title">No titles match "${input.value}"</span></div>`;
      results.hidden = false;
      return;
    }
    results.innerHTML = matches.map((m) => {
      const info = GENRE_POSTERS[m.primary_genre];
      const img = info
        ? `<img src="${posterUrl(info.poster_path)}" alt="">`
        : '<div style="width:30px;height:44px;flex:none;background:var(--surface-1);border-radius:3px;"></div>';
      const safeTitle = m.title.replace(/"/g, '&quot;');
      return `<div class="search-result-item" data-title="${safeTitle}">
        ${img}
        <div>
          <div class="sr-title">${m.title}</div>
          <div class="sr-meta">${m.release_year} · ${m.primary_genre}</div>
        </div>
      </div>`;
    }).join('');
    results.hidden = false;
  });

  results.addEventListener('click', (e) => {
    const item = e.target.closest('.search-result-item');
    if (!item || !item.dataset.title) return;
    const movie = ALL_ROWS.find((r) => r.title === item.dataset.title);
    if (!movie) return;
    input.value = movie.title;
    closeResults();
    setGenreFilter(movie.primary_genre);
    showSearchCallout(movie);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-spotlight')) closeResults();
  });
}

// ---- Genre face-off ----
function genreFullStats(genre) {
  const rows = ALL_ROWS.filter((r) => r.primary_genre === genre);
  const fin = rows.filter((r) => r.has_financials);
  return {
    count: rows.length,
    avgRating: mean(rows.filter((r) => r.vote_average > 0).map((r) => r.vote_average)),
    totalRevenue: sum(rows.filter((r) => r.revenue > 0).map((r) => r.revenue)),
    medianYield: fin.length ? median(fin.map((r) => r.yield)) : null,
  };
}

function renderFaceoff() {
  const gA = document.getElementById('faceoff-a').value;
  const gB = document.getElementById('faceoff-b').value;
  const a = genreFullStats(gA);
  const b = genreFullStats(gB);

  const posterA = document.getElementById('faceoff-poster-a');
  const posterB = document.getElementById('faceoff-poster-b');
  const infoA = GENRE_POSTERS[gA];
  const infoB = GENRE_POSTERS[gB];
  posterA.src = infoA ? posterUrl(infoA.poster_path) : '';
  posterA.alt = gA;
  posterB.src = infoB ? posterUrl(infoB.poster_path) : '';
  posterB.alt = gB;

  const metrics = [
    { key: 'count', label: 'Movie count', fmt: (v) => v.toLocaleString() },
    { key: 'avgRating', label: 'Average rating', fmt: (v) => v.toFixed(2) },
    { key: 'totalRevenue', label: 'Total revenue', fmt: (v) => fmtNumber(v, 'total_revenue') },
    { key: 'medianYield', label: 'Median yield', fmt: (v) => (v !== null && v !== undefined ? v.toFixed(2) + 'x' : 'n/a') },
  ];
  document.getElementById('faceoff-rows').innerHTML = metrics.map((m) => {
    const rawA = a[m.key];
    const rawB = b[m.key];
    const va = rawA ?? 0;
    const vb = rawB ?? 0;
    const maxAbs = Math.max(Math.abs(va), Math.abs(vb), 1);
    const pctA = Math.max(4, (Math.abs(va) / maxAbs) * 100);
    const pctB = Math.max(4, (Math.abs(vb) / maxAbs) * 100);
    return `
      <div class="faceoff-row">
        <div class="fo-label">${m.label}</div>
        <div class="faceoff-bars">
          <div class="faceoff-track left"><div class="faceoff-fill a" style="width:${pctA}%"></div></div>
          <div class="faceoff-value">${m.fmt(rawA)} <span style="color:var(--text-muted);">vs</span> ${m.fmt(rawB)}</div>
          <div class="faceoff-track"><div class="faceoff-fill b" style="width:${pctB}%"></div></div>
        </div>
      </div>`;
  }).join('');
}

function populateFaceoff(genres) {
  const selA = document.getElementById('faceoff-a');
  const selB = document.getElementById('faceoff-b');
  if (!selA || !selB) return;
  for (const g of genres) { selA.add(new Option(g, g)); selB.add(new Option(g, g)); }
  selA.value = genres.includes('Horror') ? 'Horror' : genres[0];
  selB.value = genres.includes('Drama') ? 'Drama' : genres[1];
  selA.addEventListener('change', renderFaceoff);
  selB.addEventListener('change', renderFaceoff);
  renderFaceoff();
}

Promise.all([
  loadMovies(),
  fetch('data/hero_posters.json').then((r) => r.json()).catch(() => []),
  fetch('data/genre_posters.json').then((r) => r.json()).catch(() => ({})),
]).then(([rows, posters, genrePosters]) => {
  ALL_ROWS = rows;
  setGenrePosters(genrePosters);
  if (posters.length) {
    renderHeroBackdrop(posters);
    renderMiniMarquee(posters);
  }
  const genres = populateFilters(rows);
  renderGenrePicker(genres);
  populateFaceoff(genres);
  setupMovieSearch();
  renderAll();

  document.getElementById('filter-genre').addEventListener('change', (e) => setGenreFilter(e.target.value));
  document.getElementById('filter-language').addEventListener('change', (e) => {
    state.filters.language = e.target.value;
    renderAll();
  });
  setupPillGroup('filter-decade', 'decade');
  setupPillGroup('filter-financial', 'financial');

  document.querySelectorAll('.chart-controls select').forEach((sel) => {
    sel.addEventListener('change', renderAll);
  });

  setupSegmented('chart1-viewtype', (val) => {
    playWhoosh();
    chart1ViewType = val;
    disposeChart('chart-1');
    renderBarChart(1, applyFilters());
  });
  setupSegmented('view-toggle', (val) => {
    playTick();
    document.getElementById('leaderboard-view').hidden = val === 'table';
    document.getElementById('table-section').hidden = val !== 'table';
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    playClick();
    document.getElementById('filter-language').value = '';
    document.querySelectorAll('#filter-decade .pill').forEach((p, i) => p.classList.toggle('active', i === 0));
    document.querySelectorAll('#filter-financial .pill').forEach((p, i) => p.classList.toggle('active', i === 0));
    state.filters = { genre: '', decade: '', language: '', financial: '' };
    document.getElementById('filter-genre').value = '';
    document.querySelectorAll('.gcard').forEach((c) => c.classList.toggle('active', c.dataset.genre === ''));
    setAmbientAccent('');
    document.getElementById('movie-search').value = '';
    const callout = document.getElementById('search-callout');
    if (callout) callout.remove();
    renderAll();
  });

  initTilt('.stat-tile, .chart-card, .faceoff-card, .leaderboard-card');
  initReveals();
  animateHeroLines('.hero h1');
  initSoundToggle();
}).catch((err) => {
  console.error('Failed to load dataset', err);
});
