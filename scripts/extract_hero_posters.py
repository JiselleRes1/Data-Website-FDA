"""
Pulls a small set of real poster images for the site's decorative "now
showing" marquee strip (report page) — purely visual, not used in any
analysis or chart. Poster art is served live from TMDB's public image CDN
(image.tmdb.org) using the poster_path from the raw dataset; we only store
the path and title, not the image itself.

Input:  data/TMDB_movie_dataset_v11.csv (raw download, not committed)
Output: data/hero_posters.json (committed — ~5KB of paths/titles)

Selection: the 48 most popular titles with at least 2,000 votes and a
poster on file, deduplicated by title.
"""

import json
import pandas as pd

RAW_PATH = "data/TMDB_movie_dataset_v11.csv"
OUT_PATH = "data/hero_posters.json"


def main():
    cols = ["id", "title", "popularity", "vote_count", "poster_path", "genres"]
    df = pd.read_csv(RAW_PATH, usecols=cols, low_memory=False)
    df = df[df.poster_path.notna() & (df.poster_path != "") & (df.vote_count >= 2000)]
    df["primary_genre"] = df.genres.str.split(",").str[0].str.strip()
    df = df.sort_values("popularity", ascending=False).drop_duplicates("title").head(48)

    out = df[["id", "title", "poster_path", "primary_genre"]].to_dict("records")
    with open(OUT_PATH, "w") as f:
        json.dump(out, f, indent=1)
    print(f"wrote {len(out)} posters to {OUT_PATH}")


if __name__ == "__main__":
    main()
