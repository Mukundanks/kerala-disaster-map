// "Find a place" search box, shared by the landing page (index.html) and
// the map page (map.html). Searches data/boundaries/places.json - built by
// scripts/build-place-index.js, each entry [level, name, district, kind,
// name_ml] - and leaves what happens on selection up to the page:
//
//   setupPlaceSearch({
//     input, list,               // the <input role="combobox"> and its <ul>
//     onSelect: (place) => {},   // a result was chosen (click or Enter)
//     onActive: (place) => {},   // keyboard/hover moved to a result (or null)
//   });
//
// A place is { level, name, district, kind, nameMl }, where level matches a
// BOUNDARY_LAYERS key in map.js ("district" | "taluk" | "panchayat").

const SEARCH_MAX_RESULTS = 8;
const SEARCH_LEVEL_ORDER = { district: 0, taluk: 1, panchayat: 2 };

let placesPromise = null;

// Fetched once, the first time it's needed - not on page load.
function loadPlaces() {
  if (!placesPromise) {
    placesPromise = fetch('data/boundaries/places.json')
      .then((r) => r.json())
      .then((rows) => rows.map(([level, name, district, kind, nameMl]) => ({
        level, name, district, kind, nameMl, key: name.toLowerCase(),
      })));
  }
  return placesPromise;
}

// Lower is better: exact match, then prefix, then start of any word, then
// anywhere in the name (English or Malayalam).
function matchScore(place, query) {
  if (place.key === query) return 0;
  if (place.key.startsWith(query)) return 1;
  if (place.key.includes(` ${query}`)) return 2;
  if (place.key.includes(query) || place.nameMl.includes(query)) return 3;
  return -1;
}

function searchPlaces(places, query) {
  return places
    .map((place) => ({ place, score: matchScore(place, query) }))
    .filter((r) => r.score !== -1)
    .sort((a, b) =>
      a.score - b.score ||
      SEARCH_LEVEL_ORDER[a.place.level] - SEARCH_LEVEL_ORDER[b.place.level] ||
      a.place.name.localeCompare(b.place.name))
    .slice(0, SEARCH_MAX_RESULTS)
    .map((r) => r.place);
}

// Builds "Kot<mark>tay</mark>am" as DOM nodes (no innerHTML, since names
// come from a data file).
function highlightedName(name, query) {
  const fragment = document.createDocumentFragment();
  const start = name.toLowerCase().indexOf(query);
  if (start === -1) {
    fragment.append(name);
    return fragment;
  }
  const mark = document.createElement('mark');
  mark.textContent = name.slice(start, start + query.length);
  fragment.append(name.slice(0, start), mark, name.slice(start + query.length));
  return fragment;
}

function setupPlaceSearch({ input, list, onSelect, onActive = () => {} }) {
  let results = [];
  let active = -1;

  const close = () => {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    onActive(null);
  };

  const choose = (place) => {
    close();
    input.blur();
    onSelect(place);
  };

  const setActive = (index) => {
    active = index;
    [...list.children].forEach((item, i) => {
      item.setAttribute('aria-selected', String(i === active));
    });
    if (active === -1) {
      input.removeAttribute('aria-activedescendant');
      onActive(null);
      return;
    }
    const item = list.children[active];
    input.setAttribute('aria-activedescendant', item.id);
    item.scrollIntoView({ block: 'nearest' });
    onActive(results[active]);
  };

  const render = (query) => {
    list.replaceChildren();

    if (results.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'search__empty';
      empty.textContent = `No district, taluk or local body matches "${query}".`;
      list.append(empty);
    }

    results.forEach((place, i) => {
      const item = document.createElement('li');
      item.className = 'search__result';
      item.id = `${list.id}-${i}`;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', 'false');

      const name = document.createElement('span');
      name.className = 'search__name';
      name.append(highlightedName(place.name, query));
      if (place.nameMl) {
        const ml = document.createElement('span');
        ml.className = 'search__ml';
        ml.lang = 'ml';
        ml.textContent = place.nameMl;
        name.append(ml);
      }

      const meta = document.createElement('span');
      meta.className = 'search__meta';
      meta.textContent = place.level === 'district' ? 'District' : `${place.kind} · ${place.district}`;

      item.append(name, meta);
      item.addEventListener('pointerenter', () => setActive(i));
      // mousedown rather than click, so it fires before the input's blur
      // closes the list.
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        choose(place);
      });
      list.append(item);
    });

    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    setActive(results.length ? 0 : -1);
  };

  const update = async () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) {
      results = [];
      close();
      return;
    }
    const places = await loadPlaces();
    if (input.value.trim().toLowerCase() !== query) return; // typed on meanwhile
    results = searchPlaces(places, query);
    render(query);
  };

  input.addEventListener('focus', () => {
    loadPlaces();
    if (input.value.trim().length >= 2) update();
  });
  input.addEventListener('input', update);
  input.addEventListener('blur', close);

  input.addEventListener('keydown', (e) => {
    if (list.hidden || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((active + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((active - 1 + results.length) % results.length);
    } else if (e.key === 'Enter' && active !== -1) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      close();
    }
  });
}
