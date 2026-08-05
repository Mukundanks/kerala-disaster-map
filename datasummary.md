# Data Summary

An inventory of everything currently sitting in `downloads/` — the raw
source material staged locally before we decide how (and whether) each
piece gets turned into something the map actually uses. `downloads/` is
gitignored (see `.gitignore`), so none of these raw files are in the repo
itself; this document is the record of what exists and where it came
from. Scanned 2026-08-05.

**Total: 216 files, ~2.3 GB**, across 4 hazard-type groups below.

---

## Flood

| Dataset | Format | Files | Size | Source |
|---|---|---|---|---|
| District flood-probability maps (historic) | PDF | 14 (all districts) | 256 MB | [sdma.kerala.gov.in/hazard-maps](https://sdma.kerala.gov.in/hazard-maps/) — one PDF per district, e.g. [Ernakulam](https://sdma.kerala.gov.in/wp-content/uploads/2022/05/Ernakulam_Hist.pdf) |
| District flood-probability maps (RCP 8.5 climate-change scenario) | PDF | 14 (all districts) | 508 MB | Same page, e.g. [Ernakulam](https://sdma.kerala.gov.in/wp-content/uploads/2022/05/Ernakulam_RCP85.pdf) |
| Flood return-probability rasters (10/25/50-yr, historic) | GeoTIFF (.tif/.tfw/.ovr/.xml) | 3 rasters (state-wide) | ~200 MB | [ZIP source](https://sdma.kerala.gov.in/wp-content/uploads/2026/06/1.-Flood-Return-Probability-Historical-10-25-50-years.zip) |
| Flood return-probability rasters (100/200/500-yr, historic) | GeoTIFF | 3 rasters | ~300 MB | [ZIP source](https://sdma.kerala.gov.in/wp-content/uploads/2026/06/2.Flood-Return-Probability-Historical-100-200-500-years.zip) |
| Flood return-probability rasters (10/25/50-yr, RCP 8.5) | GeoTIFF | 3 rasters | ~300 MB | [ZIP source](https://sdma.kerala.gov.in/wp-content/uploads/2026/06/3.-Flood-Return-Probability-RCP8.5-10-25-50-years.zip) |
| Flood return-probability rasters (100/200/500-yr, RCP 8.5) | GeoTIFF | 3 rasters | ~300 MB | [ZIP source](https://sdma.kerala.gov.in/wp-content/uploads/2026/06/4.Flood-Return-Probability-RCP8.5-100-200-500-years.zip) |
| Per-district flood zone maps | KMZ | 14 (all districts) | 36 MB | Downloaded directly by the project owner — exact source URL not confirmed (likely a KSDMA flood-atlas tool rather than the hazard-maps page above) |
| Flood hazard probability — area under inundation | PDF | 1 | included in `other-hazard-maps/` | [Link](http://sdma.kerala.gov.in/wp-content/uploads/2022/02/Image_Final.pdf) |
| Flood Probability Report 2022 (summary document) | PDF | 1 | 22 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2022/06/Flood-Probability-Report-2022_Final.pdf) |
| Flood-susceptible villages list | PDF | 1 (shared with Landslide below) | 8.8 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/11/ILDM_2014.pdf) |


## Landslide

| Dataset | Format | Files | Size | Source |
|---|---|---|---|---|
| District landslide susceptibility shapefiles (GSI, 2022) | Shapefile (.shp/.shx/.dbf/.prj/.cpg/.xml) | 13 districts | 135 MB | [sdma.kerala.gov.in/hazard-maps](https://sdma.kerala.gov.in/hazard-maps/), e.g. [Ernakulam](https://sdma.kerala.gov.in/wp-content/uploads/2025/08/Ernakulam.zip) |
| Landslide susceptibility zones (combined district map) | PDF | 1 | 8.7 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2025/06/Landslide_Susceptibility_Zones_Districts_FINAL.pdf) |
| Landslide zones (Wayanad) | KML + XSL stylesheet | 1 + 1 | 1.2 MB | Downloaded directly by the project owner — exact source URL not confirmed |
| Landslide-susceptible villages list | PDF | 1 (shared with Flood above) | 8.8 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/11/ILDM_2014.pdf) |

**Coverage gap:** only 13 of Kerala's 14 districts have a landslide shapefile — **Alappuzha is missing**. That's plausibly because Alappuzha is low-lying/coastal with no hill terrain to assess, but that's our guess, not a confirmed reason — worth checking before relying on it.

## Other Hazards

Downloaded from the same [hazard-maps page](https://sdma.kerala.gov.in/hazard-maps/) because they were listed there, even though they fall outside the Flood/Landslide/Schools split. Kept separate rather than force-fit into one of those three:

| Dataset | Format | Size | Source |
|---|---|---|---|
| Drought susceptibility | JPG | ~2 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2020/11/drought-suscept.jpg) |
| Lightning incidence | JPG | ~2 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/10/MAP-Lightning-Incidence.jpg) |
| Coastal hazard susceptibility | JPG | ~2 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/10/Map-Coastal-Hazard-Susceptibility.jpg) |
| Natural radioactivity | JPG | ~2 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/10/Map-Natural-Radio-Activity.jpg) |
| Road accident blackspots | JPG | ~2 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/10/Map-Road-Accident-Black-Spots.jpg) |
| Major industrial accident hazard zones | JPG | ~2 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/10/Map-Major-Industrial-Accident-Hazard-Zones.jpg) |
| Major festival hazard zones | JPG | ~2 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/10/Map-Major-Festival-Hazard.jpg) |
| Earthquake incidents and lineaments | JPG | 1.6 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/10/Map-Earthquake-incidents.jpg) |
| Soil piping affected areas | JPG | 1.4 MB | [Link](https://sdma.kerala.gov.in/wp-content/uploads/2018/10/Map-Soil-Piping-Affected.jpg) |
| `KL-CC.jpg` (unlabeled) | JPG | 1.7 MB | Downloaded directly by the project owner — exact source/subject not confirmed |

All of these are flat images (JPG/PDF), not GIS vector/raster data — usable as static reference pictures, not as map layers, unless someone georeferences them later.

## Schools / Infrastructure

**Nothing here yet.** No school or hospital data has been provided or
downloaded — this section exists so the gap is visible rather than
silently missing. See `data/facilities/README.md` for the (currently
empty) placeholder files already wired up on the map side, ready for this
data once it arrives.

---

## File format inventory

| Extension | Count | What it is |
|---|---|---|
| `.pdf` | 32 | Static map/report documents |
| `.xml` | 28 | Auxiliary metadata sidecar files (for `.tif` and `.shp`) — not primary data |
| `.zip` | 17 | Archives (4 flood rasters + 13 landslide shapefiles), kept alongside their extracted contents |
| `.tif` | 15 | GeoTIFF rasters (flood return-probability grids) |
| `.tfw` | 15 | World file — georeferencing companion to a `.tif` |
| `.ovr` | 15 | Overview/pyramid file — companion to a `.tif`, speeds up zoomed-out rendering |
| `.kmz` | 14 | Zipped KML (per-district flood zones) |
| `.dbf` | 14 | Shapefile attribute table component |
| `.cpg` | 14 | Shapefile character-encoding component |
| `.shx` | 13 | Shapefile index component |
| `.shp` | 13 | Shapefile geometry component (the actual shapes) |
| `.prj` | 13 | Shapefile projection/coordinate-system component |
| `.jpg` | 10 | Static map images |
| `.xsl` | 1 | Stylesheet accompanying a `.kml` |
| `.kml` | 1 | Plain (unzipped) KML |
| `.txt` | 1 | `downloads/SOURCES.txt` — the fetch manifest this summary was built from |

A `.shp` file is never usable alone — it needs its `.shx`, `.dbf`, `.prj`,
and `.cpg` neighbors to actually load, which is why they always travel
together in the counts above.

## Caveats

- **Ward-level data**: none of this fills the ward-boundary gap noted in
  `data/boundaries/README.md` — this is all hazard/risk data, not
  administrative boundaries.
- **Three files have unconfirmed sources** (`Flood_KML/*.kmz`,
  `landslides/doc.kml` + `.xsl`, `KL-CC.jpg`) because they were placed in
  `downloads/` directly rather than fetched from a known URL. Worth
  pinning down before treating them as citable sources in the live site.
- **Raw formats aren't map-ready yet.** PDFs and JPGs are flat images;
  GeoTIFFs and shapefiles need conversion/processing before they can
  become a Leaflet layer. None of this is wired into the site yet — this
  document is just the inventory.
