// Kerala's center point and a zoom level that shows the whole state at once.
const KERALA_CENTER = [10.8505, 76.2711];
const KERALA_ZOOM = 7;

// The landslide and flood PMTiles archives start at zoom 8 (MIN_ZOOM in
// scripts/process_landslides.py and scripts/convert_floods_to_pmtiles.py),
// so neither layer draws anything below this. sidebar.js uses it to tell
// people to zoom in rather than leave them looking at an empty map.
const HAZARD_MIN_ZOOM = 8;

// Base maps the panel's "Base map" chips switch between. "muted" is the
// default: plain OSM tiles with colour pulled back (and inverted in dark
// mode) by CSS - see .basemap--muted in css/style.css - so hazard colours
// stand out.
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const BASEMAPS = {
  muted: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: OSM_ATTRIBUTION, className: 'basemap--muted' },
  },
  standard: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: { maxZoom: 19, attribution: OSM_ATTRIBUTION },
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 19,
      maxNativeZoom: 18,
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
};

const DEFAULT_BASEMAP = 'muted';

const LOCAL_BODY_KINDS = {
  gram_panchayat: 'Grama Panchayat',
  municipality: 'Municipality',
  municipal_corporation: 'Municipal Corporation',
};

// Each entry is one administrative level the map can show. Only one level
// is displayed at a time - the panel's "Boundaries" buttons pick which.
// Colors are kept distinct per level so it's obvious which one you're
// looking at when you switch.
//
// nameField is the hover label. describe() is what the place card shows
// when you click a shape (see place-panel.js). placeName/placeDistrict
// pull the raw name and district out of a feature, so search results and
// deep links like map.html?level=panchayat&name=X&district=Y (see
// deeplink.js) can find the right shape. They match the fields used by
// scripts/build-place-index.js to build the search index.
const BOUNDARY_LAYERS = {
  state: {
    label: 'State',
    url: 'data/boundaries/state.geojson',
    color: '#0b3d91',
    weight: 3,
    fillOpacity: 0.02,
    nameField: (p) => p.ST_NM,
    describe: (p) => ({ name: p.ST_NM, kind: 'State' }),
  },
  district: {
    label: 'District',
    url: 'data/boundaries/district.geojson',
    color: '#1f6feb',
    weight: 2,
    fillOpacity: 0.04,
    nameField: (p) => p.dis_name,
    describe: (p) => ({ name: p.dis_name, kind: 'District' }),
    placeName: (p) => p.dis_name,
    placeDistrict: (p) => p.dis_name,
  },
  taluk: {
    label: 'Taluk',
    url: 'data/boundaries/taluk.geojson',
    color: '#2ea043',
    weight: 1.5,
    fillOpacity: 0.04,
    nameField: (p) => `${p.TALUK} (${p.DISTRICT} district)`,
    describe: (p) => ({ name: p.TALUK, kind: 'Taluk', district: p.DISTRICT }),
    placeName: (p) => p.TALUK,
    placeDistrict: (p) => p.DISTRICT,
  },
  panchayat: {
    label: 'Local bodies',
    url: 'data/boundaries/panchayat.geojson',
    color: '#f0883e',
    weight: 1,
    fillOpacity: 0.05,
    nameField: (p) => `${p.name} (${p.District} district)`,
    describe: (p) => ({
      name: p.name,
      nameMl: p.name_ml,
      kind: LOCAL_BODY_KINDS[p.local_auth] || 'Local body',
      district: p.District,
      block: p.local_auth === 'gram_panchayat' ? p.BlockName : null,
      wikidata: p.wikidata,
    }),
    placeName: (p) => p.name,
    placeDistrict: (p) => p.District,
  },
  ward: {
    label: 'Ward (coming soon)',
    disabled: true,
  },
};

const DEFAULT_LEVEL = 'district';

// Leaflet layers already fetched, kept around so switching back to a level
// you've already viewed doesn't re-download it.
const loadedLayers = {};
const levelDownloads = {}; // level -> in-flight buildLevelLayer() promise
let activeLayer = null;
let activeLevel = null;
let basemapLayer = null;

