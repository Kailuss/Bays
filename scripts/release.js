// @lovervoid/kit scripts/release.js: synced by `lovervoid sync`. Edit it in the kit, not here.
// @ts-check
'use strict';

/**
 * The flags `vsce` needs that nothing else checks, DERIVED instead of
 * remembered, from the manifest that is about to ship.
 *
 *   - The CHANNEL is the expensive one. An odd minor ships pre-release and an
 *     even one ships stable, the marketplace deduces neither, and the only thing
 *     that says which is `--pre-release`. Forgotten on an odd minor, that version
 *     goes out as the latest STABLE build to everybody and updates on its own,
 *     and a version cannot be unpublished: the only way out is publishing
 *     another on top of it. Silent, in the very last step, and the one mistake
 *     here with no way back.
 *   - The missing `repository` field is the loud one: `vsce` stops and asks. A
 *     private repo leaves the field out on purpose (every link it derived would
 *     be a 404 on the published page), so there the answer is always yes and
 *     `--allow-missing-repository` is passed. A repo that DECLARES the field
 *     gets no flag: silencing a question nobody is being asked is what would
 *     hide the day the field goes away.
 *
 * What it does NOT do, because it cannot: tell whether this version has already
 * been published. That answer lives on the marketplace, and `vsce publish` is
 * what refuses it. `check-release` covers the other half, that the version in
 * the manifest has an entry of its own in the changelog, dated and written.
 */

const { spawnSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const MODES = ['package', 'publish'];
const DERIVED = ['--pre-release', '--allow-missing-repository'];

const mode = process.argv[2];
if (!MODES.includes(mode)) {
  fail(`usage: node scripts/release.js <${MODES.join('|')}>`);
}

const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
const version = String(manifest.version ?? '');

// Strict, because everything below is read off it: a version this cannot parse
// is one whose channel would be guessed.
const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
if (!parts) {
  fail(`the manifest's version is not x.y.z: ${version || '(missing)'}`);
}

const minor = Number(parts[2]);
const preRelease = minor % 2 === 1;
const channel = preRelease ? 'PRE-RELEASE' : 'STABLE';
const missingRepository = manifest.repository === undefined;

// Anything else is handed to `vsce` untouched: an `--out`, a `--packagePath`.
// The DERIVED ones are refused rather than passed on: typing one back is exactly
// the remembering this exists to remove, and typed wrong it is the one mistake
// here that cannot be taken back.
const extra = process.argv.slice(3);
const typed = extra.find(arg => DERIVED.includes(arg));
if (typed) {
  fail(`${typed} is derived from the manifest and must not be passed`);
}

const args = [
  mode,
  ...(missingRepository ? ['--allow-missing-repository'] : []),
  ...(preRelease ? ['--pre-release'] : []),
  ...extra,
];

// Said out loud before anything runs, and naming the fact it was derived FROM:
// the one number that decides the channel is the minor, and a line that prints
// both can be read as wrong before the run rather than after it.
console.log(`[release] ${version}: minor ${minor} is ${preRelease ? 'odd' : 'even'}, so ${channel}`);
console.log(`[release] vsce ${args.join(' ')}`);

// `vsce` is not a dependency of the extension and does not need to be: it runs
// from wherever it is installed. Through a shell on Windows because what is on
// PATH there is `vsce.cmd`, and no argument composed above carries a space.
const run = spawnSync('vsce', args, { stdio: 'inherit', shell: process.platform === 'win32' });

if (run.error && /** @type {NodeJS.ErrnoException} */ (run.error).code === 'ENOENT') {
  fail('vsce was not found on PATH: install it with `npm i -g @vscode/vsce`');
}
if (run.error) { fail(String(run.error.message)); }

process.exit(run.status ?? 1);

/** @param {string} message */
function fail(message) {
  console.error(`[release] ${message}`);
  process.exit(1);
}
