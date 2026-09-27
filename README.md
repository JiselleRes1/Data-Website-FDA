# Data Website FDA

A two-page data website: a scrollable report of findings and an interactive dashboard, built for a course project. Published with GitHub Pages.

**Dataset: not yet chosen.** This repo currently holds the site foundation (navigation, styling, page structure, chart/filter scaffolding). The dataset, findings, and dashboard logic will be filled in once a dataset is selected.

## Live site

TBD — will be `https://jiselleres1.github.io/Data-Website-FDA/` once GitHub Pages is enabled.

## Files

| File | What it does |
|---|---|
| `index.html` | The report page. Title, summary, headline numbers, 8+ findings sections (each with a chart), and a closing methodology section. |
| `dashboard.html` | The interactive dashboard. Filters, summary numbers, switchable charts, and a data table, all driven by data loaded in the browser. |
| `css/styles.css` | Shared styling for both pages: navigation bar, typography, color tokens (light/dark), layout. |
| `js/report.js` | Renders the charts on the report page from the dataset. |
| `js/dashboard.js` | Loads the dataset, wires up filters/switches, and renders the dashboard charts, summary numbers, and table. |
| `data/` | The dataset file(s) used by the site, plus any notes on where the data came from. |
| `scripts/` | Any data-prep scripts used to clean or reshape the raw data before it's used by the site. |

## Data source

TBD — to be filled in once a dataset is chosen. This section will describe where the data came from, what one row represents, which rows (if any) were dropped and why, and how every rate/ratio/average reported on the site is computed.

## Status

- [x] Repository created, public, structured
- [x] Shared layout, nav, and styling in place
- [ ] Dataset selected
- [ ] Report findings and charts (8+ sections)
- [ ] Dashboard filters, switches, charts, table
- [ ] GitHub Pages live and verified
