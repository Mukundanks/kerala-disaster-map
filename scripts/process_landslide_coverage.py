#!/usr/bin/env python3
"""
Works out where GSI's landslide-susceptibility mapping does and doesn't
reach, from the same district shapefiles as process_landslides.py
(downloads/landslide-shapefiles/), and writes two files:

  data/hazards/landslide-coverage.json
      For every state/district/taluk/local-body feature in
      data/boundaries/*.geojson (in file order), the percentage of its area
      that GSI mapped, and how much of it is High / Moderate / Low.
      Shown in the map page's place card (js/place-panel.js).

  data/hazards/landslide-unassessed.geojson
      Polygons covering every part of Kerala that GSI's dataset leaves
      blank - shown hatched as "Not assessed" while the landslide layer is
      on (js/landslide-tiles.js).

Why this matters: GSI's file only contains High/Moderate/Low zones. Places
it never mapped are simply absent, so on a map they look exactly like
"no risk". Some of those gaps cover hill country (e.g. Moothedam and most
of Edakkara in Malappuram, cut out along straight lines that follow the
1:50,000 topographic sheet grid), so the map needs to say "not assessed"
rather than leave them blank. Coastal plains, which GSI doesn't map at
all, show up as not assessed too, which is accurate but expected.

How: both the GSI polygons and the boundaries are rasterized onto the same
50 m grid (UTM zone 43N), which makes per-area percentages a simple count
of cells and is far faster than intersecting ~295,000 fragmented polygons
as vectors. 50 m is finer than the source data's own speckle, so the
percentages are accurate to well under a percent for anything bigger than
a few km2. Small specks (under ~0.1 km2) are cleaned out of the
not-assessed mask, so slivers between GSI's polygons don't show as gaps.

Requires: geopandas, rasterio, shapely, numpy (all already used by the
other processing scripts).

Usage:
    python scripts/process_landslide_coverage.py
"""

import glob
import json
import os

import geopandas as gpd
import numpy as np
import rasterio.features
from rasterio.transform import from_origin

SHAPEFILE_GLOB = "downloads/landslide-shapefiles/*/*/*_GSI_LS.shp"
BOUNDARIES = {
    "state": "data/boundaries/state.geojson",
    "district": "data/boundaries/district.geojson",
    "taluk": "data/boundaries/taluk.geojson",
    "panchayat": "data/boundaries/panchayat.geojson",
}
COVERAGE_OUT = "data/hazards/landslide-coverage.json"
UNASSESSED_OUT = "data/hazards/landslide-unassessed.geojson"

CRS = 32643          # UTM zone 43N, metres
CELL = 50            # grid cell size, metres
SIEVE_CELLS = 40     # specks smaller than this (40 cells = 0.1 km2) are cleaned out
SIMPLIFY_M = 40      # smooths the raster staircase on the output polygons

# Class codes on the grid. 0 = not mapped.
CLASSES = {"Low": 1, "Moderate": 2, "High": 3}


def load_gsi():
    paths = sorted(glob.glob(SHAPEFILE_GLOB))
    if not paths:
        raise SystemExit(f"No shapefiles found matching {SHAPEFILE_GLOB}")
    frames = [gpd.read_file(p).to_crs(CRS) for p in paths]
    print(f"Loaded {len(paths)} district shapefiles")
    return frames


def build_grid(state):
    minx, miny, maxx, maxy = state.total_bounds
    minx, miny, maxx, maxy = minx - 1000, miny - 1000, maxx + 1000, maxy + 1000
    width = int(np.ceil((maxx - minx) / CELL))
    height = int(np.ceil((maxy - miny) / CELL))
    return from_origin(minx, maxy, CELL, CELL), (height, width)


