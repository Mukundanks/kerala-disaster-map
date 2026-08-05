// Kerala's center point and a zoom level that shows the whole state at once.
const KERALA_CENTER = [10.8505, 76.2711];
const KERALA_ZOOM = 7;

// Each entry is one administrative level the map can show. Only one level
// is displayed at a time - the layer switcher control lets you pick which.
// Colors are kept distinct per level so it's obvious which one you're
// looking at when you switch.
const BOUNDARY_LAYERS = {
  state: {
    label: 'State',
    url: 'data/boundaries/state.geojson',
    color: '#0b3d91',
    weight: 3,
    fillOpacity: 0.03,
    nameField: (p) => p.ST_NM,
  },
  district: {
    label: 'District',
    url: 'data/boundaries/district.geojson',
    color: '#1f6feb',
    weight: 2,
    fillOpacity: 0.08,
    nameField: (p) => p.dis_name,
  },
  taluk: {
    label: 'Taluk',
    url: 'data/boundaries/taluk.geojson',
    color: '#2ea043',
    weight: 1.5,
    fillOpacity: 0.08,
    nameField: (p) => `${p.TALUK} (${p.DISTRICT} district)`,
  },
  panchayat: {
    label: 'Panchayats',
    url: 'data/boundaries/panchayat.geojson',
    color: '#f0883e',
    weight: 1,
    fillOpacity: 0.12,
    nameField: (p) => `${p.name} (${p.District} district)`,
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
let activeLayer = null;

function styleFor(config) {
  return {
    color: config.color,
    weight: config.weight,
    fillColor: config.color,
    fillOpacity: config.fillOpacity,
    opacity: 0.9,
  };
}

async function showLevel(map, level) {
  const config = BOUNDARY_LAYERS[level];
  if (!config || config.disabled) return;

  if (activeLayer) {
    map.removeLayer(activeLayer);
    activeLayer = null;
  }

  if (loadedLayers[level]) {
    activeLayer = loadedLayers[level].addTo(map);
    return;
  }

  const response = await fetch(config.url);
  const data = await response.json();

  const layer = L.geoJSON(data, {
    style: () => styleFor(config),
    onEachFeature: (feature, leafletLayer) => {
      const name = config.nameField(feature.properties) || 'Unnamed';
      leafletLayer.bindPopup(name);
    },
  });

  loadedLayers[level] = layer;
  activeLayer = layer.addTo(map);
}

function initMap() {
  const map = L.map('map').setView(KERALA_CENTER, KERALA_ZOOM);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  showLevel(map, DEFAULT_LEVEL);

  return map;
}
