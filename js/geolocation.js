// "Find My Location" button: uses the browser's Geolocation API to drop a
// marker at the user's current position and pan the map there.

function setupGeolocation(map) {
  const button = document.getElementById('locate-me');
  const status = document.getElementById('locate-status');
  let marker = null;

  button.addEventListener('click', () => {
    if (!('geolocation' in navigator)) {
      status.textContent = 'Geolocation is not supported by this browser.';
      return;
    }

    status.textContent = 'Locating...';

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;

        if (marker) map.removeLayer(marker);
        marker = L.marker([latitude, longitude]).addTo(map).bindPopup('You are here').openPopup();

        map.setView([latitude, longitude], 13);
        status.textContent = '';
      },
      (error) => {
        status.textContent = 'Could not get your location: ' + error.message;
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}
