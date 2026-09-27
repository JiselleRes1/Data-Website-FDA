# Genre Yield

A two-page data website analyzing which movie genres deliver the best return on their production budget. Built for a course project; published with GitHub Pages.

## Live site

https://jiselleres1.github.io/Data-Website-FDA/

## Files

| File | What it does |
|---|---|
| `index.html` | The report page. Title, summary, 4 headline numbers, 8 findings (each with a chart computed live from the data), and a closing methodology section. |
| `dashboard.html` | The interactive dashboard. 4 filters, 4 live summary numbers, 4 switchable charts (bar x3 + a genre/language bubble chart), and a data table — all recomputed from the currently-filtered rows in the browser. |
| `css/styles.css` | Shared styling for both pages: navigation bar, typography, light/dark color tokens, layout. |
| `js/data.js` | Loads `data/movies_clean.csv` (via PapaParse) and shared aggregation helpers (group-by, mean/median/sum, measure computation) used by both pages. |
| `js/report.js` | Computes every headline number, finding number, and chart on the report page from the loaded dataset. |
| `js/dashboard.js` | Wires up the dashboard's filters and chart switches, and renders the charts, summary numbers, and table. |
| `data/README.md` | Where the raw data came from, and the exact cleaning steps used to produce `movies_clean.csv`. |
| `data/movies_clean.csv` | The cleaned dataset the site loads (72,775 rows). |
| `scripts/clean_data.py` | Reproduces `movies_clean.csv` from the raw Kaggle download. |

## Data source

[Full TMDB Movies Dataset](https://www.kaggle.com/datasets/asaniczka/tmdb-movies-dataset-2023-930k-movies) (asaniczka, Kaggle) — see `data/README.md` for the full cleaning writeup: what one row is, which rows were dropped and why, and how every rate/average (especially "yield" = revenue ÷ budget) is computed.

## Status

- [x] Repository created, public, structured
- [x] Shared layout, nav, and styling in place
- [x] Dataset selected, cleaned, and documented
- [x] Report findings and charts (8 sections)
- [x] Dashboard filters, switches, charts, table
- [ ] GitHub Pages live and verified end-to-end
