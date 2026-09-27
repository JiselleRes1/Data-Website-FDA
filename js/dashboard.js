// Dashboard: loads data/movies_clean.csv, wires up filters/switches, and
// renders summary numbers, four charts, and a table — all recomputed from
// the currently-filtered rows on every change.

let ALL_ROWS = [];
let TOP_LANGUAGES = [];
let charts = {};

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
  if (breakdownType === 'decade') {
    return entries.sort((a, b) => parseInt(a.label) - parseInt(b.label));
  }
  if (breakdownType === 'rating_tier') {
    return entries.sort((a, b) => RATING_TIER_ORDER.indexOf(a.label) - RATING_TIER_ORDER.indexOf(b.label));
  }
  if (breakdownType === 'language') {
    return entries.sort((a, b) => (a.label === 'Other' ? 1 : b.label === 'Other' ? -1 : b.n - a.n));
  }
  return entries.sort((a, b) => b.value - a.value);
}

function aggregateBreakdown(rows, breakdownType, measure) {
  const keyFn = breakdownKeyFns(new Set(TOP_LANGUAGES))[breakdownType];
  const groups = groupBy(rows, keyFn);
  const entries = [...groups.entries()].map(([label, g]) => ({
    label, n: g.length, value: computeMeasure(g, measure),
  }));
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

function seriesColor(n) {
  return getComputedStyle(document.body).getPropertyValue(`--series-${((n - 1) % 8) + 1}`).trim();
}

function renderStats(rows) {
  document.getElementById('stat-count').textContent = rows.length.toLocaleString();
  const rated = rows.filter((r) => r.vote_average > 0);
  document.getElementById('stat-rating').textContent = rated.length ? mean(rated.map((r) => r.vote_average)).toFixed(2) : '—';
  const popular = rows.filter((r) => r.popularity > 0);
  document.getElementById('stat-popularity').textContent = popular.length ? mean(popular.map((r) => r.popularity)).toFixed(1) : '—';
  const fin = rows.filter((r) => r.has_financials);
  document.getElementById('stat-yield').textContent = fin.length ? `${median(fin.map((r) => r.yield)).toFixed(2)}x` : 'n/a';
}

function renderBarChart(chartNum, rows) {
  const canvas = document.getElementById(`chart-${chartNum}`);
  if (!canvas) return;
  const measure = document.querySelector(`select[data-role="measure"][data-chart="${chartNum}"]`).value;
  const breakdown = document.querySelector(`select[data-role="breakdown"][data-chart="${chartNum}"]`).value;
  const entries = aggregateBreakdown(rows, breakdown, measure);

  if (charts[chartNum]) charts[chartNum].destroy();
  charts[chartNum] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: entries.map((e) => e.label),
      datasets: [{ data: entries.map((e) => e.value), backgroundColor: seriesColor(chartNum), borderRadius: 4, maxBarThickness: 36 }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => fmtNumber(ctx.parsed.y, measure) } },
      },
      scales: {
        y: { beginAtZero: true, ticks: { callback: (v) => fmtNumber(v, measure) } },
        x: { grid: { display: false } },
      },
    },
  });
}

