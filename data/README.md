# data/

All the data that powers the map.

- **[boundaries/](boundaries/README.md)** — the state/district/taluk/panchayat
  boundary shapes the sidebar lets you switch between. This is populated
  and sourced from official/open datasets — see that README for exactly
  where each file came from and its license. Also holds `places.json`,
  the small search index the landing page's "Check my area" box uses,
  generated from those boundary files.
- **[hazards/](hazards/README.md)** — vulnerable-schools overlay, toggled
  from its sidebar checkbox. Currently an empty placeholder; real data
  hasn't been sourced yet.
- **[facilities/](facilities/README.md)** — school and hospital point
  markers. Currently empty placeholders; real data is expected from the
  project owner at a later point.
- **landslide.pmtiles** — landslide susceptibility zones (GSI, 2022),
  toggled by the "Landslide Zones" checkbox. Lives here directly instead
  of in a subfolder because it isn't GeoJSON like everything else — it's
  a PMTiles vector-tile archive, generated from
  `downloads/landslide-shapefiles/` by `scripts/process_landslides.py`
  because the source data is too large/fragmented (100+ MB) to ship as one
  plain GeoJSON file. Rendered in `js/landslide-tiles.js` — a GPU
  (WebGL/MapLibre) renderer exists but is currently disabled due to an
  unresolved rendering bug, so it's actually rendered via the Canvas
  (protomaps-leaflet) path right now; see `js/README.md` for the full
  story. To regenerate it (e.g. after re-downloading fresher source
  shapefiles), run: `python scripts/process_landslides.py`
  (needs `geopandas`, `shapely`, `rtree`, `mercantile`,
  `mapbox-vector-tile`, and `pmtiles` — see that script's docstring).
- **flood_10yr.geojson, flood_25yr.geojson, flood_50yr.geojson,
  flood_100yr.geojson, flood_200yr.geojson** *(gitignored, not in the
  repo)* — flooded-area polygons for each historical flood return period,
  vectorized from GeoTIFF depth rasters by `scripts/process_floods.py`.
  These are intermediate/source files (~17-19 MB each, ~90 MB total) —
  the live site only fetches the smaller `pmtiles/` versions below, so
  these aren't committed, the same way `downloads/` isn't. Regenerate
  locally with `python scripts/process_floods.py` if you need them (needs
  the source rasters in `downloads/flood-return-probability/` — see
  `datasummary.md`).
- **pmtiles/flood_10yr.pmtiles, flood_25yr.pmtiles, flood_50yr.pmtiles,
  flood_100yr.pmtiles, flood_200yr.pmtiles** — the same flood data as
  above, tiled down to ~2.5 MB each by
  `scripts/convert_floods_to_pmtiles.py` (zoom 8-13, same approach as
  `landslide.pmtiles`), so a visitor only fetches the handful of tiles
  for their current view. Rendered by `js/flood-tiles.js` via the "Flood
  Risk" checkbox and return-period slider in the sidebar. See
  `scripts/README.md` for both scripts that produce these files.

## Notes for contributors

Don't add data files directly in this top-level folder unless, like
`landslide.pmtiles`, they genuinely don't fit any subfolder's format.
Otherwise put new data in the right subfolder above (or propose a new
one, with its own README, if none of these fit) and document it there.
