# js/

The site's JavaScript, loaded directly by `map.html` and `index.html` (no bundler, no
build step — plain `<script>` tags, in load order). Files talk to each
other through plain global functions (no modules) — e.g. `main.js` calls
`initMap()` from `map.js` and passes the result to the other setup
functions.

## What's here

- **map.js** — sets up the Leaflet map, centered on Kerala
  (lat 10.8505, lng 76.2711, zoom 7), with zoom, "show all of Kerala" and
  scale controls. `BASEMAPS` lists the base maps (muted/standard OSM,
  Esri satellite) that `setBasemap()` switches between. `BOUNDARY_LAYERS`
  (state/district/taluk/panchayat/ward) holds one color, hover label
  (`nameField`), place-card details (`describe()`) and name lookup
  (`placeName`/`placeDistrict`) per level. `showLevel(map, level)` fetches
  that level's file from `data/boundaries/*.geojson` the first time it's
  selected, caches it, and swaps it in as the only visible boundary layer.
  It resolves to the layer it showed, shares one download between callers
  asking for the same level at once, and ignores a fetch that finishes
  after you've already switched level. Ward has no data yet (see
  `data/boundaries/README.md`), so it's skipped.
  Shapes highlight on hover and show their name as a tooltip.
  `selectShape()` / `clearSelection()` manage the one selected shape and
  fire `placeselect` / `placeclear` events on the map, which
  `place-panel.js` and `deeplink.js` listen for. `findPlace()` finds a shape
  by name; `findPlaceAt()` finds the shape containing a point (ray
  casting, used by Find My Location). Also owns the two overlays on the
  map: the loading pill (`startLoading()` / `finishLoading()`, and
  `watchLayerLoading()` for tile layers) and the message strip
  (`showMapMessage()` / `hideMapMessage()`). `HAZARD_MIN_ZOOM` (8) is
  where the PMTiles hazard layers start.
- **sidebar.js** — wires up the side panel: the boundary-level buttons
  (`chooseLevel()` lets other code switch level the same way), the base
  map chips, the Vulnerable Schools toggle (which fetches
  `data/hazards/*.geojson`, currently an empty placeholder; see
  `data/hazards/README.md`), the "zoom in to see hazard layers" message,
  and the "Layers" button that opens the panel as a bottom sheet on
  phones. (Landslide Zones and Flood Risk are wired up in their own files.)
- **geolocation.js** — the "Find My Location" map button. Uses the
  browser's Geolocation API to drop a dot with an accuracy circle, pans
  there, and selects the shape you're in at the current boundary level.
  Status and errors go to the message strip.
- **facilities.js** — loads school and hospital markers from
  `data/facilities/*.geojson` with custom icons (green book for schools,
  red cross for hospitals). Those files are currently empty placeholders
  — see `data/facilities/README.md`.
- **landslide-tiles.js** — wires up the "Landslide zones" toggle and its
  opacity slider separately from the other hazard toggles, because it's
  backed by real data (`data/landslide.pmtiles`) that's too
  large/fragmented for plain GeoJSON. Has **two renderers built in**:
  MapLibre GL JS (WebGL/GPU) and protomaps-leaflet (Canvas/CPU). **Only the
  Canvas renderer is active right now** (and only it supports the opacity
  slider) — see "Why MapLibre for the landslide layer" below for the full
  reasoning, current status, and a debugging log of the specific bug
  blocking the WebGL path. `MAX_DATA_ZOOM` (13) is passed as
  `maxDataZoom` to protomaps-leaflet so the layer stays visible (reusing
  the deepest tile, scaled up) instead of disappearing once you zoom in
  past the data's native resolution. See `scripts/process_landslides.py`
  for how the tiles themselves are generated.
