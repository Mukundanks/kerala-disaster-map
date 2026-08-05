# data/facilities/

GeoJSON point data for facility markers on the map, loaded by
`js/facilities.js`.

## Current status: placeholders, no real data yet

| File | Shown as | Status |
|---|---|---|
| `schools.geojson` | Green book icon | Empty `FeatureCollection`. Real data to be provided later. |
| `hospitals.geojson` | Red cross icon | Empty `FeatureCollection`. Real data to be provided later. |

The loading code is already wired up (`loadFacilities()` in
`js/facilities.js`) — once real point data is dropped into these files, the
markers will start showing up with no code changes needed.

## Expected format

Each file should be a GeoJSON `FeatureCollection` of Point features, e.g.:

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [76.2711, 10.8505] },
      "properties": { "name": "Example School" }
    }
  ]
}
```

`properties.name`, if present, is shown in the marker's popup when clicked.

## Icon design

The icons in `js/facilities.js` / `css/style.css` (a green circular badge
with a book emoji for schools, a white circle with a red cross for
hospitals) are a first-pass placeholder design, since there wasn't a
reference image to match exactly. Worth revisiting once real data —
and any specific design the project wants — is available.

## Notes for contributors

When real facility data is added here, update this README with where it
came from (source + license).
