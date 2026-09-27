"""
Cleans the raw TMDB movies CSV into the dataset the site actually loads.

Input:  data/TMDB_movie_dataset_v11.csv (raw download, not committed to git —
        see data/README.md for where to get it)
Output: data/movies_clean.csv (committed to git, loaded by report.js and dashboard.js)

Cleaning rules (see also the "About this data" section on index.html):
  1. Keep only status == "Released" — drops planned/rumored/in-production/canceled
     titles that have no real performance data.
  2. Parse release_date; drop rows where it doesn't parse, and keep only
     1950-2026 — earlier "release dates" in the raw file are data-entry noise
     (e.g. year 1800, year 2061).
  3. Keep only rows with a non-empty genres list, and take the first listed
     genre as each movie's primary_genre (TMDB lists multiple genres per movie;
     using the first keeps "one row = one group" simple for filtering).
  4. Keep only vote_count >= 10 — the raw file is dominated by obscure/unrated
     entries (zero engagement) that would otherwise swamp every genre-level
     average; this threshold keeps rows with at least some audience signal.

Result: ~72,800 rows, 75 distinct release years, 19 genres.
Financial fields (budget/revenue) are 0 for most rows (TMDB doesn't have that
data for most titles) — findings that use them filter to budget > 0 and
revenue > 0 explicitly, rather than dropping those rows from the whole dataset.
"""

import pandas as pd

RAW_PATH = "data/TMDB_movie_dataset_v11.csv"
OUT_PATH = "data/movies_clean.csv"

KEEP_COLUMNS = [
    "id", "title", "release_year", "primary_genre", "original_language",
    "adult", "runtime", "budget", "revenue", "popularity",
    "vote_average", "vote_count",
]


def main():
    cols = [
        "id", "title", "vote_average", "vote_count", "status", "release_date",
        "revenue", "runtime", "budget", "original_language", "popularity",
        "genres", "adult",
    ]
    df = pd.read_csv(RAW_PATH, usecols=cols, low_memory=False)

    df = df[df["status"] == "Released"].copy()

    df["release_date"] = pd.to_datetime(df["release_date"], errors="coerce")
    df = df.dropna(subset=["release_date"])
    df["release_year"] = df["release_date"].dt.year
    df = df[(df["release_year"] >= 1950) & (df["release_year"] <= 2026)]

    df = df[df["genres"].notna() & (df["genres"] != "")]
    df["primary_genre"] = df["genres"].str.split(",").str[0].str.strip()

    df = df[df["vote_count"] >= 10]

    df["release_year"] = df["release_year"].astype(int)

    out = df[KEEP_COLUMNS].sort_values(["release_year", "title"])
    out.to_csv(OUT_PATH, index=False)

    print(f"wrote {len(out):,} rows to {OUT_PATH}")
    print(f"years: {out['release_year'].min()}-{out['release_year'].max()} "
          f"({out['release_year'].nunique()} distinct)")
    print(f"genres: {out['primary_genre'].nunique()} distinct")
    print(f"rows with budget>0 and revenue>0: "
          f"{((out['budget'] > 0) & (out['revenue'] > 0)).sum():,}")


if __name__ == "__main__":
    main()
