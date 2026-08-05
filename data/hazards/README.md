# data/hazards/

GeoJSON files for hazard-zone overlays, toggled on/off by the checkboxes
in the sidebar (`js/sidebar.js`, `HAZARD_LAYERS`).

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
remove the "no data yet" hint for that layer in `index.html`.
