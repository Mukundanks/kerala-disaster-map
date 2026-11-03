// Landing page (index.html). Four independent pieces, each of which links
// into the map page through the URL parameters documented in deeplink.js:
//
//   1. setupDistrictMap() - the clickable SVG map of Kerala's 14 districts
//   2. setupSearch()      - "Check my area" search (place-search.js)
//   3. setupCounters()    - the stats under the hero that count up on view
//   4. setupFloodDemo()   - the return-period slider on a small Leaflet map
//
// Depends on place-search.js (setupPlaceSearch()) and flood-tiles.js
// (FLOOD_RETURN_PERIODS, floodPmtilesUrl(), floodPaintRules(),
// FLOOD_MAX_DATA_ZOOM, floodOdds()) being loaded first, so the search and
// the flood demo behave exactly the way they do on the map page.

const MAP_PAGE = 'map.html';
const SVG_NS = 'http://www.w3.org/2000/svg';

function mapLink(params) {
  return `${MAP_PAGE}?${new URLSearchParams(params)}`;
}

function placeLink(place) {
  const params = { level: place.level, name: place.name };
  if (place.level !== 'district') params.district = place.district;
  return mapLink(params);
}

// Runs fn once the element scrolls near the viewport (or right away in
// browsers without IntersectionObserver).
function whenVisible(element, fn, rootMargin = '0px') {
  if (!('IntersectionObserver' in window)) {
    fn();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      fn();
    }
  }, { rootMargin });
  observer.observe(element);
}

// --- 1. District map -------------------------------------------------------

// Set by setupDistrictMap() so the search can light up a result's district.
let highlightDistrict = () => {};

function polygonsOf(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

async function setupDistrictMap() {
  const svg = document.getElementById('kerala-svg');
  const tip = document.getElementById('kerala-tip');
  const caption = document.getElementById('kerala-caption');
  const figure = svg.parentElement;

  const response = await fetch('data/boundaries/district.geojson');
  const data = await response.json();

  // Simple equirectangular projection, with longitude squashed by
  // cos(latitude) so Kerala isn't stretched sideways. Plenty accurate for
  // a picture this size.
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const feature of data.features) {
    for (const polygon of polygonsOf(feature.geometry)) {
      for (const [lon, lat] of polygon[0]) {
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }

  const scale = 200;
  const lonFactor = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const project = ([lon, lat]) => [
    ((lon - minLon) * lonFactor * scale).toFixed(1),
    ((maxLat - lat) * scale).toFixed(1),
  ];

  const width = (maxLon - minLon) * lonFactor * scale;
  const height = (maxLat - minLat) * scale;
  svg.setAttribute('viewBox', `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`);

  // North to south, so the load-in animation sweeps down the coast.
  const features = data.features
    .map((feature) => {
      let north = -Infinity;
      for (const polygon of polygonsOf(feature.geometry)) {
        for (const [, lat] of polygon[0]) north = Math.max(north, lat);
      }
      return { feature, north };
    })
    .sort((a, b) => b.north - a.north)
    .map((d) => d.feature);

  const pathsByName = {};

  const showTip = (name, event) => {
    const box = figure.getBoundingClientRect();
    let x, y;
    if (event && 'clientX' in event) {
      x = event.clientX - box.left;
      y = event.clientY - box.top;
    } else {
      const shape = pathsByName[name].getBoundingClientRect();
      x = shape.left + shape.width / 2 - box.left;
      y = shape.top + shape.height / 2 - box.top;
    }
    tip.textContent = name;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
    tip.hidden = false;
  };

  const hideTip = () => {
    tip.hidden = true;
  };

  features.forEach((feature, i) => {
    const name = feature.properties.dis_name;
    const d = polygonsOf(feature.geometry)
      .map((polygon) => polygon.map((ring) => `M${ring.map(project).join('L')}Z`).join(''))
      .join('');

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'kerala__district');
    path.setAttribute('tabindex', '0');
    path.setAttribute('role', 'link');
    path.setAttribute('aria-label', `${name} district - open on the map`);
    path.style.setProperty('--i', i);

    const href = placeLink({ level: 'district', name });
    const go = () => { window.location.href = href; };

    path.addEventListener('pointerenter', (e) => {
      caption.textContent = `${name} - click to open on the map`;
      showTip(name, e);
    });
    path.addEventListener('pointermove', (e) => showTip(name, e));
    path.addEventListener('pointerleave', () => {
      caption.textContent = 'Hover or tap a district';
      hideTip();
    });
    path.addEventListener('focus', () => {
      caption.textContent = `${name} - press Enter to open on the map`;
      showTip(name);
    });
    path.addEventListener('blur', hideTip);
    path.addEventListener('click', go);
    path.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        go();
      }
    });

    pathsByName[name] = path;
    svg.appendChild(path);
  });

  highlightDistrict = (name) => {
    for (const [districtName, path] of Object.entries(pathsByName)) {
      path.classList.toggle('is-active', districtName === name);
    }
  };
}

