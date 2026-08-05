# .github/

GitHub-specific automation.

## What's here

- **workflows/readme-check.yml** — runs on every pull request. It reuses
  `scripts/check-readmes.js` to compare the PR's changed files against the
  changed READMEs, and fails the check if a folder's contents changed
  without its `README.md` being updated too. This is what makes the
  README-sync rule (see `CONTRIBUTING.md`) apply to every contributor, not
  just people who installed the local git hook.

## Note

This folder is exempt from the README-sync check itself — GitHub already
gives workflow files their own dedicated, self-explanatory location and
UI, so forcing a README edit on every workflow tweak would just be noise.
We still keep this README for anyone browsing the repo.
