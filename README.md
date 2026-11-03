# Kerala Disaster Map

**Live at: https://mukundanks.github.io/kerala-disaster-map/**

An interactive map of Kerala where you click a district or local body (a
panchayat, municipality, or corporation) and see its disaster management
details right there — instead of hunting through a separate page for each
one.

## Why this exists

Kerala State Disaster Management Authority (KSDMA) publishes disaster
management information per district and per local body, but it's spread
across many individual pages. That's fine if you already know exactly
what you're looking for, but hard for an ordinary person who just wants
to know "what's the situation/plan for my area?" This project puts all of
that behind a single map: click where you are, see what applies to you.

## Status

Early stage, but the core map works. What's live right now:

- A **landing page** (`index.html`) with a "Check my area" search over
  every district, taluk, and local body (English or Malayalam names), a
  clickable map of the 14 districts, a flood return-period slider demo
  showing real flood extent around Aluva alongside the odds of that flood
  in a given year and over 30 years, and cards for each data layer. All of
  it links into the map page (`map.html`) through URL parameters that open
  it already zoomed to a place and/or with layers switched on (see
  `js/deeplink.js`).

- The **map page** (`map.html`): a full-screen map with a side panel
  (a pull-up sheet on phones, which closes when you tap the map), in the same look as the landing page,
  including dark mode. In the panel:
  - **Boundaries** buttons to switch between **State**, **District**,
    **Taluk**, and **Local body** (panchayat/municipality/corporation)
    outlines. **Ward** is listed but disabled; see
    `data/boundaries/README.md` for why open ward data doesn't exist yet.
    Hovering a shape highlights it and shows its name. Clicking it opens
    a **place card** with its Malayalam name, type, district and block,
    plus "Zoom to" and "Copy link" buttons.
  - **Landslide zones** (GSI, 2022): susceptibility zones colored
    red/orange/yellow by risk level, with a legend and an opacity slider.
    They stream in as vector tiles (`data/landslide.pmtiles`), so the
    browser only downloads what's on screen instead of one huge file. They
    stay visible (reusing the deepest available tile) at zoom levels beyond
    the data's own resolution instead of disappearing. Currently rendered
    with a CPU (Canvas) renderer. A GPU (WebGL/MapLibre) renderer also
    exists in the code, for better performance on this dataset's ~295,000
    fragmented polygons, but is disabled pending a rendering bug. See
    `js/README.md` ("Why MapLibre for the landslide layer") for the full
    reasoning and debugging notes, and also `data/README.md` and
    `scripts/process_landslides.py`.
    GSI only mapped about half of Kerala. Areas it didn't map are greyed
    out, hatched, edged with a dashed line and labelled **"Not assessed"**
    instead of left blank, since blank would read as "no
    risk". Some gaps cover hills, e.g. Moothedam and Edakkara near Nilambur.
    The place card says how much of a place GSI mapped and how much is
    High/Moderate/Low. See `data/hazards/README.md` and
    `scripts/process_landslide_coverage.py`.
  - **Flood risk**: a return-period slider (10/25/50/100/200-year historical
    flood extent, one PMTiles archive per period,
    `data/pmtiles/flood_*yr.pmtiles`) with a play button that steps through
    the periods. It shows the odds of each scenario (in one year, and over
    30 years) and has an opacity slider. See `data/README.md` and
    `scripts/process_floods.py` / `scripts/convert_floods_to_pmtiles.py`.
  - A **Base map** choice: Muted (the default, toned down so hazard colours
    stand out), Standard OpenStreetMap, or Satellite.
- A **place search** in the map page's top bar (the same one as on the
  landing page), which switches to the right boundary level and selects the
  place.
- Map buttons for zoom, "show all of Kerala", and **Find My Location**.
  Find My Location drops a marker with an accuracy circle and selects the
  district/taluk/local body you're in.
- The landslide and flood tiles only exist from zoom 8, so if one is
  switched on while zoomed out further, a message offers to zoom in. A
  loading indicator shows while boundary files or hazard tiles download.
- The address bar always holds a link to the current view (level, selected
  place, layers, flood period, base map), so any view can be shared.
- A **Vulnerable Schools** toggle, and marker support for schools
  (green book icon) and hospitals (red cross icon) — wired up, but no
  real data behind them yet (see `data/hazards/README.md` and
  `data/facilities/README.md`).
