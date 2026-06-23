#!/usr/bin/env node

const { spawnSync } = require('child_process');
const { resolve } = require('path');

// Resolve the path to the actual TypeScript server file
const serverFile = resolve(__dirname, '../server/index.ts');

// Forward all command line arguments transparently
const args = process.argv.slice(2);

// Spawn tsx to execute the server
const result = spawnSync('npx', ['tsx', serverFile, ...args], {
  stdio: 'inherit'
});

// Exit with the same status code as the server
process.exit(result.status ?? 0);
