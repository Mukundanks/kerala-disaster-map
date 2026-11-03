// Reads URL parameters so other pages (mainly the landing page, index.html)
// can link straight into a specific view of the map - and writes them back
// as you use the map, so the address bar is always a shareable link to
// what you're looking at. Everything is optional; unknown or invalid
// values are ignored.
//
//   level=district|taluk|panchayat|state  boundary level to show
//   name=...&district=...                 zoom to and select one shape at
//                                         that level (district narrows it
//                                         down when names repeat)
//   layers=flood,landslide                hazard layers to switch on
//   flood=10|25|50|100|200                flood return period to show
//   basemap=muted|standard|satellite      base map
//   locate=1                              run "Find My Location" on load
//                                         (read only - never written back)
//
// e.g. map.html?level=panchayat&name=Aluva&district=Ernakulam&layers=flood&flood=100
//
// Rather than touching layers directly, this sets the panel controls and
// fires their normal events, so the panel always matches what's on the
// map. Depends on map.js, sidebar.js, flood-tiles.js, landslide-tiles.js,
// geolocation.js and place-panel.js having been set up first.

function readDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const level = params.get('level');
  const layers = (params.get('layers') || '').split(',').map((s) => s.trim());

  return {
    level: BOUNDARY_LAYERS[level] && !BOUNDARY_LAYERS[level].disabled ? level : null,
    name: params.get('name'),
    district: params.get('district'),
    flood: layers.includes('flood'),
    floodYear: Number(params.get('flood')),
    landslide: layers.includes('landslide'),
    basemap: BASEMAPS[params.get('basemap')] ? params.get('basemap') : null,
    locate: params.get('locate') === '1',
  };
}

function turnOn(checkboxId) {
  const checkbox = document.getElementById(checkboxId);
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
}

function applyDeepLink(map, link) {
  if (link.level && link.name) {
    goToPlace(map, { level: link.level, name: link.name, district: link.district });
  }

  if (link.basemap) {
    const chip = document.querySelector(`input[name="basemap"][value="${link.basemap}"]`);
    chip.checked = true;
    chip.dispatchEvent(new Event('change', { bubbles: true }));
  }

  if (link.flood) {
    const index = FLOOD_RETURN_PERIODS.indexOf(link.floodYear);
    if (index !== -1) {
      const slider = document.getElementById('flood-year-slider');
      slider.value = index;
      slider.dispatchEvent(new Event('input'));
    }
    turnOn('toggle-flood-risk');
  }

  if (link.landslide) turnOn('toggle-landslide');

  if (link.locate) document.getElementById('locate-me').click();
}

// Keeps the address bar in step with the panel and the selected place.
// Uses replaceState, so it doesn't fill the back button with every click.
function setupUrlSync(map) {
  let place = null;

  const write = () => {
    const params = new URLSearchParams();
    const level = currentLevel();
    if (level !== DEFAULT_LEVEL || place) params.set('level', level);
    if (place && place.name) {
      params.set('name', place.name);
      if (level !== 'district' && place.district) params.set('district', place.district);
    }

    const layers = [];
    if (document.getElementById('toggle-flood-risk').checked) layers.push('flood');
    if (document.getElementById('toggle-landslide').checked) layers.push('landslide');
    if (layers.length) params.set('layers', layers.join(','));
    if (layers.includes('flood')) {
      params.set('flood', FLOOD_RETURN_PERIODS[Number(document.getElementById('flood-year-slider').value)]);
    }

    const basemap = document.querySelector('input[name="basemap"]:checked').value;
    if (basemap !== DEFAULT_BASEMAP) params.set('basemap', basemap);

    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
  };

  map.on('placeselect', (e) => {
    place = { name: e.name, district: e.district };
    write();
  });
  map.on('placeclear', () => {
    place = null;
    write();
  });

  const panel = document.getElementById('panel');
  panel.addEventListener('change', write);
  panel.addEventListener('input', write);
}