// --- 2. Search -------------------------------------------------------------

// The search itself lives in place-search.js (shared with the map page);
// here, choosing a result opens it on the map page.
function setupSearch() {
  setupPlaceSearch({
    input: document.getElementById('place-search'),
    list: document.getElementById('search-results'),
    onSelect: (place) => { window.location.href = placeLink(place); },
    onActive: (place) => highlightDistrict(place ? place.district : null),
  });
}

// --- 3. Counters -----------------------------------------------------------

function setupCounters() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const counters = document.querySelectorAll('[data-count]');
  if (reduceMotion || counters.length === 0) return;

  const format = (n) => n.toLocaleString('en-IN');
  counters.forEach((el) => { el.textContent = '0'; });

  whenVisible(counters[0].closest('.stats'), () => {
    const start = performance.now();
    const duration = 1100;

    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      counters.forEach((el) => {
        el.textContent = format(Math.round(Number(el.dataset.count) * eased));
      });
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// --- 4. Flood return-period demo ------------------------------------------

// Around Aluva, on the Periyar - picked because the flooded area here
// grows noticeably (~57%) from the 10-year to the 200-year scenario, so
// dragging the slider shows a visible difference.
const FLOOD_DEMO_BOUNDS = [[10.05, 76.25], [10.2, 76.45]];
const FLOOD_DEMO_DISTRICT = 'Ernakulam';
function setupFloodDemo() {
  const slider = document.getElementById('flood-demo-slider');
  const title = document.getElementById('flood-demo-title');
  const oddsYear = document.getElementById('odds-year');
  const odds30 = document.getElementById('odds-30');
  const fill = document.getElementById('odds-fill');
  const link = document.getElementById('flood-demo-link');
  const mapElement = document.getElementById('flood-demo-map');

  // One layer per return period, all added up front and cross-faded with
  // setOpacity(), so dragging doesn't flash while new tiles load.
  const layersByYear = {};

  const update = () => {
    const year = FLOOD_RETURN_PERIODS[Number(slider.value)];
    const odds = floodOdds(year);

    title.textContent = `1-in-${year}-year flood`;
    oddsYear.textContent = odds.perYearText;
    odds30.textContent = odds.overYearsText;
    fill.style.width = `${odds.overYears * 100}%`;
    slider.setAttribute('aria-valuetext', `1-in-${year}-year flood`);
    link.href = mapLink({ level: 'district', name: FLOOD_DEMO_DISTRICT, layers: 'flood', flood: year });

    for (const [layerYear, layer] of Object.entries(layersByYear)) {
      layer.setOpacity(Number(layerYear) === year ? 1 : 0);
    }
  };

  slider.addEventListener('input', update);
  update();

  // Only start fetching map tiles once the section is close to on screen.
  whenVisible(mapElement, () => {
    if (typeof L === 'undefined' || typeof protomapsL === 'undefined') return;

    const map = L.map(mapElement, {
      scrollWheelZoom: false,
      zoomSnap: 0.25,
    }).fitBounds(FLOOD_DEMO_BOUNDS);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    for (const year of FLOOD_RETURN_PERIODS) {
      layersByYear[year] = protomapsL.leafletLayer({
        url: floodPmtilesUrl(year),
        paintRules: floodPaintRules(),
        maxDataZoom: FLOOD_MAX_DATA_ZOOM,
      }).addTo(map);
    }
    update();
  }, '200px');
}

document.addEventListener('DOMContentLoaded', () => {
  setupDistrictMap();
  setupSearch();
  setupCounters();
  setupFloodDemo();
});
