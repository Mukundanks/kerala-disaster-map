#!/usr/bin/env node
//
// One-time setup: installs a git pre-commit hook that runs check-readmes.js
// before every local commit, so you find out about a missing README update
// before you even push. Run once after cloning:
//
//   node scripts/install-git-hooks.js

const fs = require('fs');
const path = require('path');

const hookPath = path.join(__dirname, '..', '.git', 'hooks', 'pre-commit');
const hookContent = `#!/bin/sh
node scripts/check-readmes.js --staged
`;

if (!fs.existsSync(path.dirname(hookPath))) {
  console.error('No .git/hooks directory found — is this a git repository?');
  process.exit(1);
}

fs.writeFileSync(hookPath, hookContent, { mode: 0o755 });
console.log('Installed pre-commit hook at .git/hooks/pre-commit');
