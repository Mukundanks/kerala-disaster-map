// Landslide susceptibility layer (GSI, 2022), served as PMTiles vector
// tiles from data/landslide.pmtiles (see scripts/process_landslides.py).
//
// Two renderers exist here, by design - see js/README.md ("Why MapLibre
// for the landslide layer") for the full reasoning:
//
//   1. MapLibre GL JS (WebGL / GPU) - intended as the primary path, for
//      performance (this dataset is ~295,000 small fragmented polygons).
//      CURRENTLY DISABLED (MAPLIBRE_ENABLED = false below) - it has a
//      confirmed rendering bug in this app: the map loads real data
//      correctly (queryRenderedFeatures() returns the expected features,
//      right properties, right zoom range) but paints nothing to the
//      canvas, even after forcing resize()/triggerRepaint(). There's also
//      a separate, real zoom-sync bug where MapLibre's internal zoom
//      trails Leaflet's by exactly 1 level. Not yet root-caused - see
//      js/README.md for the full debugging log before re-attempting this.
//   2. protomaps-leaflet (Canvas / CPU) - the active renderer for now.
//      Proven, tested, and working - this is the same code that ran the
//      layer before MapLibre was ever added.
//
// The redundancy mechanism itself (fall back to Canvas if WebGL isn't
// available or MapLibre errors) is implemented and was validated - it
// correctly caught real bugs during development and switched over. It's
// just that, right now, Canvas runs from the start rather than as a
// mid-session fallback, because the "primary" path doesn't work yet.

const LANDSLIDE_COLORS = {
  High: '#e3342f',
  Moderate: '#f0883e',
  Low: '#f6c453',
};

// data/landslide.pmtiles only has tiles up to zoom 13 (see MAX_ZOOM in
// scripts/process_landslides.py) - without maxDataZoom, protomaps-leaflet
// stops rendering entirely past that point instead of reusing/scaling up
// the deepest tile it has, so the layer would just vanish as you zoom in
// further than the base map does (Leaflet's own tiles go to zoom 19).
const MAX_DATA_ZOOM = 13;

function landslidePmtilesUrl() {
  return new URL('data/landslide.pmtiles', window.location.href).href;
}

function supportsWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

// Registering the pmtiles:// protocol is a one-time, global step and is
// harmless to run even if the WebGL path never gets used.
function registerPmtilesProtocol() {
  if (typeof maplibregl === 'undefined' || typeof pmtiles === 'undefined') return false;
  if (maplibregl.__pmtilesProtocolRegistered) return true;
  const protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', protocol.tile);
  maplibregl.__pmtilesProtocolRegistered = true;
  return true;
}

function buildMaplibreStyle() {
  return {
    version: 8,
    sources: {
      landslide: {
        type: 'vector',
        url: 'pmtiles://' + landslidePmtilesUrl(),
      },
    },
    layers: [
      {
        id: 'landslide-fill',
        type: 'fill',
        source: 'landslide',
        'source-layer': 'landslide',
        paint: {
          'fill-color': [
            'match', ['get', 'susceptibility'],
            'High', LANDSLIDE_COLORS.High,
            'Moderate', LANDSLIDE_COLORS.Moderate,
            'Low', LANDSLIDE_COLORS.Low,
            /* default */ '#cccccc',
          ],
          'fill-opacity': 0.6,
        },
      },
    ],
  };
}

// --- Canvas (protomaps-leaflet) renderer - active by default, see file header ---

function buildLandslidePaintRules() {
  return Object.keys(LANDSLIDE_COLORS).map((level) => ({
    dataLayer: 'landslide',
    symbolizer: new protomapsL.PolygonSymbolizer({
      fill: LANDSLIDE_COLORS[level],
      opacity: 0.6,
    }),
    filter: (zoom, feature) => feature.props.susceptibility === level,
  }));
}

// The opacity slider (#landslide-opacity) is only wired up here - the
// WebGL path below would need its own handling if it's ever re-enabled.
function setupLandslideCanvasRenderer(map, checkbox) {
  const opacity = document.getElementById('landslide-opacity');
  let layer = null;

  checkbox.addEventListener('change', () => {
    if (!checkbox.checked) {
      if (layer) map.removeLayer(layer);
      return;
    }
    if (!layer) {
      layer = protomapsL.leafletLayer({
        url: 'data/landslide.pmtiles',
        paintRules: buildLandslidePaintRules(),
        maxDataZoom: MAX_DATA_ZOOM,
      });
      watchLayerLoading(layer, 'landslide zones');
    }
    layer.setOpacity(Number(opacity.value) / 100);
    layer.addTo(map);
  });

  opacity.addEventListener('input', () => {
    if (layer) layer.setOpacity(Number(opacity.value) / 100);
  });
}

