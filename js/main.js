// Entry point loaded by map.html. Boots the app once the page is ready.
document.addEventListener('DOMContentLoaded', () => {
  const link = readDeepLink();
  const level = link.level || DEFAULT_LEVEL;
  levelRadio(level).checked = true;

  const map = initMap(level);
  setupSidebar(map);
  setupGeolocation(map);
  loadFacilities(map);
  setupLandslideToggle(map);
  setupFloodToggle(map);
  setupPlacePanel(map);
  setupUrlSync(map);
  applyDeepLink(map, link);
});
