#!/usr/bin/env python3
"""
Vectorizes the historical flood return-probability rasters in
downloads/flood-return-probability/ into one GeoJSON polygon file per
return period: data/flood_10yr.geojson, flood_25yr.geojson, etc.

Source rasters store continuous flood depth (float32, not a 0/1 mask) -
vectorizing by exact pixel value would fragment into thousands of
same-depth slivers per file (tested: ~3,000 distinct depth values in the
10-year raster alone). Instead, each raster is binarized to
"flooded" (value > 0 and not nodata) vs "not flooded" before vectorizing,
so contiguous flooded pixels merge into one polygon regardless of their
exact depth. This still produces a fair number of small polygons - the
flood extent itself is geometrically scattered (isolated low-lying
cells), not just fragmented by value - the printed summary reports exact
counts so that's visible rather than hidden.

Source CRS is already EPSG:4326, but the reprojection step runs
unconditionally/explicitly anyway, in case a future source raster isn't.

Requires: geopandas, rasterio, shapely (all already used elsewhere in
this repo's scripts)

Usage:
    python scripts/process_floods.py
"""

import glob
import os
import time

import geopandas as gpd
import numpy as np
import rasterio
import rasterio.features
from shapely.geometry import shape

RETURN_PERIODS = [10, 25, 50, 100, 200]
RASTER_GLOB = "downloads/flood-return-probability/*/*/Kerala_Flood_{year}_yr_Historical.tif"
OUTPUT_DIR = "data"


def find_raster(year):
    matches = sorted(glob.glob(RASTER_GLOB.format(year=year)))
    if not matches:
        raise SystemExit(
            f"No raster found for the {year}-year return period "
            f"(looked for {RASTER_GLOB.format(year=year)})"
        )
    return matches[0]


def vectorize(raster_path, year):
    with rasterio.open(raster_path) as src:
        band = src.read(1)
        nodata = src.nodata
        flooded = (band > 0) & (band != nodata) & ~np.isnan(band)

        records = []
        for geom, _ in rasterio.features.shapes(
            flooded.astype(np.uint8), mask=flooded, transform=src.transform
        ):
            records.append({"geometry": shape(geom), "return_period_years": year})

        gdf = gpd.GeoDataFrame(records, crs=src.crs)
    return gdf


def count_vertices(gdf):
    total = 0
    for geom in gdf.geometry:
        parts = [geom] if geom.geom_type == "Polygon" else list(geom.geoms)
        for part in parts:
            total += len(part.exterior.coords)
            for interior in part.interiors:
                total += len(interior.coords)
    return total


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print(f"{'Year':>6} {'Polygons':>10} {'Vertices':>10} {'Size (KB)':>11} {'Time (s)':>9}  File")
    print("-" * 80)

    for year in RETURN_PERIODS:
        t0 = time.time()
        raster_path = find_raster(year)

        gdf = vectorize(raster_path, year)
        gdf = gdf.to_crs(4326)

        out_path = os.path.join(OUTPUT_DIR, f"flood_{year}yr.geojson")
        gdf.to_file(out_path, driver="GeoJSON")

        size_kb = os.path.getsize(out_path) / 1024
        vertices = count_vertices(gdf)
        elapsed = time.time() - t0

        print(
            f"{year:>6} {len(gdf):>10} {vertices:>10} {size_kb:>11.1f} {elapsed:>9.1f}  {out_path}"
        )


if __name__ == "__main__":
    main()
