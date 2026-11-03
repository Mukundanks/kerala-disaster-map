#!/usr/bin/env node
//
// Builds data/boundaries/places.json: a small, name-only search index of
// every district, taluk, and local body (panchayat/municipality/
// corporation), used by the "Check my area" search on the landing page.
//
// The landing page can't just fetch panchayat.geojson for this - it's
// ~4.4 MB of geometry, and the search only needs names. This keeps the
// index to a few dozen KB. Re-run it whenever the boundary files in
// data/boundaries/ change.
//
// Each entry is a compact array: [level, name, district, kind, name_ml]
//   level    - matches a BOUNDARY_LAYERS key in js/map.js
//              ("district" | "taluk" | "panchayat")
//   kind     - human-readable type shown in search results
//   name_ml  - Malayalam name, where the source data has one (else "")
//
// Usage: node scripts/build-place-index.js

const fs = require('fs');
const path = require('path');

const BOUNDARIES = path.join(__dirname, '..', 'data', 'boundaries');

const LOCAL_BODY_KINDS = {
  gram_panchayat: 'Grama Panchayat',
  municipality: 'Municipality',
  municipal_corporation: 'Corporation',
};

function readFeatures(file) {
  const raw = fs.readFileSync(path.join(BOUNDARIES, file), 'utf8');
  return JSON.parse(raw).features.map((f) => f.properties);
}

function main() {
  const places = [];

  for (const p of readFeatures('district.geojson')) {
    places.push(['district', p.dis_name, p.dis_name, 'District', '']);
  }

  for (const p of readFeatures('taluk.geojson')) {
    places.push(['taluk', p.TALUK, p.DISTRICT, 'Taluk', '']);
  }

  for (const p of readFeatures('panchayat.geojson')) {
    const kind = LOCAL_BODY_KINDS[p.local_auth] || 'Local body';
    places.push(['panchayat', p.name, p.District, kind, p.name_ml || '']);
  }

  const out = path.join(BOUNDARIES, 'places.json');
  fs.writeFileSync(out, JSON.stringify(places));
  console.log(`Wrote ${places.length} places to ${path.relative(process.cwd(), out)}`);
}

main();