- **flood-tiles.js** — wires up the "Flood risk" toggle, the
  return-period slider (10/25/50/100/200-year, five discrete steps - the
  slider's `value` is an index into `FLOOD_RETURN_PERIODS`, not the year
  itself), the play button that steps through them, the odds line, and
  the opacity slider. Renders with protomaps-leaflet (Canvas), same as
  the landslide layer's active renderer, fetching
  `data/pmtiles/flood_{year}yr.pmtiles`. One Leaflet layer per return
  period is created lazily and cached, so dragging back to an
  already-visited value swaps to the cached layer instead of re-fetching.
  `floodOdds(year)` gives the chance of that flood in one year (1/N) and
  at least once in 30 years (1 - (1 - 1/N)^30); the landing page uses it
  too. Uses its own `FLOOD_MAX_DATA_ZOOM` constant (not
  landslide-tiles.js's `MAX_DATA_ZOOM`) for the same overzoom reason
  explained there — these files share one global scope (no modules), so
  identically-named top-level `const`s would collide. See
  `scripts/process_floods.py` / `scripts/convert_floods_to_pmtiles.py`
  for how the tiles themselves are generated.
- **place-search.js** — the "find a place" search box shared by both
  pages: loads `data/boundaries/places.json` the first time it's needed,
  ranks matches (exact, prefix, word start, anywhere; English or
  Malayalam), and handles the dropdown, arrow keys, Enter and Escape.
  `setupPlaceSearch({ input, list, onSelect, onActive })` leaves what a
  selection does up to the page.
- **place-panel.js** — the map page's place card (shown on
  `placeselect`, with "Zoom to", "Copy link" and Wikidata links; closed by
  its × button, Escape, or clicking empty map), its search box, and
  `goToPlace()`, which switches level, finds a place by name and selects
  it.
- **deeplink.js** — URL parameters for the map page: `level`,
  `name` + `district` (select one shape), `layers=flood,landslide`,
  `flood=<return period>`, `basemap`, and `locate=1`. The full list is in
  the file header. `applyDeepLink()` sets the panel controls and fires
  their normal events, so the panel always matches the map.
  `setupUrlSync()` writes the same parameters back (with `replaceState`)
  whenever the panel or the selection changes, so the address bar is
  always a shareable link to the current view. E.g.
  `map.html?level=panchayat&name=Aluva&district=Ernakulam&layers=flood&flood=100`.
- **main.js** — the map page's entry point. Waits for the page to finish
  loading, reads the deep link, calls `initMap()` with its level, runs
  every setup function above against the resulting map, then applies the
  rest of the deep link.
- **landing.js** — everything interactive on the landing page
  (`index.html`): the clickable SVG of the 14 districts (drawn from
  `data/boundaries/district.geojson` with a simple projection, no map
  library), the "Check my area" search (`place-search.js`, opening the
  result on the map page), the count-up stats, and the flood
  return-period demo. The demo is a small Leaflet map around Aluva that
  reuses `flood-tiles.js`'s `FLOOD_RETURN_PERIODS`, `floodPmtilesUrl()`,
  `floodPaintRules()` and `floodOdds()`, adds all five periods at once and
  cross-fades between them with `setOpacity()` so dragging doesn't flash,
  and only starts fetching tiles once scrolled near. Everything links into
  `map.html` using `deeplink.js`'s parameters.

## Load order

`map.html` loads, in order: Leaflet library → protomaps-leaflet library
→ MapLibre GL JS → maplibre-gl-leaflet (the bridge that lets a MapLibre
layer live inside a Leaflet map) → pmtiles (so MapLibre can read a
`.pmtiles` file directly) → `map.js` → `sidebar.js` → `geolocation.js` →
`facilities.js` → `landslide-tiles.js` → `flood-tiles.js` →
`place-search.js` → `place-panel.js` → `deeplink.js` → `main.js`. Each
file after the libraries defines functions that `main.js` calls, so it
has to load last.

