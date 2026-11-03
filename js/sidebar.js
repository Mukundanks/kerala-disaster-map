// Wires up the side panel's controls to the map: the boundary-level
// buttons, the base map chips, the Vulnerable Schools toggle, the
// "zoom in to see hazards" hint, and the show/hide button that turns the
// panel into a bottom sheet on phones. Depends on map.js being loaded
// first. (Landslide Zones and Flood Risk are wired up in their own files -
// see landslide-tiles.js and flood-tiles.js.)

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

// The PMTiles-backed layers, which only draw from HAZARD_MIN_ZOOM up.
const TILED_HAZARD_CHECKBOXES = ['toggle-landslide', 'toggle-flood-risk'];

function levelRadio(level) {
  return document.querySelector(`input[name="level"][value="${level}"]`);
}

function currentLevel() {
  const checked = document.querySelector('input[name="level"]:checked');
  return checked ? checked.value : DEFAULT_LEVEL;
}

// Switches the boundary level from code (search, deep links) the same way
// clicking its button would, and resolves to the shown layer.
function chooseLevel(map, level) {
  const radio = levelRadio(level);
  if (radio) radio.checked = true;
  return showLevel(map, level);
}

function setupLevelButtons(map) {
  document.querySelectorAll('input[name="level"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) showLevel(map, radio.value);
    });
  });
}

function setupBasemapChips(map) {
  document.querySelectorAll('input[name="basemap"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) setBasemap(map, radio.value);
    });
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

// Landslide and flood tiles start at zoom 8, and the map opens at zoom 7 -
// so without this, switching one on at the start shows nothing at all.
function setupHazardZoomHint(map) {
  let showing = false;

  const check = () => {
    const anyOn = TILED_HAZARD_CHECKBOXES.some((id) => document.getElementById(id).checked);
    const tooFar = map.getZoom() < HAZARD_MIN_ZOOM;

    if (anyOn && tooFar) {
      showing = true;
      showMapMessage('Hazard layers appear once you zoom in.', {
        label: 'Zoom in',
        run: () => map.setZoom(HAZARD_MIN_ZOOM),
      });
    } else if (showing) {
      showing = false;
      hideMapMessage();
    }
  };

  map.on('zoomend', check);
  // Looked up by id each time, since landslide-tiles.js can swap its
  // checkbox for a fresh copy when falling back between renderers.
  document.getElementById('panel').addEventListener('change', (e) => {
    if (TILED_HAZARD_CHECKBOXES.includes(e.target.id)) check();
  });
}

// On phones the panel is a bottom sheet over the map; this button opens
// and closes it. On wider screens the button is hidden and the panel is
// always shown beside the map.
function setupPanelToggle() {
  const button = document.getElementById('panel-toggle');
  const panel = document.getElementById('panel');

  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    panel.classList.toggle('is-open', open);
  });
}

function setupSidebar(map) {
  setupLevelButtons(map);
  setupBasemapChips(map);
  setupHazardToggles(map);
  setupHazardZoomHint(map);
  setupPanelToggle();
}
