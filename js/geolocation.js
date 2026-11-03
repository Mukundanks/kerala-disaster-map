// "Find My Location": uses the browser's Geolocation API to drop a marker
// (with an accuracy circle) at the user's current position, pan the map
// there, and - if the point falls inside a shape in the boundary level
// currently shown - select that place, so you see which district/taluk/
// local body you're in. The button is a map control under the zoom
// buttons; status and errors go to the message strip over the map.

const LocateControl = L.Control.extend({
  options: { position: 'topright' },
  onAdd() {
    const container = L.DomUtil.create('div', 'leaflet-bar map-button-bar');
    const button = L.DomUtil.create('button', 'map-button', container);
    button.type = 'button';
    button.id = 'locate-me';
    button.title = 'Find my location';
    button.setAttribute('aria-label', 'Find my location');
    button.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    L.DomEvent.disableClickPropagation(container);
    return container;
  },
});

function setupGeolocation(map) {
  new LocateControl().addTo(map);

  const button = document.getElementById('locate-me');
  let marker = null;
  let accuracy = null;

  button.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      showMapMessage('Your browser doesn’t support finding your location.');
      return;
    }

    button.classList.add('is-busy');
    showMapMessage('Finding your location…');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        button.classList.remove('is-busy');
        const { latitude, longitude } = position.coords;
        const latlng = L.latLng(latitude, longitude);

        if (marker) map.removeLayer(marker);
        if (accuracy) map.removeLayer(accuracy);
        accuracy = L.circle(latlng, {
          radius: position.coords.accuracy,
          className: 'locate-accuracy',
          interactive: false,
        }).addTo(map);
        marker = L.circleMarker(latlng, {
          radius: 8,
          className: 'locate-dot',
          interactive: false,
        }).addTo(map);

        const place = findPlaceAt(latlng);
        if (place) {
          selectShape(map, activeLevel, place, { fit: false });
          const name = BOUNDARY_LAYERS[activeLevel].nameField(place.feature.properties);
          showMapMessage(`You’re in ${name}.`);
        } else {
          hideMapMessage();
        }
        map.setView(latlng, 13);
      },
      (error) => {
        button.classList.remove('is-busy');
        showMapMessage(`Couldn’t get your location: ${error.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
