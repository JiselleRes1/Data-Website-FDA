# scripts/

| Script | What it does |
|---|---|
| `clean_data.py` | Turns the raw ~1.5M-row TMDB CSV into `data/movies_clean.csv` (72,775 rows) — the dataset the site's analysis, charts, and dashboard all run on. See `data/README.md` for the exact cleaning rules. |
| `extract_genre_posters.py` | Picks one representative poster per genre for the decorative poster medallions/tooltips on genre charts. Produces `data/genre_posters.json`. Decorative only, not used in any analysis. |
| `extract_hero_posters.py` | Picks the 48 most popular titles for the poster marquee/hero backdrop. Produces `data/hero_posters.json`. Decorative only, not used in any analysis. |

All three read the raw CSV at `data/TMDB_movie_dataset_v11.csv` (not committed — see `data/README.md` to re-download it) and are run from the repository root, e.g. `python3 scripts/clean_data.py`.