- Actual KSDMA disaster-management content per district/local body hasn't
  been pulled in yet — right now clicking a shape only shows its name.

## How it's built

Plain HTML, CSS, and JavaScript — no framework, no build step. The map
itself is powered by [Leaflet](https://leafletjs.com/), an open-source
mapping library. Hosted on [GitHub Pages](https://mukundanks.github.io/kerala-disaster-map/),
since that's a natural fit for a static site with an open contribution
process — everything here is static files, including the vector tile
layers below, so no server-side component is needed. Pages is configured
to deploy straight from the `main` branch root (no build step there
either) — see the repo's Settings → Pages if that ever needs changing.

The one exception to "plain Leaflet" is the **Landslide Zones** layer,
which has two renderers built in, for the reasons explained in depth in
`js/README.md`: [MapLibre GL JS](https://maplibre.org/) (WebGL,
GPU-accelerated — the intended primary path, since that dataset is
~295,000 small fragmented polygons, too much for Leaflet's Canvas
renderer to redraw smoothly) and
[protomaps-leaflet](https://github.com/protomaps/protomaps-leaflet)
(Canvas, CPU — a proven fallback for devices without reliable WebGL).
**Right now only the Canvas renderer is active** — the WebGL path has a
confirmed rendering bug that isn't fixed yet, fully documented in
`js/README.md` so it doesn't need re-discovering. The redundancy design
itself is validated (it correctly falls back when the WebGL path fails);
it just currently starts on Canvas rather than falling back to it
mid-session. Every other layer on the map (boundaries, markers,
geolocation) stays on plain Leaflet regardless, since that part was never
the performance problem.

The **Flood Risk** layer takes the simpler, proven path directly:
protomaps-leaflet (Canvas) only, no WebGL attempt, since that's what
already works reliably for the landslide layer today. One PMTiles archive
exists per return period; dragging the slider swaps in the cached (or
newly-fetched) layer for that period, so switching years never reloads
the base map.

The site itself is still "clone it and open it" simple — no build step.
A few data-processing scripts (`scripts/process_landslides.py`,
`scripts/process_floods.py`, `scripts/convert_floods_to_pmtiles.py`) are
Python, not Node, because their job (raster/shapefile processing,
reprojecting, generating vector tiles) needed `geopandas` and `rasterio`,
not because the project's stack philosophy changed. Their *output*
(`data/landslide.pmtiles`, `data/pmtiles/flood_*yr.pmtiles`, etc.) is
just plain static files the site fetches, same as everything else.

Content (district/local body information) is sourced from KSDMA's
official open data, with the original source referenced wherever it's
used. Map boundary data is sourced from a mix of official government and
open community datasets — see `data/boundaries/README.md` for exactly
where each file came from.

## Project structure

```
kerala-disaster-map/
├── index.html              Landing page: search, district picker, flood demo, layer cards
├── map.html                The interactive map itself (accepts deep-link URL parameters)
├── README.md                This file
├── CONTRIBUTING.md          How to contribute, and the README-sync rule
├── LICENSE                  MIT License
├── datasummary.md           Inventory of raw hazard data staged in downloads/ (see below)
├── robots.txt               Tells search engine crawlers the site is crawlable, points to sitemap.xml
├── sitemap.xml              Lists the site's pages (landing + map) for search engines
├── googleaf6d8aefb34335dc.html  Google Search Console site-ownership verification file
├── .gitignore
├── css/                      Stylesheets
│   ├── README.md
│   ├── theme.css                Shared colours, fonts, dark mode (both pages)
│   ├── search.css               Shared place-search box
│   ├── style.css                Map page styles
│   └── landing.css              Landing page styles
├── js/                       JavaScript that runs the site
│   ├── README.md
│   ├── map.js                  Leaflet map, base maps, boundary layers, selection, loading/messages
│   ├── sidebar.js               Side panel: level buttons, base map, zoom hint, phone sheet
│   ├── geolocation.js           "Find My Location" map button
│   ├── facilities.js            School/hospital markers
│   ├── landslide-tiles.js       Landslide Zones toggle + opacity (PMTiles vector tiles)
│   ├── flood-tiles.js           Flood Risk toggle, return-period slider, play, odds (PMTiles)
│   ├── place-search.js          Shared place search (both pages)
│   ├── place-panel.js           Map page: place card + search box
│   ├── deeplink.js              Reads/writes map.html URL parameters
│   ├── main.js                  Entry point that boots the map page
│   └── landing.js               Landing page: district SVG, search, flood demo
├── data/                      All the data that powers the map
│   ├── README.md
│   ├── boundaries/              State/district/taluk/panchayat shapes (populated)
│   │   ├── places.json            Name-only search index for the landing page (generated)
│   │   └── README.md              Full source + license for each file
│   ├── hazards/                 Landslide "not assessed" areas + coverage (generated); vulnerable-school overlay (empty)
│   │   └── README.md
│   ├── facilities/              School/hospital points (empty so far)
│   │   └── README.md
│   ├── landslide.pmtiles        Landslide susceptibility, as vector tiles (populated, live)
│   ├── flood_{10,25,50,100,200}yr.geojson  Flood extent, source form (gitignored - see .gitignore)
│   └── pmtiles/
│       └── flood_{10,25,50,100,200}yr.pmtiles  Same flood data, tiled (populated, live)
├── scripts/                   Developer tooling (not part of the website)
│   ├── README.md
│   ├── check-readmes.js         Enforces the README-sync rule
│   ├── install-git-hooks.js     One-time setup for a local pre-commit check
│   ├── round-geojson-precision.js  Shrinks GeoJSON file size losslessly-for-web-use
│   ├── process_landslides.py    Builds data/landslide.pmtiles from raw shapefiles
│   ├── process_floods.py        Builds data/flood_*yr.geojson from raw depth rasters
│   └── convert_floods_to_pmtiles.py  Builds data/pmtiles/flood_*yr.pmtiles from those GeoJSON files
└── .github/
    ├── CONTENTS.md           Not README.md on purpose — see the file itself for why
    └── workflows/
        └── readme-check.yml    CI check that runs check-readmes.js on every PR
```

Every folder above has its own `README.md` explaining what's in it, kept
up to date as the folder changes — see `CONTRIBUTING.md` for how that's
enforced. The one exception is `.github/`, which uses `CONTENTS.md`
instead so GitHub renders the root `README.md` as the repo's homepage
(GitHub prefers `.github/README.md` over the root one when both exist).

## Getting started (for contributors)

1. Clone the repo.
2. Serve the folder with any static file server and open it in a browser
   — e.g. `python -m http.server` then visit `http://localhost:8000`.
   A plain `file://` open won't work: the map loads its boundary data with
   `fetch()`, which browsers block on the `file://` protocol.
3. Run `node scripts/install-git-hooks.js` once, so you get a heads-up
   locally if a change is missing a README update.
4. Read `CONTRIBUTING.md` before opening a pull request.

## Raw hazard data staging

There's a `downloads/` folder (gitignored, not part of the repo) where raw
KSDMA hazard-map material (PDFs, GeoTIFFs, shapefiles, KML/KMZ) gets
staged before anyone decides how — or whether — to turn a given file into
an actual map layer. `datasummary.md` is the human-readable inventory of
what's in there and where each file came from: file formats, which hazard
each dataset covers, sizes, and source links. Update that file whenever
`downloads/` changes meaningfully, the same way any other folder's README
gets kept in sync (see `CONTRIBUTING.md`) — it just isn't enforced by the
automated check, since `downloads/` itself isn't tracked by git.

## Data source & attribution

- District/local body disaster-management content: KSDMA's public/open
  data. Wherever content is copied in, the original source is referenced
  alongside it.
- Map boundary shapes (state/district/taluk/panchayat): see
  `data/boundaries/README.md` for the exact source and license of each
  file — they come from the Kerala state government, OpenStreetMap
  (via opendatakerala), and the geohacker/kerala + datameet.org community
  dataset.
- Landslide susceptibility zones: Geological Survey of India (GSI), 2022,
  via [KSDMA's hazard-maps page](https://sdma.kerala.gov.in/hazard-maps/)
  — see `datasummary.md` for the exact per-district source links.
- Flood return-probability data (historical, 10/25/50/100/200-year):
  via [KSDMA's hazard-maps page](https://sdma.kerala.gov.in/hazard-maps/)
  — see `datasummary.md` for the exact source links.

## License

This project's own code is licensed under the [MIT License](./LICENSE).
