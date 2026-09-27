// Computes every headline number, finding number, and chart on the report
// page directly from data/movies_clean.csv — nothing here is hardcoded.
// Charts use ECharts (js/charts.js); reveals/count-ups use js/motion.js.

const POSTER_BASE = 'https://image.tmdb.org/t/p/w342';

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function renderPosterMarquee(posters) {
  const rowTop = document.getElementById('marquee-row-1');
  const rowBottom = document.getElementById('marquee-row-2');
  if (!rowTop || !rowBottom) return;
  const half = Math.ceil(posters.length / 2);
  const build = (list) => list.concat(list).map((p) => `
    <div class="poster-card" title="${p.title}">
      <img src="${POSTER_BASE}${p.poster_path}" alt="${p.title} poster" loading="lazy">
    </div>
  `).join('');
  rowTop.innerHTML = build(posters.slice(0, half));
  rowBottom.innerHTML = build(posters.slice(half));
}

function renderHeroBackdrop(posters) {
  const el = document.getElementById('hero-backdrop');
  if (!el) return;
  const pick = posters.slice(0, 16);
  el.innerHTML = pick.map((p) => `<img src="${POSTER_BASE}${p.poster_path}" alt="" loading="lazy">`).join('');
}

Promise.all([
  loadMovies(),
  fetch('data/hero_posters.json').then((r) => r.json()).catch(() => []),
  fetch('data/genre_posters.json').then((r) => r.json()).catch(() => ({})),
]).then(([rows, posters, genrePosters]) => {
  setGenrePosters(genrePosters);
  if (posters.length) {
    renderHeroBackdrop(posters);
    renderPosterMarquee(posters);
  }

  const genres = [...new Set(rows.map((r) => r.primary_genre))];
  const finRows = rows.filter((r) => r.has_financials);
  const byGenre = groupBy(rows, (r) => r.primary_genre);
  const finByGenre = groupBy(finRows, (r) => r.primary_genre);

  const reliableFinGenres = [...finByGenre.entries()]
    .filter(([, g]) => g.length >= 30)
    .map(([genre, g]) => ({
      genre, n: g.length,
      medianYield: median(g.map((r) => r.yield)),
      avgBudget: mean(g.map((r) => r.budget)),
      avgRevenue: mean(g.map((r) => r.revenue)),
    }))
    .sort((a, b) => b.medianYield - a.medianYield);

  const top = reliableFinGenres[0];
  const bottom = reliableFinGenres[reliableFinGenres.length - 1];

  // ---- Hero + headline numbers (animated count-up) ----
  const heroStat = document.getElementById('hero-stat-value');
  if (heroStat) countUp(heroStat, top.medianYield, { decimals: 2, suffix: 'x' });
  setText('hero-stat-genre', top.genre);

  const statMovies = document.getElementById('stat-movies');
  if (statMovies) countUp(statMovies, rows.length, { decimals: 0 });
  const statGenres = document.getElementById('stat-genres');
  if (statGenres) countUp(statGenres, genres.length, { decimals: 0 });
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
  lazyChart('chart-1', () => barOption(
    reliableFinGenres.map((g) => g.genre), reliableFinGenres.map((g) => g.medianYield),
    { color: cssVar('--gold'), valueFormatter: (v) => `${v.toFixed(2)}x`, genreAware: true },
  ), (chart) => addPosterToppers(chart, reliableFinGenres.map((g, i) => ({ label: g.genre, x: i, y: g.medianYield }))));

  // ---- Finding 2: budget size vs. yield (genre bubbles) ----
  const adv = reliableFinGenres.find((g) => g.genre === 'Adventure');
  const anim = reliableFinGenres.find((g) => g.genre === 'Animation');
  setText('f2-adv-budget', `$${(adv.avgBudget / 1e6).toFixed(0)}M`);
  setText('f2-anim-budget', `$${(anim.avgBudget / 1e6).toFixed(0)}M`);
  setText('f2-adv-yield', adv.medianYield.toFixed(2));
  setText('f2-anim-yield', anim.medianYield.toFixed(2));
  setText('f2-top-yield', top.medianYield.toFixed(2));
  lazyChart('chart-2', () => bubbleOption(
    reliableFinGenres.map((g) => ({
      label: g.genre, x: g.avgBudget, y: g.avgRevenue, r: Math.sqrt(g.n),
      tooltipExtra: `median yield ${g.medianYield.toFixed(2)}x · n=${g.n}`,
    })),
    { xFmt: (v) => `$${(v / 1e6).toFixed(0)}M`, yFmt: (v) => `$${(v / 1e6).toFixed(0)}M`, xLabel: 'Avg budget', yLabel: 'Avg revenue' },
  ), (chart) => addPosterToppers(chart, reliableFinGenres.map((g) => ({ label: g.genre, x: g.avgBudget, y: g.avgRevenue })), { offsetY: 14 }));

  // ---- Finding 3: rating and yield point in different directions ----
  const avgRatingByGenre = genres.map((g) => ({ genre: g, rating: mean(byGenre.get(g).map((r) => r.vote_average)) }))
    .sort((a, b) => b.rating - a.rating);
  const horrorRating = avgRatingByGenre.find((g) => g.genre === 'Horror');
  const topRated = avgRatingByGenre[0];
  setText('f3-horror-rating', horrorRating.rating.toFixed(2));
  setText('f3-top-rated-genre', topRated.genre);
  setText('f3-top-rated-value', topRated.rating.toFixed(2));
  setText('f3-horror-yield', top.medianYield.toFixed(2));
  lazyChart('chart-3', () => barOption(
    avgRatingByGenre.map((g) => g.genre), avgRatingByGenre.map((g) => g.rating),
    { color: cssVar('--series-3'), valueFormatter: (v) => v.toFixed(1), genreAware: true },
  ), (chart) => addPosterToppers(chart, avgRatingByGenre.map((g, i) => ({ label: g.genre, x: i, y: g.rating }))));

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
  lazyChart('chart-4', () => barOption(decades.map((d) => `${d}s`), decadeCounts, { color: cssVar('--series-2') }));

  // ---- Finding 5: Drama & Comedy dominate volume, not yield ----
  const countByGenre = genres.map((g) => ({ genre: g, count: byGenre.get(g).length })).sort((a, b) => b.count - a.count);
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
  lazyChart('chart-5', () => barOption(countByGenre.map((g) => g.genre), countByGenre.map((g) => g.count), { color: cssVar('--series-1'), genreAware: true }),
    (chart) => addPosterToppers(chart, countByGenre.map((g, i) => ({ label: g.genre, x: i, y: g.count }))));

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
  lazyChart('chart-6', () => barOption(
    topLangs.map(([code]) => code), topLangs.map(([, g]) => mean(g.map((r) => r.vote_average))),
    { color: cssVar('--series-5'), valueFormatter: (v) => v.toFixed(1) },
  ));

  // ---- Finding 7: genre budgets vary by an order of magnitude ----
  const byBudget = [...reliableFinGenres].sort((a, b) => b.avgBudget - a.avgBudget);
  const highB = byBudget[0];
  const lowB = byBudget[byBudget.length - 1];
  setText('f7-high-genre', highB.genre);
  setText('f7-high-budget', `$${(highB.avgBudget / 1e6).toFixed(1)}M`);
  setText('f7-low-genre', lowB.genre);
  setText('f7-low-budget', `$${(lowB.avgBudget / 1e6).toFixed(1)}M`);
  setText('f7-ratio', (highB.avgBudget / lowB.avgBudget).toFixed(1));
  lazyChart('chart-7', () => barOption(
    byBudget.map((g) => g.genre), byBudget.map((g) => g.avgBudget),
    { color: cssVar('--series-7'), valueFormatter: (v) => `$${(v / 1e6).toFixed(0)}M`, genreAware: true },
  ), (chart) => addPosterToppers(chart, byBudget.map((g, i) => ({ label: g.genre, x: i, y: g.avgBudget }))));

  // ---- Finding 8: runtime varies systematically by genre ----
  const runtimeByGenre = genres.map((g) => ({ genre: g, runtime: mean(byGenre.get(g).filter((r) => r.runtime > 0).map((r) => r.runtime)) }))
    .sort((a, b) => b.runtime - a.runtime);
  const longest = runtimeByGenre[0];
  const shortest = runtimeByGenre[runtimeByGenre.length - 1];
  setText('f8-longest-genre', longest.genre);
  setText('f8-longest-runtime', longest.runtime.toFixed(0));
  setText('f8-shortest-genre', shortest.genre);
  setText('f8-shortest-runtime', shortest.runtime.toFixed(0));
  setText('f8-spread', (longest.runtime - shortest.runtime).toFixed(0));
  lazyChart('chart-8', () => barOption(
    runtimeByGenre.map((g) => g.genre), runtimeByGenre.map((g) => g.runtime),
    { color: cssVar('--series-8'), valueFormatter: (v) => `${v.toFixed(0)} min`, genreAware: true },
  ), (chart) => addPosterToppers(chart, runtimeByGenre.map((g, i) => ({ label: g.genre, x: i, y: g.runtime }))));

  initReveals();
  initTilt('.stat-tile, .chart-card');
  animateHeroLines('.hero h1');
}).catch((err) => {
  console.error('Failed to load dataset', err);
});
