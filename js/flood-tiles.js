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
//
// The constants and the floodPmtilesUrl()/floodPaintRules()/floodOdds()
// helpers are also used by the landing page's flood demo (landing.js);
// setupFloodToggle() is only called on the map page.

const FLOOD_RETURN_PERIODS = [10, 25, 50, 100, 200];
const FLOOD_COLOR = '#2980b9';

// data/pmtiles/flood_*yr.pmtiles only has tiles up to zoom 13 (see
// MAX_ZOOM in scripts/convert_floods_to_pmtiles.py) - without
// maxDataZoom, protomaps-leaflet stops rendering entirely past that
// zoom instead of reusing/scaling up the deepest tile it has. Named
// separately from landslide-tiles.js's MAX_DATA_ZOOM to avoid a global
// naming collision (these files share one global scope, no modules).
const FLOOD_MAX_DATA_ZOOM = 13;

// How long the play button stays on each return period.
const FLOOD_PLAY_STEP_MS = 1400;

// The span over which floodOdds() reports "at least once" odds - roughly
// how long a family might live in one house.
const FLOOD_YEARS_IN_HOME = 30;

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

function formatPercent(fraction) {
  const pct = fraction * 100;
  return `${pct < 1 ? pct.toFixed(1) : Math.round(pct)}%`;
}

// A 1-in-N-year flood has a 1/N chance in any one year, and a
// 1 - (1 - 1/N)^years chance of happening at least once over that span.
function floodOdds(year) {
  const perYear = 1 / year;
  const overYears = 1 - Math.pow(1 - perYear, FLOOD_YEARS_IN_HOME);
  return {
    perYear,
    overYears,
    perYearText: formatPercent(perYear),
    overYearsText: formatPercent(overYears),
  };
}

function setupFloodToggle(map) {
  const checkbox = document.getElementById('toggle-flood-risk');
  const slider = document.getElementById('flood-year-slider');
  const label = document.getElementById('flood-year-label');
  const odds = document.getElementById('flood-odds');
  const opacity = document.getElementById('flood-opacity');
  const play = document.getElementById('flood-play');

  // One layer per return period, created lazily and kept around so
  // dragging back to a value you've already visited doesn't re-fetch it.
  const layersByYear = {};
  let activeLayer = null;
  let playTimer = null;

  function currentYear() {
    return FLOOD_RETURN_PERIODS[Number(slider.value)];
  }

  function updateLabel() {
    const year = currentYear();
    const { perYearText, overYearsText } = floodOdds(year);
    label.textContent = `1-in-${year} Year Flood Zone`;
    odds.textContent = `${perYearText} chance in any year · ${overYearsText} over ${FLOOD_YEARS_IN_HOME} years`;
    slider.setAttribute('aria-valuetext', `1-in-${year}-year flood`);
  }

  function showYear(year) {
    if (activeLayer) map.removeLayer(activeLayer);

    if (!layersByYear[year]) {
      layersByYear[year] = protomapsL.leafletLayer({
        url: floodPmtilesUrl(year),
        paintRules: floodPaintRules(),
        maxDataZoom: FLOOD_MAX_DATA_ZOOM,
      });
      watchLayerLoading(layersByYear[year], 'flood zones');
    }
    activeLayer = layersByYear[year];
    activeLayer.setOpacity(Number(opacity.value) / 100);
    activeLayer.addTo(map);
  }

  function stopPlaying() {
    clearInterval(playTimer);
    playTimer = null;
    play.setAttribute('aria-pressed', 'false');
    play.setAttribute('aria-label', 'Play through return periods');
  }

  function step() {
    slider.value = (Number(slider.value) + 1) % FLOOD_RETURN_PERIODS.length;
    slider.dispatchEvent(new Event('input'));
  }

  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      showYear(currentYear());
    } else {
      stopPlaying();
      if (activeLayer) map.removeLayer(activeLayer);
    }
  });

  slider.addEventListener('input', () => {
    updateLabel();
    if (checkbox.checked) {
      showYear(currentYear());
    }
  });

  // Dragging the slider yourself takes over from the play button.
  slider.addEventListener('pointerdown', stopPlaying);

  opacity.addEventListener('input', () => {
    if (activeLayer) activeLayer.setOpacity(Number(opacity.value) / 100);
  });

  play.addEventListener('click', () => {
    if (playTimer) {
      stopPlaying();
      return;
    }
    if (!checkbox.checked) {
      checkbox.checked = true;
      checkbox.dispatchEvent(new Event('change'));
    }
    play.setAttribute('aria-pressed', 'true');
    play.setAttribute('aria-label', 'Pause');
    step();
    playTimer = setInterval(step, FLOOD_PLAY_STEP_MS);
  });

  updateLabel();
}