// The most recently requested level. A fetch that finishes after the user
// has already switched to another level must not add itself to the map.
let requestedLevel = null;

// The shape picked by clicking, search, a deep link or "Find My Location".
// place-panel.js listens for the map's "placeselect"/"placeclear" events
// rather than reading this directly.
let selected = null; // { level, shape }

function styleFor(config) {
  return {
    color: config.color,
    weight: config.weight,
    fillColor: config.color,
    fillOpacity: config.fillOpacity,
    opacity: 0.85,
  };
}

function hoverStyleFor(config) {
  return { weight: config.weight + 1.5, fillOpacity: config.fillOpacity + 0.14, opacity: 1 };
}

function selectedStyleFor(config) {
  return { weight: config.weight + 2.5, fillOpacity: config.fillOpacity + 0.2, opacity: 1 };
}

// --- Loading indicator and message strip (the two pills over the map) ---

const pendingLoads = new Map(); // label -> number of things still loading

function renderLoading() {
  const el = document.getElementById('map-loading');
  const labels = [...pendingLoads.keys()];
  el.hidden = labels.length === 0;
  el.querySelector('.map-loading__label').textContent = labels.length ? `Loading ${labels.join(', ')}…` : '';
}

function startLoading(label) {
  pendingLoads.set(label, (pendingLoads.get(label) || 0) + 1);
  renderLoading();
}

function finishLoading(label) {
  const left = (pendingLoads.get(label) || 1) - 1;
  if (left > 0) pendingLoads.set(label, left);
  else pendingLoads.delete(label);
  renderLoading();
}

// Shows the loading pill while a tile layer (e.g. a PMTiles hazard layer)
// is fetching tiles. Leaflet grid layers fire "loading" when they start
// and "load" once every visible tile has arrived.
function watchLayerLoading(layer, label) {
  let busy = false;
  layer.on('loading', () => {
    if (!busy) startLoading(label);
    busy = true;
  });
  const done = () => {
    if (busy) finishLoading(label);
    busy = false;
  };
  layer.on('load', done);
  layer.on('remove', done);
}

let messageTimer = null;

// One short message at a time, at the bottom of the map. action is an
// optional { label, run } shown as a button. Messages without an action
// fade on their own after a few seconds.
function showMapMessage(text, action = null) {
  const el = document.getElementById('map-message');
  const textEl = el.querySelector('.map-message__text');
  const button = el.querySelector('.map-message__action');

  clearTimeout(messageTimer);
  textEl.textContent = text;
  button.hidden = !action;
  button.onclick = action ? () => { hideMapMessage(); action.run(); } : null;
  if (action) button.textContent = action.label;
  el.hidden = false;

  if (!action) messageTimer = setTimeout(hideMapMessage, 5000);
}

function hideMapMessage() {
  clearTimeout(messageTimer);
  document.getElementById('map-message').hidden = true;
}

// --- Selecting places ---

function clearSelection(map) {
  if (!selected) return;
  const config = BOUNDARY_LAYERS[selected.level];
  selected.shape.setStyle(styleFor(config));
  selected = null;
  map.fire('placeclear');
}

function selectShape(map, level, shape, { fit = true } = {}) {
  clearSelection(map);

  const config = BOUNDARY_LAYERS[level];
  selected = { level, shape };
  shape.setStyle(selectedStyleFor(config));
  shape.bringToFront();
  if (fit) map.fitBounds(shape.getBounds(), { padding: [32, 32], maxZoom: 13 });

  const p = shape.feature.properties;
  map.fire('placeselect', {
    level,
    shape,
    index: shape.feature.index,
    info: config.describe(p),
    name: config.placeName ? config.placeName(p) : null,
    district: config.placeDistrict ? config.placeDistrict(p) : null,
  });
}

function findPlace(layer, config, name, district) {
  const wanted = name.toLowerCase();
  let match = null;

  layer.eachLayer((shape) => {
    if (match) return;
    const p = shape.feature.properties;
    if ((config.placeName(p) || '').toLowerCase() !== wanted) return;
    if (district && config.placeDistrict(p) !== district) return;
    match = shape;
  });

  return match;
}

