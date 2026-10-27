#!/usr/bin/env node
// One-time local credential entry; never pass a password in CLI arguments or environment variables.
const fs = require('node:fs');
const path = require('node:path');
const { request } = require('@playwright/test');

const username = process.argv[2] || 'wogmail';
const file = path.resolve(__dirname, '../tests/e2e/.auth/music-isolated.json');
const origin = 'https://www.atoman.org';
const api = 'https://api.atoman.org';

function promptSecret() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error('Run in your own interactive SSH terminal; password entry requires a TTY.');
  }
  return new Promise((resolve, reject) => {
    let chars = '';
    process.stdout.write(`Password for ${username} (hidden): `);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    const cleanup = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener('data', onData);
      process.stdout.write('\n');
    };
    function onData(data) {
      for (const ch of data) {
        if (ch === '\u0003') { cleanup(); reject(new Error('Canceled')); return; }
        if (ch === '\r' || ch === '\n') { cleanup(); resolve(chars); return; }
        if (ch === '\u007f' || ch === '\b') chars = chars.slice(0, -1);
        else if (ch >= ' ') chars += ch;
      }
    }
    process.stdin.on('data', onData);
  });
}

async function main() {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/create-music-test-auth.cjs [username]');
    console.log('Run interactively over SSH. Auth state remains on this server, mode 0600.');
    return;
  }
  if (fs.existsSync(file)) throw new Error('Auth state already exists. Refusing to overwrite; revoke/reset it intentionally first.');
  const password = await promptSecret();
  if (!password) throw new Error('Empty password');
  const ctx = await request.newContext({ baseURL: api });
  try {
    const result = await ctx.post('/api/v1/auth/login', {
      headers: { Origin: origin },
      data: { username, password },
      timeout: 20000,
    });
    if (!result.ok()) throw new Error(`Login failed (HTTP ${result.status()}).`);
    const login = await result.json();
    const identity = login.user || login.data?.user || {};
    if (identity.username !== username) throw new Error('Login identity does not match the dedicated test account.');
    if (identity.role !== 'user') throw new Error(`Refusing account role ${identity.role || 'unknown'}; ordinary test user required.`);
    const state = await ctx.storageState();
    if (!state.cookies.some(c => c.domain.includes('atoman.org'))) throw new Error('Login returned no site session cookie.');
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, JSON.stringify(state), { mode: 0o600, flag: 'wx' });
    fs.chmodSync(file, 0o600);
    console.log(`Dedicated music test session saved for ${username}. Cookie values are not displayed.`);
    console.log('Run E2E with E2E_SKIP_AUTH=1 MUSIC_WIKI_ISOLATED_ACCOUNT=1 MUSIC_WIKI_REAL_E2E=1 MUSIC_WIKI_AUTH_FILE=./tests/e2e/.auth/music-isolated.json');
  } finally {
    await ctx.dispose();
  }
}

main().catch(e => { console.error(e.message); process.exitCode = 1; });
