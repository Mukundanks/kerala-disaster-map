# data/hazards/

GeoJSON files for hazard-zone overlays, toggled on/off by the checkboxes
in the sidebar (`js/sidebar.js`, `HAZARD_LAYERS`), plus generated data
about where GSI's landslide mapping does and doesn't reach (see
"Landslide coverage" below).

## Current status

| File | Toggled by | Status |
|---|---|---|
| `vulnerable-schools.geojson` | "Vulnerable Schools" checkbox | Empty `FeatureCollection` — no data sourced yet. |

The checkbox is fully wired up — checking it fetches the file and adds it
to the map, unchecking removes it — so once real polygons are dropped
into this file, they'll appear with no code changes needed. Until then,
checking the box visibly does nothing, which is why it has a "no data
yet" hint next to it in the sidebar.

**Landslide Zones and Flood Risk are not here anymore.** Both have real
data now, but the source data for both is far too large/fragmented
(100+ MB and ~17-19 MB per file respectively, as plain GeoJSON) to fetch
as one file each. They live in `data/landslide.pmtiles` and
`data/pmtiles/flood_*yr.pmtiles` instead — vector-tile archives, rendered
with the protomaps-leaflet plugin in `js/landslide-tiles.js` and
`js/flood-tiles.js`. See `scripts/README.md` and `data/README.md` for
how each is generated.

## Landslide coverage (generated)

Two files describe where GSI's landslide-susceptibility mapping does and
doesn't reach. Both are generated from the raw shapefiles by
`python scripts/process_landslide_coverage.py`. Re-run it if the GSI
shapefiles or the boundary files in `data/boundaries/` change.

| File | Used by | What's in it |
|---|---|---|
| `landslide-unassessed.geojson` | Landslide layer, shown hatched as "Not assessed" (`js/landslide-tiles.js`) | Every part of Kerala that GSI's data leaves blank, about half the state, cleaned of specks under ~0.1 km². |
| `landslide-coverage.json` | Place card on the map page (`js/place-panel.js`) | For each state/district/taluk/local-body feature, in the same order as its `data/boundaries/*.geojson` file: `[mapped, high, moderate, low]`, each as a % of the feature's area. |

**Why they exist:** GSI's data only has High/Moderate/Low zones. Areas it
never mapped are simply missing, which on a map looks exactly like "no
risk". Most gaps are coastal plain, but some cover hill country. For
example, Moothedam (0% mapped) and Edakkara (18%) in Malappuram sit in a
gap cut along straight lines that follow the 1:50,000 topographic sheet
grid, next to fully-mapped hill panchayats. KSDMA's own published state
map has the same gap. So the map marks these areas "not assessed" instead
of leaving them blank.

## Expected format

Each file should stay a standard GeoJSON `FeatureCollection` of polygons
(or multipolygons), e.g.:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [...] },
      "properties": { "name": "..." }
    }
  ]
}
```

## Notes for contributors

When real hazard-zone data is added here, update this README with where
it came from (source + license, same as `data/boundaries/README.md`) and
remove the "no data yet" hint for that layer in `map.html` (and the
"Coming soon" card on the landing page, `index.html`).