// Even-odd ray casting over every ring, so holes are handled for free.
function pointInRings(lng, lat, rings) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
  }
  return inside;
}

// The shape in the currently shown boundary level that contains latlng,
// if any - used by "Find My Location" to say which place you're in.
function findPlaceAt(latlng) {
  if (!activeLayer) return null;
  let match = null;

  activeLayer.eachLayer((shape) => {
    if (match || !shape.getBounds().contains(latlng)) return;
    const g = shape.feature.geometry;
    const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    if (polygons.some((rings) => pointInRings(latlng.lng, latlng.lat, rings))) match = shape;
  });

  return match;
}

// --- Boundary levels ---

// Shows one boundary level and resolves to its Leaflet layer (or null if
// the level is disabled/unknown).
async function showLevel(map, level) {
  const config = BOUNDARY_LAYERS[level];
  if (!config || config.disabled) return null;

  requestedLevel = level;
  if (selected && selected.level !== level) clearSelection(map);

  if (activeLayer) {
    map.removeLayer(activeLayer);
    activeLayer = null;
    activeLevel = null;
  }

  // Two callers asking for the same level at once (e.g. the initial load
  // and a deep link's place lookup) share one download.
  if (!loadedLayers[level]) {
    if (!levelDownloads[level]) levelDownloads[level] = buildLevelLayer(map, level, config);
    await levelDownloads[level];
  }

  const layer = loadedLayers[level];
  if (requestedLevel !== level) return layer;

  activeLayer = layer.addTo(map);
  activeLevel = level;
  return activeLayer;
}

async function buildLevelLayer(map, level, config) {
  startLoading(config.label.toLowerCase());
  let data;
  try {
    const response = await fetch(config.url);
    data = await response.json();
  } finally {
    finishLoading(config.label.toLowerCase());
    delete levelDownloads[level];
  }

  // Each feature's position in its file - the key into per-feature data
  // generated alongside the boundaries, like landslide-coverage.json.
  data.features.forEach((feature, i) => { feature.index = i; });

  loadedLayers[level] = L.geoJSON(data, {
    style: () => styleFor(config),
    onEachFeature: (feature, shape) => {
      const name = config.nameField(feature.properties) || 'Unnamed';
      shape.bindTooltip(name, { sticky: true, direction: 'top', offset: [0, -10], className: 'place-tip' });
      shape.on('mouseover', () => {
        if (!selected || selected.shape !== shape) shape.setStyle(hoverStyleFor(config));
      });
      shape.on('mouseout', () => {
        if (!selected || selected.shape !== shape) shape.setStyle(styleFor(config));
      });
      // Stop the click reaching the map, which clears the selection when
      // you click empty space (see place-panel.js).
      shape.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        selectShape(map, level, shape, { fit: false });
      });
    },
  });
}

function setBasemap(map, key) {
  const config = BASEMAPS[key] || BASEMAPS[DEFAULT_BASEMAP];
  if (basemapLayer) map.removeLayer(basemapLayer);
  basemapLayer = L.tileLayer(config.url, config.options).addTo(map);
  basemapLayer.bringToBack();
}

// A small "back to all of Kerala" button under the zoom controls.
const HomeControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd(map) {
    const container = L.DomUtil.create('div', 'leaflet-bar map-button-bar');
    const button = L.DomUtil.create('button', 'map-button', container);
    button.type = 'button';
    button.title = 'Show all of Kerala';
    button.setAttribute('aria-label', 'Show all of Kerala');
    button.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5M6.5 10v9h11v-9" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, 'click', () => map.setView(KERALA_CENTER, KERALA_ZOOM));
    return container;
  },
});

function initMap(initialLevel = DEFAULT_LEVEL) {
  const map = L.map('map', { zoomControl: false }).setView(KERALA_CENTER, KERALA_ZOOM);

  L.control.zoom({ position: 'topright' }).addTo(map);
  new HomeControl().addTo(map);
  L.control.scale({ position: 'bottomright', imperial: false }).addTo(map);

  setBasemap(map, DEFAULT_BASEMAP);
  showLevel(map, initialLevel);

  return map;
}
