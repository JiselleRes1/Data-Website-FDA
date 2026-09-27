// Dashboard: loads data/movies_clean.csv, wires up filters/switches, and
// renders summary numbers, four ECharts charts, and a table — all
// recomputed from the currently-filtered rows on every change.

let ALL_ROWS = [];
let TOP_LANGUAGES = [];

const state = { filters: { genre: '', decade: '', language: '', financial: '' } };

const RATING_TIER_ORDER = ['<5', '5-6', '6-7', '7-8', '8+'];

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

function renderBarChart(chartNum, rows) {
  const measure = document.querySelector(`select[data-role="measure"][data-chart="${chartNum}"]`).value;
  const breakdown = document.querySelector(`select[data-role="breakdown"][data-chart="${chartNum}"]`).value;
  const entries = aggregateBreakdown(rows, breakdown, measure);
  const colorVar = ['--series-1', '--series-3', '--series-5'][chartNum - 1] || '--gold';
  lazyChart(`chart-${chartNum}`, () => barOption(
    entries.map((e) => e.label), entries.map((e) => e.value),
    { color: cssVar(colorVar), valueFormatter: (v) => fmtNumber(v, measure) },
  ));
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
  }));
}

function renderTable(rows) {
  const breakdown = document.querySelector('select[data-role="breakdown"][data-chart="1"]').value;
  const keyFn = breakdownKeyFns(new Set(TOP_LANGUAGES))[breakdown];
  const groups = groupBy(rows, keyFn);
  const tableRows = sortEntries(breakdown, [...groups.entries()].map(([label, g]) => ({
    label, n: g.length,
    avgRating: mean(g.filter((r) => r.vote_average > 0).map((r) => r.vote_average)),
    totalRevenue: sum(g.filter((r) => r.revenue > 0).map((r) => r.revenue)),
    medYield: (() => { const fin = g.filter((r) => r.has_financials); return fin.length ? median(fin.map((r) => r.yield)) : null; })(),
    value: g.length,
  })));

  const tbody = document.querySelector('#data-table tbody');
  tbody.innerHTML = tableRows.map((row) => `
    <tr>
      <td>${row.label}</td>
      <td>${row.n.toLocaleString()}</td>
      <td>${row.avgRating ? row.avgRating.toFixed(2) : '—'}</td>
      <td>${fmtNumber(row.totalRevenue, 'total_revenue')}</td>
      <td>${row.medYield !== null ? row.medYield.toFixed(2) + 'x' : 'n/a'}</td>
    </tr>
  `).join('');
}

function renderAll() {
  const rows = applyFilters();
  renderStats(rows);
  renderBarChart(1, rows);
  renderBarChart(2, rows);
  renderBarChart(3, rows);
  renderBubbleChart(rows);
  renderTable(rows);
}

function setupPillGroup(containerId, filterKey) {
  const container = document.getElementById(containerId);
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.pill');
    if (!btn) return;
    container.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    state.filters[filterKey] = btn.dataset.value;
    renderAll();
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
}

loadMovies().then((rows) => {
  ALL_ROWS = rows;
  populateFilters(rows);
  renderAll();

  document.getElementById('filter-genre').addEventListener('change', (e) => {
    state.filters.genre = e.target.value;
    renderAll();
  });
  document.getElementById('filter-language').addEventListener('change', (e) => {
    state.filters.language = e.target.value;
    renderAll();
  });
  setupPillGroup('filter-decade', 'decade');
  setupPillGroup('filter-financial', 'financial');

  document.querySelectorAll('.chart-controls select').forEach((sel) => {
    sel.addEventListener('change', renderAll);
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    document.getElementById('filter-genre').value = '';
    document.getElementById('filter-language').value = '';
    document.querySelectorAll('#filter-decade .pill').forEach((p, i) => p.classList.toggle('active', i === 0));
    document.querySelectorAll('#filter-financial .pill').forEach((p, i) => p.classList.toggle('active', i === 0));
    state.filters = { genre: '', decade: '', language: '', financial: '' };
    renderAll();
  });

  initTilt('.stat-tile, .chart-card');
}).catch((err) => {
  console.error('Failed to load dataset', err);
});