function renderBubbleChart(rows) {
  const canvas = document.getElementById('chart-4');
  if (!canvas) return;
  const groupBy_ = document.getElementById('bubble-groupby').value;
  const sizeBy = document.getElementById('bubble-sizeby').value;
  const keyFn = breakdownKeyFns(new Set(TOP_LANGUAGES))[groupBy_];
  const groups = groupBy(rows.filter((r) => r.has_financials), keyFn);

  const points = [...groups.entries()]
    .filter(([, g]) => g.length >= 5)
    .map(([label, g]) => ({
      label,
      x: mean(g.map((r) => r.budget)),
      y: mean(g.map((r) => r.revenue)),
      n: g.length,
      medYield: median(g.map((r) => r.yield)),
    }))
    .map((p) => ({ ...p, size: sizeBy === 'count' ? p.n : p.medYield }));

  if (charts.bubble) charts.bubble.destroy();
  if (!points.length) return;
  const maxSize = Math.max(...points.map((p) => p.size));
  charts.bubble = new Chart(canvas, {
    type: 'bubble',
    data: {
      datasets: points.map((p, i) => ({
        label: p.label,
        data: [{ x: p.x, y: p.y, r: 6 + (p.size / maxSize) * 26 }],
        backgroundColor: seriesColor(i + 1) + 'cc',
        borderColor: seriesColor(i + 1),
        borderWidth: 1.5,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const p = points[ctx.datasetIndex];
              return `${p.label}: avg budget $${(p.x / 1e6).toFixed(1)}M, avg revenue $${(p.y / 1e6).toFixed(1)}M, n=${p.n}, median yield ${p.medYield.toFixed(2)}x`;
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: 'Average budget (USD)' }, ticks: { callback: (v) => `$${(v / 1e6).toFixed(0)}M` } },
        y: { title: { display: true, text: 'Average revenue (USD)' }, ticks: { callback: (v) => `$${(v / 1e6).toFixed(0)}M` } },
      },
    },
  });
}

function renderTable(rows) {
  const breakdown = document.querySelector('select[data-role="breakdown"][data-chart="1"]').value;
  const keyFn = breakdownKeyFns(new Set(TOP_LANGUAGES))[breakdown];
  const groups = groupBy(rows, keyFn);
  const tableRows = sortEntries(breakdown, [...groups.entries()].map(([label, g]) => ({
    label,
    n: g.length,
    avgRating: mean(g.filter((r) => r.vote_average > 0).map((r) => r.vote_average)),
    totalRevenue: sum(g.filter((r) => r.revenue > 0).map((r) => r.revenue)),
    medYield: (() => {
      const fin = g.filter((r) => r.has_financials);
      return fin.length ? median(fin.map((r) => r.yield)) : null;
    })(),
    value: g.length,
  })));

  const tbody = document.querySelector('#data-table tbody');
  tbody.innerHTML = '';
  for (const row of tableRows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${row.label}</td>
      <td>${row.n.toLocaleString()}</td>
      <td>${row.avgRating ? row.avgRating.toFixed(2) : '—'}</td>
      <td>${fmtNumber(row.totalRevenue, 'total_revenue')}</td>
      <td>${row.medYield !== null ? row.medYield.toFixed(2) + 'x' : 'n/a'}</td>
    `;
    tbody.appendChild(tr);
  }
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

function populateFilters(rows) {
  const genres = [...new Set(rows.map((r) => r.primary_genre))].sort();
  const genreSel = document.getElementById('filter-genre');
  for (const g of genres) genreSel.add(new Option(g, g));

  const decades = [...new Set(rows.map((r) => r.decade))].sort((a, b) => a - b);
  const decadeSel = document.getElementById('filter-decade');
  for (const d of decades) decadeSel.add(new Option(`${d}s`, `${d}s`));

  const langCounts = [...groupBy(rows, (r) => r.original_language).entries()]
    .map(([lang, g]) => [lang, g.length])
    .sort((a, b) => b[1] - a[1]);
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

  document.querySelectorAll('#filters select[data-filter]').forEach((sel) => {
    sel.addEventListener('change', () => {
      state.filters[sel.dataset.filter] = sel.value;
      renderAll();
    });
  });

  document.querySelectorAll('.chart-controls select').forEach((sel) => {
    sel.addEventListener('change', renderAll);
  });

  document.getElementById('reset-filters').addEventListener('click', () => {
    document.querySelectorAll('#filters select[data-filter]').forEach((sel) => { sel.value = ''; });
    state.filters = { genre: '', decade: '', language: '', financial: '' };
    renderAll();
  });
}).catch((err) => {
  console.error('Failed to load dataset', err);
});
