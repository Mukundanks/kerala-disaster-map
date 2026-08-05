#!/usr/bin/env python3
"""
Converts the 5 flood-extent GeoJSON files produced by
scripts/process_floods.py (data/flood_10yr.geojson ... flood_200yr.geojson)
into individual PMTiles vector-tile archives in data/pmtiles/, one per
return period (e.g. data/pmtiles/flood_10yr.pmtiles).

Same reasoning as scripts/process_landslides.py, and reuses that script's
tiling approach directly: each flood file is ~17-19MB / ~32,000 polygons
as plain GeoJSON - loadable in one shot, but tiling means the browser
only ever fetches the handful of tiles actually on screen. Zoom range
(8-13) matches process_landslides.py for the same reason: below zoom 8 a
tile still covers a huge share of the state (slow to generate, and the
polygons would be sub-pixel at that scale anyway), and this dataset's
source rasters don't have meaningful detail past zoom 13.

Requires: geopandas, shapely, rtree, mercantile, mapbox-vector-tile, pmtiles
    pip install geopandas shapely rtree mercantile mapbox-vector-tile pmtiles

Usage:
    python scripts/convert_floods_to_pmtiles.py
"""

import gzip
import json
import os
import sqlite3
import tempfile
import time

import geopandas as gpd
import mapbox_vector_tile
import mercantile
from pmtiles.convert import mbtiles_to_pmtiles
from shapely.geometry import box

RETURN_PERIODS = [10, 25, 50, 100, 200]
INPUT_TEMPLATE = "data/flood_{year}yr.geojson"
OUTPUT_DIR = "data/pmtiles"
OUTPUT_TEMPLATE = os.path.join(OUTPUT_DIR, "flood_{year}yr.pmtiles")
LAYER_NAME = "flood"
EXTENT = 4096
MIN_ZOOM = 8
MAX_ZOOM = 13


def build_mbtiles(gdf, mbtiles_path, year):
    # One row per individual polygon so the spatial index can narrow
    # candidates down to what's actually near a given tile - see
    # process_landslides.py for why this matters (without it, a tile
    # touching a feature's bounding box pulls in the whole feature).
    exploded = gdf.explode(index_parts=False).reset_index(drop=True)
    sindex = exploded.sindex
    minx, miny, maxx, maxy = exploded.total_bounds

    conn = sqlite3.connect(mbtiles_path)
    conn.execute(
        "CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, "
        "tile_row INTEGER, tile_data BLOB)"
    )
    conn.execute("CREATE TABLE metadata (name TEXT, value TEXT)")
    conn.execute("CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row)")

    vector_layers = [{
        "id": LAYER_NAME,
        "fields": {"return_period_years": "Number"},
        "minzoom": MIN_ZOOM,
        "maxzoom": MAX_ZOOM,
    }]
    metadata = {
        "name": f"Kerala Flood Extent - {year}-year return period",
        "format": "pbf",
        "minzoom": str(MIN_ZOOM),
        "maxzoom": str(MAX_ZOOM),
        "bounds": f"{minx},{miny},{maxx},{maxy}",
        "center": f"{(minx + maxx) / 2},{(miny + maxy) / 2},{MIN_ZOOM}",
        "type": "overlay",
        "json": json.dumps({"vector_layers": vector_layers}),
    }
    conn.executemany("INSERT INTO metadata (name, value) VALUES (?, ?)", list(metadata.items()))

    tile_count = 0
    for z in range(MIN_ZOOM, MAX_ZOOM + 1):
        zt0 = time.time()
        z_tiles = 0
        for tile in mercantile.tiles(minx, miny, maxx, maxy, [z]):
            tb = mercantile.bounds(tile)
            candidate_idx = list(sindex.intersection((tb.west, tb.south, tb.east, tb.north)))
            if not candidate_idx:
                continue

            clipped = gpd.clip(exploded.iloc[candidate_idx], box(tb.west, tb.south, tb.east, tb.north))
            clipped = clipped[~clipped.geometry.is_empty & clipped.geometry.notna()]
            if clipped.empty:
                continue

            features = []
            for _, row in clipped.iterrows():
                parts = [row.geometry] if row.geometry.geom_type == "Polygon" else list(row.geometry.geoms)
                for part in parts:
                    features.append({
                        "geometry": part.__geo_interface__,
                        "properties": {"return_period_years": int(row["return_period_years"])},
                    })

            tile_bytes = mapbox_vector_tile.encode(
                [{"name": LAYER_NAME, "features": features}],
                default_options={
                    "quantize_bounds": (tb.west, tb.south, tb.east, tb.north),
                    "extents": EXTENT,
                },
            )
            tms_row = (2 ** z - 1) - tile.y
            conn.execute(
                "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
                (z, tile.x, tms_row, gzip.compress(tile_bytes)),
            )
            tile_count += 1
            z_tiles += 1
        print(f"    zoom {z}: {z_tiles} tiles ({time.time() - zt0:.1f}s)", flush=True)

    conn.commit()
    conn.close()
    return tile_count


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    for year in RETURN_PERIODS:
        t0 = time.time()
        input_path = INPUT_TEMPLATE.format(year=year)
        output_path = OUTPUT_TEMPLATE.format(year=year)

        if not os.path.exists(input_path):
            print(f"[{year}yr] SKIPPED - {input_path} not found (run scripts/process_floods.py first)", flush=True)
            continue

        print(f"[{year}yr] Loading {input_path}...", flush=True)
        gdf = gpd.read_file(input_path)
        print(f"[{year}yr]   {len(gdf)} features", flush=True)

        with tempfile.TemporaryDirectory() as tmp:
            mbtiles_path = os.path.join(tmp, f"flood_{year}yr.mbtiles")
            print(f"[{year}yr] Building vector tiles (zoom {MIN_ZOOM}-{MAX_ZOOM})...", flush=True)
            tile_count = build_mbtiles(gdf, mbtiles_path, year)
            mbtiles_to_pmtiles(mbtiles_path, output_path, MAX_ZOOM)

        size_mb = os.path.getsize(output_path) / 1024 / 1024
        print(
            f"[{year}yr] Done: {output_path} ({size_mb:.1f} MB, {tile_count} tiles) "
            f"in {time.time() - t0:.1f}s\n",
            flush=True,
        )


if __name__ == "__main__":
    main()
