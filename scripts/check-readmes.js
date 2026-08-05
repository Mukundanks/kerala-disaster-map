#!/usr/bin/env node
//
// Fails (exit code 1) if any folder's tracked files changed without that
// folder's README.md also being part of the change. Loose files at the
// project root must be reflected in the root README.md.
//
// Usage:
//   node scripts/check-readmes.js --staged              (local pre-commit: staged files vs HEAD)
//   node scripts/check-readmes.js --range BASE...HEAD    (CI: compare two refs)

const { execSync } = require('child_process');
const path = require('path');

// Folders that manage their own tooling/config and are exempt from this
// check (see their own README.md for why).
const EXEMPT_FOLDERS = ['.github'];

function getChangedFiles() {
  const args = process.argv.slice(2);
  let cmd;

  if (args.includes('--staged')) {
    cmd = 'git diff --cached --name-only --diff-filter=ACMR';
  } else {
    const rangeIndex = args.indexOf('--range');
    if (rangeIndex === -1 || !args[rangeIndex + 1]) {
      console.error('Usage: node check-readmes.js --staged | --range BASE...HEAD');
      process.exit(2);
    }
    cmd = `git diff --name-only --diff-filter=ACMR ${args[rangeIndex + 1]}`;
  }

  return execSync(cmd, { encoding: 'utf8' })
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);
}

function main() {
  const changed = getChangedFiles();

  if (changed.length === 0) {
    console.log('No changed files to check.');
    return;
  }

  const byFolder = new Map(); // top-level folder -> Set of changed files within it
  const rootFiles = [];

  for (const file of changed) {
    const dir = path.dirname(file).split(path.sep).join('/');

    if (dir === '.') {
      rootFiles.push(file);
      continue;
    }

    const topFolder = dir.split('/')[0];
    if (EXEMPT_FOLDERS.includes(topFolder)) continue;

    if (!byFolder.has(topFolder)) byFolder.set(topFolder, new Set());
    byFolder.get(topFolder).add(file);
  }

  const problems = [];

  for (const [folder, files] of byFolder) {
    const readme = `${folder}/README.md`;
    if (!files.has(readme)) {
      problems.push(`- "${folder}/" changed but its README.md was not updated.`);
    }
  }

  if (rootFiles.length > 0 && !rootFiles.includes('README.md')) {
    problems.push('- Root-level files changed but the root README.md was not updated.');
  }

  if (problems.length > 0) {
    console.error('\nREADME check failed:\n');
    console.error(problems.join('\n'));
    console.error(
      '\nEvery folder (and the project root) must keep its README.md in sync with ' +
        'what it contains. Update the relevant README.md, in plain, easy-to-read ' +
        'English, then try again.\n'
    );
    process.exit(1);
  }

  console.log('README check passed: all changed folders have their README.md updated.');
}

main();
