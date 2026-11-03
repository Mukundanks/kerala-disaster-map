# css/

Stylesheets for the site.

## What's here

- **theme.css** — shared by both pages: the colour and font tokens as
  CSS custom properties on `:root`, with a dark palette under
  `prefers-color-scheme: dark`, plus `box-sizing`, a `[hidden]` rule (so
  elements the scripts hide stay hidden even when another rule sets
  `display`), and `.visually-hidden`. The flood and landslide colours
  match the ones the map actually draws. Fonts (Fraunces, Source Sans 3,
  Noto Sans Malayalam) come from Google Fonts, with system fallbacks.
- **search.css** — the place-search box and its results dropdown
  (`.search__*`), used by `js/place-search.js` on both pages.
- **style.css** — the map page (`map.html`): the top bar, the side panel
  (segmented level buttons, toggle switches, legends, opacity and
  return-period sliders, the play button, base map chips), the overlays
  on the map (loading pill, message strip, place card), Leaflet control
  and tooltip restyling, the location dot, and the `.facility-icon`
  marker styles for school/hospital pins. `.basemap--muted` tones down
  the default base map (and inverts it in dark mode). Below 720px wide the
  panel turns into a bottom sheet opened by the "Layers" button.
- **landing.css** — the landing page (`index.html`) only: top bar, hero,
  the clickable district SVG (`.kerala__*`), the flood return-period demo
  (`.flood__*`, `.odds__*`), the data-layer cards, and the footer.

All motion on both pages is switched off under `prefers-reduced-motion`.

## Notes for contributors

There's no build step — the CSS here is loaded directly by `map.html` /
`index.html` exactly as written, so no preprocessor syntax (Sass, etc.).

If you add a new CSS file or change what an existing one is responsible
for, update this README so it stays an accurate map of the folder.