`index.html` (the landing page) loads only: Leaflet → protomaps-leaflet →
`flood-tiles.js` (for its constants, paint rules and `floodOdds()`; its
`setupFloodToggle()` isn't called there) → `place-search.js` →
`landing.js`.

## Why MapLibre for the landslide layer

This section exists because the choice wasn't obvious, and it's worth
recording the reasoning rather than just the result.

**Current status: MapLibre is implemented but disabled** (`MAPLIBRE_ENABLED
= false` in `landslide-tiles.js`). The Canvas (protomaps-leaflet) renderer
is what actually runs today. Here's exactly what's known:

- The intent (see below) was real: GPU rendering for a dataset this
  fragmented is a legitimate, well-justified idea, not a fad.
- The implementation has a **confirmed, reproducible bug**: with
  `MAPLIBRE_ENABLED = true`, the MapLibre layer loads real data correctly
  — `glMap.queryRenderedFeatures()` returns the expected features with
  correct `susceptibility`/`district` properties, at the correct zoom
  range — but paints *nothing* to the canvas. Confirmed via direct
  screenshots (not just DOM/state inspection) across multiple clean
  reloads. Things that were checked and ruled out: CSS/z-index/hidden
  ancestors (canvas and every ancestor have `opacity:1`,
  `visibility:visible`), invalid style/paint expressions (style spec is
  valid, confirmed via `getPaintProperty`), wrong `source-layer` name
  (matches `scripts/process_landslides.py`'s `LAYER_NAME`), software/
  SwiftShader WebGL fallback (renderer reported was real hardware — Intel
  UHD Graphics via ANGLE/D3D11), and the standard "container resized
  after WebGL init" fix (`glMap.resize()` + `glMap.triggerRepaint()`
  changed nothing).
- A **separate, also-confirmed bug**: MapLibre's synced zoom trails
  Leaflet's actual zoom by exactly 1 level when driven through
  `maplibre-gl-leaflet@0.1.3` (e.g. Leaflet at zoom 10 while
  `glMap.getZoom()` reports 9, reproducible, not a timing artifact —
  confirmed with `animate: false` and generous waits).
- Not yet tried: a different `maplibre-gl-leaflet` version, or dropping
  the bridge library entirely and hand-syncing a standalone MapLibre map
  to Leaflet's move/zoom events.
- The **redundancy mechanism itself was validated** during this
  debugging — real bugs in the WebGL setup code correctly triggered
  `fallBackToCanvas()`, which successfully swapped in the Canvas renderer
  the layer used before MapLibre existed. That part of the design works
  as intended; it just currently activates from the start (via
  `MAPLIBRE_ENABLED = false`) rather than mid-session.

If you want to pick this back up: flip `MAPLIBRE_ENABLED` to `true`,
reproduce with a hard reload + zoom in over a known landslide-heavy area
(e.g. Idukki/Wayanad), and check `glMap.queryRenderedFeatures().length`
in the console — if it's non-zero but nothing renders, you've hit the
same bug described above and it's still unresolved.

**The problem.** The landslide dataset is ~295,000 small, mostly-isolated
polygons (raster-classification "speckle" — one district alone has
32,000+ separate high-risk fragments). Rendering that many shapes with
Leaflet/protomaps-leaflet's Canvas 2D renderer is CPU-bound: every
pan/zoom repaint has to individually fill and alpha-blend every polygon
path on screen, one at a time, on the main thread. That's what caused the
noticeable slowdown when this layer first shipped.

**Ideas considered and ruled out:**

- *FlatBuffers / SharedArrayBuffer, zero-parse binary data in a Web
  Worker.* Doesn't apply to our actual bottleneck — we don't ship GeoJSON
  to the browser for this layer at all; it's already binary vector tiles
  (MVT/protobuf) via PMTiles, and protobuf-decoding a ~20KB tile isn't
  measurably slow. On top of that, `SharedArrayBuffer` requires
  `Cross-Origin-Opener-Policy` / `Cross-Origin-Embedder-Policy` response
  headers, which **GitHub Pages cannot set** — a hard platform blocker,
  not just extra effort.
- *TopoJSON arc-sharing (deduplicating shared polygon boundaries).*
  TopoJSON's win comes from *adjacent* polygons sharing long edges (e.g.
  country borders). Our data is the opposite — mostly small, isolated
  islands with little shared boundary to deduplicate. It would also mean
  giving up per-tile loading (TopoJSON is a single whole-dataset
  topology), undoing the actual fix for "one huge file" that PMTiles
  already provided.
- *Hand-rolling a WebGL/OffscreenCanvas+Worker renderer.* This is real
  and would work, but MapLibre GL JS already **is** that (GPU rendering
  via WebGL, tile fetch/decode already off the main thread) — mature,
  battle-tested at large scale, with official PMTiles support. Building a
  custom version would be reinventing a well-solved problem, with more
  risk and no real upside.

**Why a fallback, not a full switch.** WebGL isn't universally reliable —
low-RAM or older Android devices can hit WebGL context loss under memory
pressure, or have GPU drivers Chrome blocklists (falling back to *software*
WebGL, which can be slower than Canvas 2D). So this isn't "MapLibre
replaces the old renderer" — both exist, MapLibre is tried first, and if
WebGL isn't supported, the CDN script fails to load, or MapLibre errors
out or loses its context at runtime, `landslide-tiles.js` automatically
falls back to the protomaps-leaflet Canvas renderer, which is the same
code that ran this layer before and is independently known to work. See
the `supportsWebGL()` / `fallBackToCanvas()` logic in that file.

**Scope.** Only the landslide layer uses MapLibre. Everything else
(boundaries, markers, geolocation, side panel) stays on plain Leaflet — that
part of the app was never the performance problem, so there was no reason
to touch it.

## Notes for contributors

If you add a new JS file, remember to also add a `<script>` tag for it in
`map.html` or `index.html` (in the right order), and update this README to explain what
it does.
