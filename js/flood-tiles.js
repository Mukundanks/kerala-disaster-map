// Flood Risk layer. Lets you pick a historical flood return period
// (10/25/50/100/200-year) and see that scenario's flooded-area polygons,
// served as PMTiles vector tiles: data/pmtiles/flood_{year}yr.pmtiles
// (see scripts/process_floods.py and scripts/convert_floods_to_pmtiles.py
// for how those are generated).
//
// Rendered with protomaps-leaflet (Canvas) - the same renderer the
// landslide layer actually runs on right now (see js/README.md, "Why
// MapLibre for the landslide layer," for why WebGL isn't used here
// either at the moment).

const FLOOD_RETURN_PERIODS = [10, 25, 50, 100, 200];
const FLOOD_COLOR = '#2980b9';

// data/pmtiles/flood_*yr.pmtiles only has tiles up to zoom 13 (see
// MAX_ZOOM in scripts/convert_floods_to_pmtiles.py) - without
// maxDataZoom, protomaps-leaflet stops rendering entirely past that
// zoom instead of reusing/scaling up the deepest tile it has. Named
// separately from landslide-tiles.js's MAX_DATA_ZOOM to avoid a global
// naming collision (these files share one global scope, no modules).
const FLOOD_MAX_DATA_ZOOM = 13;

function floodPmtilesUrl(year) {
  return `data/pmtiles/flood_${year}yr.pmtiles`;
}

function floodPaintRules() {
  return [{
    dataLayer: 'flood',
    symbolizer: new protomapsL.PolygonSymbolizer({
      fill: FLOOD_COLOR,
      opacity: 0.4,
    }),
  }];
}

function setupFloodToggle(map) {
  const checkbox = document.getElementById('toggle-flood-risk');
  const slider = document.getElementById('flood-year-slider');
  const label = document.getElementById('flood-year-label');

  // One layer per return period, created lazily and kept around so
  // dragging back to a value you've already visited doesn't re-fetch it.
  const layersByYear = {};
  let activeLayer = null;

  function currentYear() {
    return FLOOD_RETURN_PERIODS[Number(slider.value)];
  }

  function updateLabel() {
    label.textContent = `1-in-${currentYear()} Year Flood Zone`;
  }

  function showYear(year) {
    if (activeLayer) map.removeLayer(activeLayer);

    if (!layersByYear[year]) {
      layersByYear[year] = protomapsL.leafletLayer({
        url: floodPmtilesUrl(year),
        paintRules: floodPaintRules(),
        maxDataZoom: FLOOD_MAX_DATA_ZOOM,
      });
    }
    activeLayer = layersByYear[year];
    activeLayer.addTo(map);
  }

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      showYear(currentYear());
    } else if (activeLayer) {
      map.removeLayer(activeLayer);
    }
  });

  slider.addEventListener('input', () => {
    updateLabel();
    if (checkbox.checked) {
      showYear(currentYear());
    }
  });

  updateLabel();
}
