// Computes every headline number, finding number, and chart on the report
// page directly from data/movies_clean.csv — nothing here is hardcoded.

const GENRE_ORDER = [
  'Drama', 'Comedy', 'Action', 'Horror', 'Documentary', 'Animation',
  'Thriller', 'Crime', 'Romance', 'Adventure', 'Family', 'Science Fiction',
  'TV Movie', 'Music', 'Fantasy', 'Mystery', 'Western', 'War', 'History',
];

const seriesColor = (n) =>
  getComputedStyle(document.body).getPropertyValue(`--series-${((n - 1) % 8) + 1}`).trim();

Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", sans-serif';
Chart.defaults.color = getComputedStyle(document.body).getPropertyValue('--text-secondary').trim();

function barChart(canvasId, labels, values, { color = seriesColor(1), horizontal = false, yFmt = (v) => v } = {}) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: color, borderRadius: 4, maxBarThickness: 40 }],
    },
    options: {
      indexAxis: horizontal ? 'y' : 'x',
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => yFmt(ctx.parsed[horizontal ? 'x' : 'y']) } },
      },
      scales: {
        [horizontal ? 'x' : 'y']: {
          beginAtZero: true,
          ticks: { callback: (v) => yFmt(v) },
          grid: { color: getComputedStyle(document.body).getPropertyValue('--gridline') },
        },
        [horizontal ? 'y' : 'x']: { grid: { display: false } },
      },
    },
  });
}

