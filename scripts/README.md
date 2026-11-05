# scripts/

Developer tooling. Nothing here is loaded by the website itself — these
are one-off/maintenance scripts contributors run to keep the repo and its
data in good shape. Mostly Node.js, plus a few Python data-processing
scripts (see below) where that was the right tool for the job.

## What's here

- **check-readmes.js** — the script that enforces the "every folder's
  README.md must stay in sync" rule described in `CONTRIBUTING.md`. It
  looks at which files changed (either your staged changes, or the diff
  for a pull request) and fails if a folder's contents changed without its
  `README.md` also changing. This same script is run both by the GitHub
  Actions check (`.github/workflows/readme-check.yml`) and by the local
  pre-commit hook below, so the rule is enforced the same way everywhere.
- **install-git-hooks.js** — run this once after cloning
  (`node scripts/install-git-hooks.js`) to set up `check-readmes.js` as a
  local pre-commit hook. After that, `git commit` will stop you if you've
  changed a folder's files without updating its README.
- **round-geojson-precision.js** — rounds coordinates in a GeoJSON file to
  a fixed number of decimal places (default 6) and re-saves it without
  extra whitespace, to cut file size without visibly changing shapes.
  Used when vendoring boundary data into `data/boundaries/` — see that
  folder's README. Usage:
  `node scripts/round-geojson-precision.js <input.geojson> <output.geojson> [decimals]`

- **build-place-index.js** — builds `data/boundaries/places.json`, the
  name-only search index (every district, taluk, and local body, with
  Malayalam names where available) used by the landing page's "Check my
  area" search. Re-run it whenever a boundary file in `data/boundaries/`
  changes. Usage: `node scripts/build-place-index.js`

- **process_landslide_coverage.py** — from the same GSI shapefiles,
  works out where the landslide mapping does and doesn't reach. Writes
  `data/hazards/landslide-unassessed.geojson` (the hatched "Not assessed"
  areas, plus label positions on an 8 km grid inside them, coarser grid
  lines appearing at lower zooms) and `data/hazards/landslide-coverage.json` (% mapped and
  High/Moderate/Low for every state/district/taluk/local-body feature,
  shown in the map's place card). Everything is rasterized onto a shared
  50 m grid (UTM 43N) rather than intersected as vectors, which takes
  under a minute instead of hours on ~295,000 polygons. Spot checks
  against exact vector intersections agree to within ~2 percentage
  points. Requires `geopandas`, `rasterio`, `shapely`, `numpy`. Re-run it
  whenever the GSI shapefiles or `data/boundaries/` change.
  Usage: `python scripts/process_landslide_coverage.py`

- **process_landslides.py** — reads the 13 district landslide-susceptibility
  shapefiles in `downloads/landslide-shapefiles/`, merges and reprojects
  them, and packages them as a PMTiles vector-tile archive at
  `data/landslide.pmtiles`. Needed because that source data is extremely
  fragmented (one district alone has 30,000+ separate tiny polygons), so a
  plain merged GeoJSON comes out to 100+ MB — tiling means the browser
  only downloads the handful of tiles actually on screen. Full details,
  including why tile generation starts at zoom 8 rather than 0, are in the
  script's own docstring. Requires `geopandas`, `shapely`, `rtree`,
  `mercantile`, `mapbox-vector-tile`, and `pmtiles`
  (`pip install geopandas shapely rtree mercantile mapbox-vector-tile pmtiles`).
  Usage: `python scripts/process_landslides.py`

- **process_floods.py** — reads the historical flood return-probability
  rasters (10/25/50/100/200-year, GeoTIFF, continuous depth values) from
  `downloads/flood-return-probability/`, binarizes each to a
  flooded/not-flooded mask (vectorizing by exact depth value would
  fragment far worse — see the script's docstring), vectorizes to
  polygons, and writes one file per return period directly into `data/`:
  `flood_10yr.geojson` … `flood_200yr.geojson`. Prints a summary table
  (polygon count, vertex count, file size, time) per file when run.
  Requires `geopandas`, `rasterio`, `shapely`
  (`pip install geopandas rasterio shapely`).
  Usage: `python scripts/process_floods.py`

  These GeoJSON files are the intermediate/source form (~90 MB total) and
  are gitignored, same as `downloads/` — see `convert_floods_to_pmtiles.py`
  below for the versions actually meant to ship on the site.

- **convert_floods_to_pmtiles.py** — converts each of the 5 GeoJSON files
  `process_floods.py` produces into its own PMTiles vector-tile archive in
  `data/pmtiles/` (e.g. `data/pmtiles/flood_10yr.pmtiles`), reusing
  `process_landslides.py`'s tiling approach and the same zoom range
  (8-13). Shrinks each file from ~17-19 MB of plain GeoJSON down to
  ~2.5 MB of tiles — and a visitor only ever fetches the handful of tiles
  for their current view, not the whole archive. Requires `geopandas`,
  `shapely`, `rtree`, `mercantile`, `mapbox-vector-tile`, and `pmtiles`
  (same as `process_landslides.py`).
  Usage: `python scripts/convert_floods_to_pmtiles.py`

  These are the files `js/flood-tiles.js` actually renders (via the
  "Flood Risk" checkbox and return-period slider in the sidebar).

- **scrape_ksdma.py** — checks KSDMA's
  [hazard-maps page](https://sdma.kerala.gov.in/hazard-maps/) for what's
  on offer: every row of the page's table, every file it links to, and
  (with `--head`) each file's size, ETag and Last-Modified date. It never
  downloads the files themselves and never touches git. It tags the files
  our processing scripts use (the 13 GSI landslide zips and the 2
  historical flood-raster zips), and exits with code 2 if those aren't
  all there, which usually means KSDMA redesigned the page. Save a run
  with `--out` and compare the next one with `--compare` to see
  new, removed or replaced files (exit code 3 when something changed).
  Links to other sites, odd ports and redirects that leave
  `sdma.kerala.gov.in` are never followed. `--html saved.html` parses a
  saved copy with no network access, for testing. This is the first piece
  of the planned automated data-update pipeline; it's meant to run inside
  the isolated update VM, not on a personal machine. Requires `requests`
  and `beautifulsoup4`, pinned with hashes in `requirements-scrape.txt`:
  `pip install --require-hashes --no-deps -r scripts/requirements-scrape.txt`
  (into a venv outside the repo).
  Usage: `python scripts/scrape_ksdma.py --head --compare last.json --out last.json`

- **requirements-scrape.txt** — exact versions and SHA-256 hashes of
  `scrape_ksdma.py`'s dependencies, so `pip` refuses anything that
  doesn't match byte for byte. The hashes are for Python 3.14 on x86_64
  Linux (the update VM).

The Node scripts above have no dependencies (only Node's built-ins, so
nothing to `npm install`); the Python scripts need a `pip install`
first (see each one's entry above for exactly which packages).

## Notes for contributors

If you add a new script here, explain what it does and how it's meant to
be run, right here in this README.
