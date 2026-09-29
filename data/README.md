# data/

## Source

**Full TMDB Movies Dataset** by asaniczka on Kaggle:
https://www.kaggle.com/datasets/asaniczka/tmdb-movies-dataset-2023-930k-movies

Scraped from The Movie Database (TMDB) API, ~1.5 million movie records, updated regularly. Downloaded 2026-09-27 as `TMDB_movie_dataset_v11.csv`.

## Files

| File | Tracked in git? | What it is |
|---|---|---|
| `TMDB_movie_dataset_v11.csv` | No (too large, ~660MB) | The raw download. Re-download from the Kaggle link above and place it here to reproduce the files below. |
| `movies_clean.csv` | Yes | The cleaned dataset the site loads for every chart, stat, and table. Produced by `scripts/clean_data.py`. |
| `genre_posters.json` | Yes | One representative poster (title + TMDB poster path) per genre, used purely as a decorative "poster medallion" on genre charts and in tooltips. Produced by `scripts/extract_genre_posters.py`. Not used in any analysis. |
| `hero_posters.json` | Yes | The 48 most popular titles with poster paths, used for the decorative poster marquee/backdrop on both pages. Produced by `scripts/extract_hero_posters.py`. Not used in any analysis. |

## What one row is

One row is one movie that was released in theaters/streaming (`status == "Released"`), with its release year, genre, and TMDB metrics.

## Cleaning steps (`scripts/clean_data.py`)

Starting from ~1.5M raw rows:
1. Keep only `status == "Released"` (drops planned/rumored/in-production/canceled titles).
2. Parse `release_date`; drop unparseable rows; keep only release years 1950–2026 (earlier "release dates" in the raw file, e.g. year 1800, are data-entry errors).
3. Keep only rows with a non-empty `genres` list. TMDB lists multiple genres per movie (e.g. "Action, Science Fiction, Adventure"); we take the **first listed genre** as `primary_genre` so each row belongs to exactly one group.
4. Keep only `vote_count >= 10` — the raw file is dominated by obscure, essentially-unrated entries that would otherwise swamp every genre-level average.

**Result: 72,775 rows, 75 distinct release years (1950–2025), 19 genres.**

## Financial fields (budget / revenue)

TMDB only has real budget/revenue figures for a minority of titles — most rows have `budget = 0` and/or `revenue = 0`, meaning "not reported," not "zero dollars." Only 8,645 of the 72,775 rows have both `budget > 0` and `revenue > 0`. Any finding involving cost, revenue, or yield (revenue ÷ budget) filters to that subset explicitly and says so; findings about ratings, popularity, or counts use the full 72,775-row dataset.

## How derived numbers are computed

- **Yield / ROI** = `revenue / budget`, computed only where `budget > 0` and `revenue > 0`.
- **Averages** (rating, popularity, runtime, etc.) are means over the filtered rows shown, unless labeled "median."
- Category columns available for filtering: `primary_genre` (19 values), `original_language`, `adult` (boolean), plus `release_year` as the time filter.
- Numeric columns available to total/average/rank: `budget`, `revenue`, `runtime`, `popularity`, `vote_average`, `vote_count`.