def rasterize_classes(frames, transform, shape):
    shapes = []
    # Low first and High last, so if any polygons ever overlap, the higher
    # class wins.
    for name, code in sorted(CLASSES.items(), key=lambda kv: kv[1]):
        for gdf in frames:
            for geom in gdf.loc[gdf["Susceptibi"] == name, "geometry"]:
                if geom is not None and not geom.is_empty:
                    shapes.append((geom, code))
    return rasterio.features.rasterize(shapes, out_shape=shape, transform=transform, fill=0, dtype="uint8")


def coverage_for_level(gdf, classes, transform, shape):
    # Feature i is burned in as id i + 1, so 0 means "outside every feature".
    ids = rasterio.features.rasterize(
        ((geom, i + 1) for i, geom in enumerate(gdf.geometry) if geom is not None and not geom.is_empty),
        out_shape=shape, transform=transform, fill=0, dtype="int32",
    )
    counts = np.bincount(ids.ravel().astype(np.int64) * 4 + classes.ravel(), minlength=(len(gdf) + 1) * 4)
    counts = counts.reshape(len(gdf) + 1, 4)[1:]  # drop the "outside" row

    rows = []
    for low_none, low, moderate, high in ((c[0], c[1], c[2], c[3]) for c in counts):
        total = low_none + low + moderate + high
        if total == 0:
            rows.append(None)  # no geometry, or too small to cover a cell
            continue
        pct = lambda n: round(100 * n / total, 1)
        # [mapped, high, moderate, low] - all as % of the feature's area
        rows.append([pct(low + moderate + high), pct(high), pct(moderate), pct(low)])
    return rows


def unassessed_polygons(state, classes, transform, shape):
    inside = rasterio.features.rasterize(
        ((geom, 1) for geom in state.geometry), out_shape=shape, transform=transform, fill=0, dtype="uint8"
    )
    gap = ((inside == 1) & (classes == 0)).astype("uint8")
    gap = rasterio.features.sieve(gap, size=SIEVE_CELLS, connectivity=8)
    gap = gap * inside  # sieving can fill specks with 1 outside the state too

    polygons = [
        {"type": "Feature", "properties": {}, "geometry": geom}
        for geom, value in rasterio.features.shapes(gap, mask=gap == 1, transform=transform, connectivity=8)
        if value == 1
    ]
    gdf = gpd.GeoDataFrame.from_features(polygons, crs=CRS)
    gdf["geometry"] = gdf.geometry.simplify(SIMPLIFY_M, preserve_topology=True)
    gdf = gdf[~gdf.geometry.is_empty]
    return gdf.dissolve().to_crs(4326)


def round_coords(value, places=5):
    if isinstance(value, float):
        return round(value, places)
    if isinstance(value, list):
        return [round_coords(v, places) for v in value]
    return value


def main():
    boundaries = {level: gpd.read_file(path).to_crs(CRS) for level, path in BOUNDARIES.items()}
    transform, shape = build_grid(boundaries["state"])
    print(f"Grid: {shape[1]} x {shape[0]} cells of {CELL} m")

    classes = rasterize_classes(load_gsi(), transform, shape)

    coverage = {"cell_m": CELL, "fields": ["mapped", "high", "moderate", "low"]}
    for level, gdf in boundaries.items():
        coverage[level] = coverage_for_level(gdf, classes, transform, shape)
        print(f"{level}: {len(gdf)} features")
    with open(COVERAGE_OUT, "w", encoding="utf-8") as f:
        json.dump(coverage, f, separators=(",", ":"))
    print(f"Wrote {COVERAGE_OUT} ({os.path.getsize(COVERAGE_OUT) / 1024:.0f} KB)")

    gaps = unassessed_polygons(boundaries["state"], classes, transform, shape)
    collection = json.loads(gaps.to_json())
    for feature in collection["features"]:
        feature["properties"] = {}
        feature["geometry"]["coordinates"] = round_coords(feature["geometry"]["coordinates"])
    with open(UNASSESSED_OUT, "w", encoding="utf-8") as f:
        json.dump(collection, f, separators=(",", ":"))
    print(f"Wrote {UNASSESSED_OUT} ({os.path.getsize(UNASSESSED_OUT) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
