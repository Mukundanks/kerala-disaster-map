#!/usr/bin/env python3
"""
Turns the 13 district landslide-susceptibility shapefiles staged in
downloads/landslide-shapefiles/ into a single PMTiles vector-tile archive
at data/landslide.pmtiles.

Why tiles instead of one GeoJSON file: the source data is extremely
fragmented (raster-to-vector "speckle" - e.g. Idukki district alone has
32,000+ separate small polygons), so a merged, full-fidelity GeoJSON comes
out to 100+ MB. Tiling means the browser only ever downloads the handful
of tiles for whatever's currently on screen (tens of KB), instead of the
whole state at once, without dropping or simplifying away any polygons.

Requires: geopandas, shapely, rtree, mercantile, mapbox-vector-tile, pmtiles
    pip install geopandas shapely rtree mercantile mapbox-vector-tile pmtiles

Usage:
    python scripts/process_landslides.py
"""

import glob
import gzip
import json
import os
import sqlite3
import tempfile
import time

import geopandas as gpd
import mapbox_vector_tile
import mercantile
import pandas as pd
from pmtiles.convert import mbtiles_to_pmtiles
from shapely.geometry import box

SHAPEFILE_GLOB = "downloads/landslide-shapefiles/*/*/*_GSI_LS.shp"
OUTPUT_PMTILES = "data/landslide.pmtiles"
LAYER_NAME = "landslide"
EXTENT = 4096

# Below zoom 8, individual polygons would be sub-pixel on a whole-state
# view anyway - not visually meaningful, and generating those tiles is by
# far the most expensive part of the pipeline (a low-zoom tile still
# covers a huge share of the dataset). The layer simply doesn't render
# below this zoom; it appears once you've zoomed in enough for it to
# matter. See the "zoom range" discussion in the PR/commit this came from.
MIN_ZOOM = 8
MAX_ZOOM = 13


def load_merged_geodataframe():
    paths = sorted(glob.glob(SHAPEFILE_GLOB))
    if not paths:
        raise SystemExit(f"No shapefiles found matching {SHAPEFILE_GLOB}")

    frames = []
    for path in paths:
        district = os.path.basename(path).replace("_GSI_LS.shp", "")
        gdf = gpd.read_file(path)
        gdf["district"] = district
        gdf = gdf.rename(columns={"Susceptibi": "susceptibility"})
        frames.append(gdf[["susceptibility", "district", "geometry"]])

    merged = gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs=frames[0].crs)
    return merged.to_crs(4326)  # WGS84, for Leaflet


def build_mbtiles(gdf, mbtiles_path):
    # One row per individual polygon (not per MultiPolygon) so the spatial
    # index can actually narrow candidates down to what's near a given
    # tile - without this, every tile touching a district would pull in
    # that district's entire multipolygon (tens of thousands of parts).
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
        "fields": {"susceptibility": "String", "district": "String"},
        "minzoom": MIN_ZOOM,
        "maxzoom": MAX_ZOOM,
    }]
    metadata = {
        "name": "Kerala Landslide Susceptibility (GSI, 2022)",
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
                        "properties": {
                            "susceptibility": row["susceptibility"],
                            "district": row["district"],
                        },
                    })

            tile_bytes = mapbox_vector_tile.encode(
                [{"name": LAYER_NAME, "features": features}],
                default_options={
                    "quantize_bounds": (tb.west, tb.south, tb.east, tb.north),
                    "extents": EXTENT,
                },
            )
            # MBTiles stores rows TMS-style (flipped from the XYZ scheme
            # mercantile/Leaflet use), and the pmtiles converter expects
            # gzip-compressed MVT bytes.
            tms_row = (2 ** z - 1) - tile.y
            conn.execute(
                "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
                (z, tile.x, tms_row, gzip.compress(tile_bytes)),
            )
            tile_count += 1
            z_tiles += 1
        print(f"  zoom {z}: {z_tiles} tiles ({time.time() - zt0:.1f}s)", flush=True)

    conn.commit()
    conn.close()
    return tile_count


def main():
    t0 = time.time()
    print("Loading + merging + reprojecting shapefiles...", flush=True)
    gdf = load_merged_geodataframe()
    print(f"  {len(gdf)} features across {gdf['district'].nunique()} districts", flush=True)

    with tempfile.TemporaryDirectory() as tmp:
        mbtiles_path = os.path.join(tmp, "landslide.mbtiles")
        print(f"Building vector tiles (zoom {MIN_ZOOM}-{MAX_ZOOM})...", flush=True)
        tile_count = build_mbtiles(gdf, mbtiles_path)
        print(f"  wrote {tile_count} tiles", flush=True)

        os.makedirs(os.path.dirname(OUTPUT_PMTILES), exist_ok=True)
        mbtiles_to_pmtiles(mbtiles_path, OUTPUT_PMTILES, MAX_ZOOM)

    size_mb = os.path.getsize(OUTPUT_PMTILES) / 1024 / 1024
    print(f"Done: {OUTPUT_PMTILES} ({size_mb:.1f} MB) in {time.time() - t0:.1f}s", flush=True)


if __name__ == "__main__":
    main()
