# Contributing to Kerala Disaster Map

Thanks for wanting to help. This project is meant to stay easy for anyone to
pick up, so a couple of rules keep it that way.

## 1. Keep it plain HTML/CSS/JS

No frameworks, no build step, no bundler. Anyone should be able to clone the
repo and open `index.html` (or serve the folder) and have it just work.

This is about the *site*, not necessarily every tool that produces data
for it. `scripts/process_landslides.py` is Python because it needed
`geopandas` for shapefile/vector-tile processing — but its output is a
plain static file (`data/landslide.pmtiles`) that the site just fetches
like anything else. If a data-prep task genuinely needs a tool outside
plain JS, that's fine — just keep it confined to `scripts/`, document it
in `scripts/README.md`, and make sure its *output* is something the
static site can consume with no extra runtime dependency.

## 2. Every folder's README.md must stay in sync

Every folder in this repo has a `README.md` explaining, in plain English,
what's in it. If you add, remove, or meaningfully change a file in a folder,
update that folder's `README.md` in the same change. This is how someone
browsing the repo (or a future contributor) can understand what's going on
without opening every file.

The same applies to loose files at the project root — describe them in the
root `README.md`.

This isn't just a guideline — it's enforced automatically:

- **On every pull request**, a GitHub Actions check
  (`.github/workflows/readme-check.yml`) compares the changed files against
  the changed READMEs and fails the check if a folder's contents changed
  without its README.md changing too.
- **Locally**, you can install the same check as a pre-commit hook so you
  find out before you even push:

  ```sh
  node scripts/install-git-hooks.js
  ```

  After that, `git commit` will refuse to complete if you've changed files
  in a folder without touching its README.md.

If the check blocks you, it will tell you which folder's README needs an
update. Write the update the way you'd explain it to a person, not a commit
message — what's in the folder, what it's for, anything a newcomer would
want to know.

## 3. Data attribution

Content sourced from KSDMA (Kerala State Disaster Management Authority) is
public/open data, but keep a reference back to the original source when you
add it, so it's clear where it came from and can be verified or updated.

## 4. Sending changes

Fork the repo, make your change (with README updates included), and open a
pull request. The README check will run automatically.