// --- MapLibre GL (WebGL) renderer - disabled, see file header ---

function setupLandslideWebGLRenderer(map, checkbox) {
  let glLayer = null;
  let fellBack = false;

  const fallBackToCanvas = (reason) => {
    if (fellBack) return;
    fellBack = true;
    console.warn('Landslide layer: falling back to Canvas renderer -', reason);
    if (glLayer) {
      try {
        map.removeLayer(glLayer);
      } catch (e) {
        // already gone - nothing to clean up
      }
    }
    checkbox.replaceWith(checkbox.cloneNode(true)); // drop the old (GL) listener
    const freshCheckbox = document.getElementById(checkbox.id);
    setupLandslideCanvasRenderer(map, freshCheckbox);
    if (freshCheckbox.checked) freshCheckbox.dispatchEvent(new Event('change'));
  };

  checkbox.addEventListener('change', () => {
    if (!checkbox.checked) {
      if (glLayer) map.removeLayer(glLayer);
      return;
    }

    try {
      const isNew = !glLayer;
      if (isNew) glLayer = L.maplibreGL({ style: buildMaplibreStyle() });
      glLayer.addTo(map);

      // getMaplibreMap() only returns a real instance once the layer has
      // been added to a Leaflet map (that's when maplibre-gl-leaflet
      // actually constructs it) - so these listeners can only be wired up
      // after addTo(), not before.
      if (isNew) {
        const glMap = glLayer.getMaplibreMap();
        glMap.on('error', (e) => fallBackToCanvas(e && e.error ? e.error.message : 'MapLibre error'));
        glMap.getCanvas().addEventListener('webglcontextlost', () => fallBackToCanvas('WebGL context lost'));
      }
    } catch (e) {
      fallBackToCanvas(e.message);
    }
  });
}

// --- "Not assessed" overlay ---
//
// GSI's data only contains High/Moderate/Low zones; anywhere it didn't
// map is simply blank, which on a map reads as "no risk". This hatches
// those gaps (data/hazards/landslide-unassessed.geojson, generated by
// scripts/process_landslide_coverage.py) whenever the landslide layer is
// on. It's drawn in its own pane under the boundary outlines and ignores
// the mouse, so shapes stay hoverable/clickable through it. The hatch
// pattern itself (#unassessed-hatch) is an inline <svg> in map.html.
//
// Hidden below HAZARD_MIN_ZOOM, where the landslide tiles themselves
// don't draw - otherwise you'd see the gaps but not the zones.

const UNASSESSED_URL = 'data/hazards/landslide-unassessed.geojson';

function setupUnassessedOverlay(map) {
  map.createPane('unassessed').style.zIndex = 350; // overlayPane is 400
  let layer = null;
  let download = null; // shared while the file is in flight
  let wanted = false;

  const shouldShow = () => wanted && map.getZoom() >= HAZARD_MIN_ZOOM;

  const load = async () => {
    startLoading('not-assessed areas');
    try {
      const data = await (await fetch(UNASSESSED_URL)).json();
      layer = L.geoJSON(data, {
        pane: 'unassessed',
        renderer: L.svg({ pane: 'unassessed' }),
        interactive: false,
        style: { className: 'unassessed', stroke: false, fillOpacity: 1 },
      });
    } finally {
      finishLoading('not-assessed areas');
    }
  };

  const update = async () => {
    if (!shouldShow()) {
      if (layer) map.removeLayer(layer);
      return;
    }
    if (!layer) {
      if (!download) {
        // On failure, forget the attempt so the next toggle retries.
        download = load().catch(() => {
          download = null;
          showMapMessage('Couldn’t load the not-assessed areas.');
        });
      }
      await download;
      if (!layer || !shouldShow()) return; // failed, or switched off/zoomed out meanwhile
    }
    layer.addTo(map);
  };

  // Listening on the document rather than the checkbox, because the
  // checkbox can be swapped for a fresh copy when falling back between
  // renderers (see fallBackToCanvas() above).
  document.addEventListener('change', (e) => {
    if (e.target.id !== 'toggle-landslide') return;
    wanted = e.target.checked;
    update();
  });
  map.on('zoomend', update);
}

// Flip this to true to re-attempt the WebGL path (e.g. while debugging a
// fix) - everything downstream already respects it.
const MAPLIBRE_ENABLED = false;

function setupLandslideToggle(map) {
  setupUnassessedOverlay(map);

  const checkbox = document.getElementById('toggle-landslide');
  const webglReady =
    MAPLIBRE_ENABLED &&
    supportsWebGL() &&
    typeof L.maplibreGL === 'function' &&
    registerPmtilesProtocol();

  if (webglReady) {
    setupLandslideWebGLRenderer(map, checkbox);
  } else {
    setupLandslideCanvasRenderer(map, checkbox);
  }
}
