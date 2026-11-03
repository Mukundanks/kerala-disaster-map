// The place card that floats over the map when a shape is selected (by
// clicking it, picking a search result, a deep link, or "Find My
// Location"), plus the map page's search box. Listens for the map's
// "placeselect"/"placeclear" events fired by map.js. Depends on map.js,
// sidebar.js (chooseLevel()) and place-search.js being loaded first.

const PLACE_CARD_COPY_RESET_MS = 2000;

function setText(element, text) {
  element.textContent = text || '';
  element.hidden = !text;
}

// Selects a place by name - switching boundary level first if needed - and
// zooms to it. Used by the search box and deep links.
async function goToPlace(map, { level, name, district }) {
  const config = BOUNDARY_LAYERS[level];
  if (!config || !config.placeName) return;

  const layer = await chooseLevel(map, level);
  if (!layer) return;

  const shape = findPlace(layer, config, name, district);
  if (shape) {
    selectShape(map, level, shape);
  } else {
    showMapMessage(`Couldn’t find ${name} on the map.`);
  }
}

function setupPlaceCard(map) {
  const card = document.getElementById('place-card');
  const kind = document.getElementById('place-kind');
  const title = document.getElementById('place-name');
  const nameMl = document.getElementById('place-name-ml');
  const block = document.getElementById('place-block');
  const zoomButton = document.getElementById('place-zoom');
  const copyButton = document.getElementById('place-copy');
  const wikidata = document.getElementById('place-wikidata');
  const closeButton = document.getElementById('place-close');

  let current = null;

  map.on('placeselect', (e) => {
    current = e.shape;
    const { info } = e;

    setText(kind, [info.kind, info.district].filter(Boolean).join(' · '));
    title.textContent = info.name || 'Unnamed';
    setText(nameMl, info.nameMl);
    setText(block, info.block ? `in ${info.block}` : '');

    wikidata.hidden = !info.wikidata;
    if (info.wikidata) wikidata.href = `https://www.wikidata.org/wiki/${info.wikidata}`;

    copyButton.textContent = 'Copy link';
    card.hidden = false;
  });

  map.on('placeclear', () => {
    current = null;
    card.hidden = true;
  });

  // Clicking empty map (outside every shape) deselects. Shape clicks don't
  // reach here - map.js stops them.
  map.on('click', () => clearSelection(map));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current && !e.target.closest('input')) clearSelection(map);
  });

  closeButton.addEventListener('click', () => clearSelection(map));

  zoomButton.addEventListener('click', () => {
    if (current) map.fitBounds(current.getBounds(), { padding: [32, 32], maxZoom: 13 });
  });

  // The address bar always holds a link to this exact view (deeplink.js
  // keeps it updated), so sharing is just copying it.
  copyButton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyButton.textContent = 'Copied!';
    } catch (err) {
      showMapMessage('Couldn’t copy automatically - copy the link from the address bar.');
    }
    setTimeout(() => { copyButton.textContent = 'Copy link'; }, PLACE_CARD_COPY_RESET_MS);
  });
}

function setupMapSearch(map) {
  setupPlaceSearch({
    input: document.getElementById('place-search'),
    list: document.getElementById('search-results'),
    onSelect: (place) => goToPlace(map, place),
  });
}

function setupPlacePanel(map) {
  setupPlaceCard(map);
  setupMapSearch(map);
}