function bubbleChart(canvasId, points) {
  const el = document.getElementById(canvasId);
  if (!el) return;
  new Chart(el, {
    type: 'bubble',
    data: {
      datasets: points.map((p, i) => ({
        label: p.label,
        data: [{ x: p.x, y: p.y, r: p.r }],
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
              return `${p.label}: avg budget $${(p.x / 1e6).toFixed(1)}M, avg revenue $${(p.y / 1e6).toFixed(1)}M, median yield ${p.yieldVal.toFixed(2)}x`;
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

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

loadMovies().then((rows) => {
  const genres = [...new Set(rows.map((r) => r.primary_genre))];
  const finRows = rows.filter((r) => r.has_financials);
  const byGenre = groupBy(rows, (r) => r.primary_genre);
  const finByGenre = groupBy(finRows, (r) => r.primary_genre);

  // Genres with enough financially-reported titles to trust a median (n >= 30).
  const reliableFinGenres = [...finByGenre.entries()]
    .filter(([, g]) => g.length >= 30)
    .map(([genre, g]) => ({
      genre,
      n: g.length,
      medianYield: median(g.map((r) => r.yield)),
      avgBudget: mean(g.map((r) => r.budget)),
      avgRevenue: mean(g.map((r) => r.revenue)),
    }))
    .sort((a, b) => b.medianYield - a.medianYield);

  const top = reliableFinGenres[0];
  const bottom = reliableFinGenres[reliableFinGenres.length - 1];

  // ---- Headline numbers ----
  setText('stat-movies', rows.length.toLocaleString());
  setText('stat-genres', genres.length.toString());
  const years = rows.map((r) => r.release_year);
  setText('stat-years', `${Math.min(...years)}–${Math.max(...years)}`);
  setText('stat-top-genre', `${top.genre} (${top.medianYield.toFixed(2)}x)`);

  // ---- Finding 1: Horror leads every genre on yield ----
  setText('f1-fin-count', finRows.length.toLocaleString());
  setText('f1-top-genre', top.genre);
  setText('f1-top-yield', top.medianYield.toFixed(2));
  setText('f1-top-budget', `$${(top.avgBudget / 1e6).toFixed(1)}M`);
  setText('f1-bottom-genre', bottom.genre);
  setText('f1-bottom-yield', bottom.medianYield.toFixed(2));
  barChart('chart-1', reliableFinGenres.map((g) => g.genre), reliableFinGenres.map((g) => g.medianYield), {
    color: seriesColor(1), yFmt: (v) => `${v.toFixed(1)}x`,
  });

  // ---- Finding 2: budget size vs. yield (genre bubbles) ----
  const adv = reliableFinGenres.find((g) => g.genre === 'Adventure');
  const anim = reliableFinGenres.find((g) => g.genre === 'Animation');
  setText('f2-adv-budget', `$${(adv.avgBudget / 1e6).toFixed(0)}M`);
  setText('f2-anim-budget', `$${(anim.avgBudget / 1e6).toFixed(0)}M`);
  setText('f2-adv-yield', adv.medianYield.toFixed(2));
  setText('f2-anim-yield', anim.medianYield.toFixed(2));
  setText('f2-top-yield', top.medianYield.toFixed(2));
  bubbleChart('chart-2', reliableFinGenres.map((g) => ({
    label: g.genre, x: g.avgBudget, y: g.avgRevenue, r: Math.max(6, Math.sqrt(g.n) * 1.4), yieldVal: g.medianYield,
  })));

  // ---- Finding 3: rating and yield point in different directions ----
  const avgRatingByGenre = genres.map((g) => ({
    genre: g, rating: mean(byGenre.get(g).map((r) => r.vote_average)),
  })).sort((a, b) => b.rating - a.rating);
  const horrorRating = avgRatingByGenre.find((g) => g.genre === 'Horror');
  const topRated = avgRatingByGenre[0];
  setText('f3-horror-rating', horrorRating.rating.toFixed(2));
  setText('f3-top-rated-genre', topRated.genre);
  setText('f3-top-rated-value', topRated.rating.toFixed(2));
  setText('f3-horror-yield', top.medianYield.toFixed(2));
  barChart('chart-3', avgRatingByGenre.map((g) => g.genre), avgRatingByGenre.map((g) => g.rating), {
    color: seriesColor(3), yFmt: (v) => v.toFixed(1),
  });

  // ---- Finding 4: output boomed, then pulled back ----
  const byDecade = groupBy(rows, (r) => r.decade);
  const decades = [...byDecade.keys()].sort((a, b) => a - b);
  const decadeCounts = decades.map((d) => byDecade.get(d).length);
  const c1950 = byDecade.get(1950)?.length ?? 0;
  const c2010 = byDecade.get(2010)?.length ?? 0;
  const c2020 = byDecade.get(2020)?.length ?? 0;
  setText('f4-1950', c1950.toLocaleString());
  setText('f4-2010', c2010.toLocaleString());
  setText('f4-multiplier', (c2010 / c1950).toFixed(1));
  setText('f4-2020', c2020.toLocaleString());
  barChart('chart-4', decades.map((d) => `${d}s`), decadeCounts, { color: seriesColor(4) });

  // ---- Finding 5: Drama & Comedy dominate volume, not yield ----
  const countByGenre = genres.map((g) => ({ genre: g, count: byGenre.get(g).length }))
    .sort((a, b) => b.count - a.count);
  const drama = countByGenre.find((g) => g.genre === 'Drama');
  const comedy = countByGenre.find((g) => g.genre === 'Comedy');
  const dramaYield = reliableFinGenres.find((g) => g.genre === 'Drama');
  const comedyYield = reliableFinGenres.find((g) => g.genre === 'Comedy');
  setText('f5-drama-count', drama.count.toLocaleString());
  setText('f5-drama-pct', ((drama.count / rows.length) * 100).toFixed(1));
  setText('f5-comedy-count', comedy.count.toLocaleString());
  setText('f5-comedy-pct', ((comedy.count / rows.length) * 100).toFixed(1));
  setText('f5-drama-yield', dramaYield.medianYield.toFixed(2));
  setText('f5-comedy-yield', comedyYield.medianYield.toFixed(2));
  barChart('chart-5', countByGenre.map((g) => g.genre), countByGenre.map((g) => g.count), { color: seriesColor(5) });

  // ---- Finding 6: foreign-language films rate higher, stay less visible ----
  const isEn = (r) => r.original_language === 'en';
  const enRows = rows.filter(isEn);
  const nonEnRows = rows.filter((r) => !isEn(r));
  setText('f6-en-rating', mean(enRows.map((r) => r.vote_average)).toFixed(2));
  setText('f6-nonen-rating', mean(nonEnRows.map((r) => r.vote_average)).toFixed(2));
  setText('f6-en-pop', mean(enRows.map((r) => r.popularity)).toFixed(1));
  setText('f6-nonen-pop', mean(nonEnRows.map((r) => r.popularity)).toFixed(1));
  setText('f6-en-pct', ((enRows.length / rows.length) * 100).toFixed(0));
  const byLang = groupBy(rows, (r) => r.original_language);
  const topLangs = [...byLang.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 10);
  barChart('chart-6', topLangs.map(([code]) => code), topLangs.map(([, g]) => mean(g.map((r) => r.vote_average))), {
    color: seriesColor(6), yFmt: (v) => v.toFixed(1),
  });

  // ---- Finding 7: genre budgets vary by an order of magnitude ----
  const byBudget = [...reliableFinGenres].sort((a, b) => b.avgBudget - a.avgBudget);
  const highB = byBudget[0];
  const lowB = byBudget[byBudget.length - 1];
  setText('f7-high-genre', highB.genre);
  setText('f7-high-budget', `$${(highB.avgBudget / 1e6).toFixed(1)}M`);
  setText('f7-low-genre', lowB.genre);
  setText('f7-low-budget', `$${(lowB.avgBudget / 1e6).toFixed(1)}M`);
  setText('f7-ratio', (highB.avgBudget / lowB.avgBudget).toFixed(1));
  barChart('chart-7', byBudget.map((g) => g.genre), byBudget.map((g) => g.avgBudget), {
    color: seriesColor(7), yFmt: (v) => `$${(v / 1e6).toFixed(0)}M`,
  });

  // ---- Finding 8: runtime varies systematically by genre ----
  const runtimeByGenre = genres.map((g) => ({
    genre: g, runtime: mean(byGenre.get(g).filter((r) => r.runtime > 0).map((r) => r.runtime)),
  })).sort((a, b) => b.runtime - a.runtime);
  const longest = runtimeByGenre[0];
  const shortest = runtimeByGenre[runtimeByGenre.length - 1];
  setText('f8-longest-genre', longest.genre);
  setText('f8-longest-runtime', longest.runtime.toFixed(0));
  setText('f8-shortest-genre', shortest.genre);
  setText('f8-shortest-runtime', shortest.runtime.toFixed(0));
  setText('f8-spread', (longest.runtime - shortest.runtime).toFixed(0));
  barChart('chart-8', runtimeByGenre.map((g) => g.genre), runtimeByGenre.map((g) => g.runtime), {
    color: seriesColor(8), yFmt: (v) => `${v.toFixed(0)} min`,
  });
}).catch((err) => {
  console.error('Failed to load dataset', err);
});
