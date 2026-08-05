// Entry point loaded by index.html. Boots the app once the page is ready.
document.addEventListener('DOMContentLoaded', () => {
  const map = initMap();
  setupSidebar(map);
  setupGeolocation(map);
  loadFacilities(map);
  setupLandslideToggle(map);
  setupFloodToggle(map);
});
