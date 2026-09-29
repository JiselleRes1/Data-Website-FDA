// Shared data loading + aggregation for report.js and dashboard.js.
// Loads data/movies_clean.csv (see data/README.md for how it was produced)
// and exposes small aggregation helpers used by both pages.

const DATA_URL = 'data/movies_clean.csv';

function decadeOf(year) {
  return Math.floor(year / 10) * 10;
}

function ratingTierOf(rating) {
  if (rating >= 8) return '8+';
  if (rating >= 7) return '7-8';
  if (rating >= 6) return '6-7';
  if (rating >= 5) return '5-6';
  return '<5';
}

// Loads and type-casts the dataset. Returns a Promise<Array<row>>.
function loadMovies() {
  return new Promise((resolve, reject) => {
    Papa.parse(DATA_URL, {
      download: true,
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data.map((r) => ({
          id: r.id,
          title: String(r.title), // PapaParse's dynamicTyping turns numeric-looking
          // titles (e.g. "1917", "300") into JS numbers — force back to string.
          release_year: r.release_year,
          decade: decadeOf(r.release_year),
          primary_genre: r.primary_genre,
          original_language: r.original_language,
          adult: r.adult === true || r.adult === 'True',
          runtime: r.runtime,
          budget: r.budget,
          revenue: r.revenue,
          popularity: r.popularity,
          vote_average: r.vote_average,
          vote_count: r.vote_count,
          has_financials: r.budget > 0 && r.revenue > 0,
          yield: r.budget > 0 && r.revenue > 0 ? r.revenue / r.budget : null,
        }));
        rows.forEach((r) => { r.rating_tier = ratingTierOf(r.vote_average); });
        resolve(rows);
      },
      error: reject,
    });
  });
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(nums) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function sum(nums) {
  return nums.reduce((a, b) => a + b, 0);
}

// Groups rows by keyFn, returns Map<key, rows[]>.
function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

// Computes one of the dashboard's four measures over a set of rows.
//   count         -> number of rows
//   total_revenue -> sum of revenue (rows with revenue > 0)
//   avg_rating    -> mean of vote_average
//   median_yield  -> median of revenue/budget, rows with budget & revenue > 0
function computeMeasure(rows, measure) {
  switch (measure) {
    case 'count':
      return rows.length;
    case 'total_revenue':
      return sum(rows.filter((r) => r.revenue > 0).map((r) => r.revenue));
    case 'avg_rating':
      return mean(rows.filter((r) => r.vote_average > 0).map((r) => r.vote_average));
    case 'median_yield':
      return median(rows.filter((r) => r.has_financials).map((r) => r.yield));
    default:
      return 0;
  }
}

const MEASURE_LABELS = {
  count: 'Number of movies',
  total_revenue: 'Total revenue (USD)',
  avg_rating: 'Average rating (0-10)',
  median_yield: 'Median yield (revenue ÷ budget)',
};

// Turns an ISO 639-1 code (e.g. "ja", "ko", "pt") into a readable language
// name (e.g. "Japanese", "Korean", "Portuguese") using the browser's own
// language database, so it covers every code in the dataset without a
// hand-maintained list. Falls back to the raw code if the browser can't
// resolve it. "cn" is a TMDB-specific code for Cantonese (not standard
// ISO 639-1, which uses "zh" for Chinese) — handled as a special case.
const LANGUAGE_NAME_OVERRIDES = { cn: 'Cantonese' };
let _languageDisplay = null;
try { _languageDisplay = new Intl.DisplayNames(['en'], { type: 'language' }); } catch (e) { /* unsupported */ }

function languageName(code) {
  if (!code || code === 'Other') return code;
  if (LANGUAGE_NAME_OVERRIDES[code]) return LANGUAGE_NAME_OVERRIDES[code];
  if (!_languageDisplay) return code.toUpperCase();
  try {
    const name = _languageDisplay.of(code);
    return name && name.toLowerCase() !== code.toLowerCase() ? name : code.toUpperCase();
  } catch (e) {
    return code.toUpperCase();
  }
}

function fmtNumber(n, measure) {
  if (measure === 'total_revenue') {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    return `$${Math.round(n).toLocaleString()}`;
  }
  if (measure === 'median_yield') return `${n.toFixed(2)}x`;
  if (measure === 'avg_rating') return n.toFixed(2);
  return Math.round(n).toLocaleString();
}
