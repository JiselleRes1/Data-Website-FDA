# Genre Yield

A two-page data website analyzing which movie genres deliver the best return on their production budget. Built for a course project; published with GitHub Pages. Cinema-themed design: dark theater palette, real TMDB poster art, and film-motif interaction throughout.

## Live site

https://jiselleres1.github.io/Data-Website-FDA/

## Files

| File | What it does |
|---|---|
| `index.html` | The report page. Title, byline, summary, 4 headline numbers, 8 findings (each a two-column heading/explanation + chart computed live from the data), a mid-page "Intermission" break, and a closing methodology section. |
| `dashboard.html` | The interactive dashboard. A genre picker, a movie search, 4 filters (genre, decade, language, financial-data reported), 4 live summary numbers, 4 switchable charts (3 bar/radial + 1 bubble) with measure and breakdown switches, a Genre Face-Off comparison, a leaderboard/table view of the numbers behind the current view, and a reset-filters button. |
| `css/styles.css` | Shared design system for both pages: navigation bar, typography, the validated dark color palette, and every component's layout. |
| `js/data.js` | Loads `data/movies_clean.csv` (via PapaParse) and shared aggregation helpers (group-by, mean/median/sum, measure computation) used by both pages. |
| `js/charts.js` | Shared ECharts styling/helpers: bar, radial ("genre wheel"), and bubble chart builders, the genre-aware poster tooltips and poster-medallion chart decorations, and the lazy scroll-triggered chart loader. |
| `js/motion.js` | Shared motion layer: Lenis smooth scroll, GSAP ScrollTrigger reveal-on-scroll, animated count-up numbers, and card tilt. |
| `js/report.js` | Computes every headline number, finding number, and chart on the report page directly from the loaded dataset. |
| `js/dashboard.js` | Wires up the dashboard's filters, genre picker, search, chart switches, and face-off, and renders the charts, summary numbers, and table/leaderboard. |
| `data/README.md` | Where the raw data came from, the exact cleaning steps, and what each data file is. |
| `data/movies_clean.csv` | The cleaned dataset the site loads (72,775 rows, 12 columns). |
| `data/genre_posters.json`, `data/hero_posters.json` | Decorative poster art references (title + TMDB poster path) used for chart medallions/tooltips and the poster marquee. Not used in any analysis. |
| `scripts/README.md` | What each script below does. |
| `scripts/clean_data.py` | Reproduces `movies_clean.csv` from the raw Kaggle download. |
| `scripts/extract_genre_posters.py`, `scripts/extract_hero_posters.py` | Reproduce the two decorative poster JSON files above. |

## Data source

[Full TMDB Movies Dataset](https://www.kaggle.com/datasets/asaniczka/tmdb-movies-dataset-2023-930k-movies) (asaniczka, Kaggle) — see `data/README.md` for the full cleaning writeup: what one row is, which rows were dropped and why, and how every rate/average (especially "yield" = revenue ÷ budget) is computed.

## Meeting the project's data requirements

- **Panel data**: one row is one movie-release event, with a release year (time) and a primary genre (group) — genres recur across every year in the dataset, satisfying the "one row is one event" alternative.
- **Time column**: `release_year`, 75 distinct years (1950–2025).
- **Group column**: `primary_genre`, 19 distinct values.
- **Size**: 72,775 rows, 12 columns.
- **Categorical columns to filter on**: `primary_genre`, `original_language`, `adult` (3+).
- **Numeric columns to total/average/rank**: `budget`, `revenue`, `runtime`, `popularity`, `vote_average`, `vote_count` (6).

## Status

- [x] Repository created, public, structured, outside the course folder
- [x] Shared layout, nav, fonts, and colors across both pages
- [x] Dataset selected, cleaned, and documented (meets all four data requirements)
- [x] Report: title/byline/summary, 4 headline numbers, 8 findings with charts, closing methodology section
- [x] Dashboard: 4+ filters (including time and group), 4 live summary numbers, 4 switchable charts, a table, a reset button
- [x] GitHub Pages live and verified end-to-end
