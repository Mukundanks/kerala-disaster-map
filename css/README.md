# css/

Stylesheets for the site.

## What's here

- **style.css** — all the styling for the page right now: the header bar,
  the `.app-layout` split between the sidebar and the map, the
  `.sidebar` panel itself (dropdown, checkboxes, the "Find My Location"
  button, status text), the `.sidebar__slider-group`/`.sidebar__slider`
  styles for the Flood Risk return-period slider, and the `.facility-icon`
  marker styles used for school/hospital pins. There's also a small
  mobile breakpoint that stacks the sidebar above the map on narrow
  screens. As the site grows, styles for new pieces should go here too,
  split into more files if it starts getting long.

## Notes for contributors

There's no build step — the CSS here is loaded directly by `index.html`
exactly as written, so no preprocessor syntax (Sass, etc.).

If you add a new CSS file or change what an existing one is responsible
for, update this README so it stays an accurate map of the folder.
