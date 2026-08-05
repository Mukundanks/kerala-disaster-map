# data/boundaries/

The GeoJSON files that draw the map's boundary layers — state, district,
taluk, and panchayat/municipality/corporation. Loaded on demand by
`js/map.js` (`BOUNDARY_LAYERS`) when you pick a level from the sidebar
dropdown.

## Files, and exactly where each came from

| File | Source | License | What's in it |
|---|---|---|---|
| `state.geojson` | [geohacker/kerala](https://github.com/geohacker/kerala) (`geojsons/state.geojson`), credited there to [datameet.org/maps](https://datameet.org/) | No explicit license file in that repo; DataMeet's stated practice for this data is ODbL. Attributed here in good faith with a link back to the source. | 1 feature: the outline of Kerala. |
| `district.geojson` | [Kerala government asset allotment portal](https://assetallotment.kerala.gov.in/get-district-geojson) — used as the primary source since it's the official government dataset | Government of Kerala open data | 14 features, one per district. |
| `district-osm.geojson` | [geohacker/kerala](https://github.com/geohacker/kerala) (`geojsons/district.geojson`) | Same caveat as `state.geojson` above | 14 features. Kept as a secondary/cross-check copy — **not currently used by the map** (only `district.geojson` is loaded), but useful if the official source ever needs verifying against. |
| `taluk.geojson` | [geohacker/kerala](https://github.com/geohacker/kerala) (`geojsons/taluk.geojson`) | Same caveat as `state.geojson` above | 61 features. Note: Kerala is usually cited as having 75-78 taluks depending on the year, so this dataset may be missing a few recent ones — flagged here rather than presented as complete. |
| `panchayat.geojson` | [opendatakerala/lsg-kerala-data](https://github.com/opendatakerala/lsg-kerala-data) (`data/kerala_lsg_data.geojson`), sourced from OpenStreetMap by the OSM Kerala community | [ODbL](https://github.com/opendatakerala/lsg-kerala-data/blob/main/LICENSE.md) (OpenStreetMap® data, © OpenStreetMap contributors) | 1,034 features: 941 gram panchayats + 87 municipalities + 6 municipal corporations — matches Kerala's official local self-government count exactly. |

## Why no ward-level file

We looked. Ward boundaries (there are roughly 21,900 of them across
Kerala's local bodies) don't currently exist as usable open GeoJSON/vector
data anywhere we could find:

- OpenStreetMap has essentially none mapped — a direct Overpass API query
  for Kerala ward-level administrative boundaries returned 0 results.
- KILA's data portal (`dmp.kila.ac.in`) is access-restricted.
- The Kerala State Election Commission's ward maps
  ([osmkerala/lsgmaps](https://github.com/osmkerala/lsgmaps)) are scanned
  PDF images per local body, not vector boundary data.

The "Ward" option in the sidebar is left visible but disabled so this gap
is honest and visible rather than silently missing. If you find a real
source for this, that's a very welcome contribution.

## A note on file sizes

These files have been run through
`scripts/round-geojson-precision.js`, which rounds coordinates to 5-6
decimal places (about 1-11cm of precision — far more than needed for a
web map) to cut file size roughly in half without visibly changing the
shapes. If you replace any of these files, consider running them through
that script too.

## Notes for contributors

If you add, replace, or re-source any boundary file, update the table
above with where the new one came from and its license — that's the whole
point of this README.
