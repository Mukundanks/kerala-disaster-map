// Wires up the sidebar controls (boundary layer dropdown, hazard checkbox
// toggles) to the map. Depends on showLevel() and BOUNDARY_LAYERS from
// map.js being loaded first.

// Hazard layers we don't have real data for yet. Each checkbox toggles an
// empty placeholder GeoJSON file on/off - the wiring works end to end, it's
// just waiting on real data to be dropped into these files.
//
// Landslide and Flood Risk aren't here - both have real data now, but
// it's too large/fragmented for plain GeoJSON, so they're handled
// separately as PMTiles vector tiles. See landslide-tiles.js and
// flood-tiles.js.
const HAZARD_LAYERS = {
  'toggle-vulnerable-schools': {
    url: 'data/hazards/vulnerable-schools.geojson',
    color: '#e3342f',
  },
};

function setupLayerDropdown(map) {
  const select = document.getElementById('layer-select');
  select.addEventListener('change', () => {
    showLevel(map, select.value);
  });
}

function setupHazardToggles(map) {
  Object.keys(HAZARD_LAYERS).forEach((checkboxId) => {
    const config = HAZARD_LAYERS[checkboxId];
    const checkbox = document.getElementById(checkboxId);
    let layer = null;

    checkbox.addEventListener('change', async () => {
      if (!checkbox.checked) {
        if (layer) map.removeLayer(layer);
        return;
      }

      if (!layer) {
        const response = await fetch(config.url);
        const data = await response.json();
        layer = L.geoJSON(data, {
          style: { color: config.color, weight: 2, fillOpacity: 0.15 },
        });
      }
      layer.addTo(map);
    });
  });
}

function setupSidebar(map) {
  setupLayerDropdown(map);
  setupHazardToggles(map);
}
