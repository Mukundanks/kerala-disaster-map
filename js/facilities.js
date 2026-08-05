// Loads school and hospital markers onto the map. Real data hasn't been
// provided yet (see data/facilities/README.md) - the files fetched here are
// empty placeholders, so this currently loads and renders nothing. Once
// real data lands in those files, markers will start appearing with no
// code changes needed.

const SCHOOL_ICON = L.divIcon({
  className: 'facility-icon facility-icon--school',
  html: '📗',
  iconSize: [26, 26],
});

const HOSPITAL_ICON = L.divIcon({
  className: 'facility-icon facility-icon--hospital',
  html: '',
  iconSize: [22, 22],
});

const FACILITY_TYPES = {
  school: { url: 'data/facilities/schools.geojson', icon: SCHOOL_ICON },
  hospital: { url: 'data/facilities/hospitals.geojson', icon: HOSPITAL_ICON },
};

async function loadFacilities(map) {
  for (const config of Object.values(FACILITY_TYPES)) {
    const response = await fetch(config.url);
    const data = await response.json();

    L.geoJSON(data, {
      pointToLayer: (feature, latlng) => L.marker(latlng, { icon: config.icon }),
      onEachFeature: (feature, layer) => {
        const name = feature.properties && feature.properties.name;
        if (name) layer.bindPopup(name);
      },
    }).addTo(map);
  }
}
