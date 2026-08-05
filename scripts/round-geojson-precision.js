#!/usr/bin/env node
//
// Rounds GeoJSON coordinates to a fixed number of decimal places and
// re-serializes without extra whitespace. Source boundary files are often
// exported with 13-15 decimal digits of "precision" that's far beyond GPS
// accuracy and just wastes bytes the browser has to download. 6 decimal
// places is about 11cm of precision, which is more than enough for a
// district/taluk/panchayat map.
//
// Usage:
//   node scripts/round-geojson-precision.js <input.geojson> <output.geojson> [decimals=6]

const fs = require('fs');

function roundCoords(coords, decimals) {
  if (typeof coords[0] === 'number') {
    return coords.map((n) => Number(n.toFixed(decimals)));
  }
  return coords.map((c) => roundCoords(c, decimals));
}

function main() {
  const [, , inputPath, outputPath, decimalsArg] = process.argv;
  if (!inputPath || !outputPath) {
    console.error('Usage: node round-geojson-precision.js <input.geojson> <output.geojson> [decimals=6]');
    process.exit(2);
  }
  const decimals = decimalsArg ? Number(decimalsArg) : 6;

  const geojson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  for (const feature of geojson.features) {
    feature.geometry.coordinates = roundCoords(feature.geometry.coordinates, decimals);
  }

  const before = fs.statSync(inputPath).size;
  fs.writeFileSync(outputPath, JSON.stringify(geojson));
  const after = fs.statSync(outputPath).size;

  console.log(
    `${inputPath} -> ${outputPath}: ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB`
  );
}

main();
