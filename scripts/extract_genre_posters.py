"""
Picks one representative poster per genre (the most popular reasonably-voted
title in that genre) for the bar-chart "poster medallion" toppers and rich
tooltips. Decorative only — not used in any analysis.

Input:  data/TMDB_movie_dataset_v11.csv (raw download, not committed)
Output: data/genre_posters.json (committed — a small {genre: {...}} map)
"""

import json
import pandas as pd

RAW_PATH = "data/TMDB_movie_dataset_v11.csv"
OUT_PATH = "data/genre_posters.json"


def main():
    cols = ["title", "popularity", "vote_count", "poster_path", "genres"]
    df = pd.read_csv(RAW_PATH, usecols=cols, low_memory=False)
    df = df[df.poster_path.notna() & (df.poster_path != "") & (df.vote_count >= 500)]
    df["primary_genre"] = df.genres.str.split(",").str[0].str.strip()
    df = df.sort_values("popularity", ascending=False)

    best = df.drop_duplicates("primary_genre", keep="first")
    out = {
        row.primary_genre: {"title": row.title, "poster_path": row.poster_path}
        for row in best.itertuples()
    }
    with open(OUT_PATH, "w") as f:
        json.dump(out, f, indent=1)
    print(f"wrote {len(out)} genre posters to {OUT_PATH}")
    for genre, info in out.items():
        print(f"  {genre:18s} -> {info['title']}")


if __name__ == "__main__":
    main()
