import { test } from 'node:test';
import assert from 'node:assert/strict';
import { singleFlight } from '../utils/singleFlight';

// Building the icon map reads and parses the theme JSON, and the first render
// asks for it once per icon that missed the cache — all before the first build
// has landed. These cases pin that concurrent asks share one build.

test('singleFlight: concurrent calls share one run', async () => {
  let runs = 0;
  const build = singleFlight(async () => { runs++; await new Promise(r => setTimeout(r, 5)); });
  await Promise.all([build.run(), build.run(), build.run()]);
  assert.equal(runs, 1);
});

test('singleFlight: a call after the run settled starts a new one', async () => {
  let runs = 0;
  const build = singleFlight(async () => { runs++; });
  await build.run();
  await build.run();
  assert.equal(runs, 2);
});

test('singleFlight: a forced call does not join the run in flight', async () => {
  // A theme change mid-build: the build in flight reads the OLD theme.
  let runs = 0;
  const build = singleFlight(async () => { runs++; await new Promise(r => setTimeout(r, 5)); });
  await Promise.all([build.run(), build.run({ force: true })]);
  assert.equal(runs, 2);
});

test('singleFlight: a failed run does not stick', async () => {
  let runs = 0;
  const build = singleFlight(async () => { runs++; if (runs === 1) { throw new Error('boom'); } });
  await assert.rejects(build.run());
  await build.run();
  assert.equal(runs, 2);
});

test('singleFlight: isCurrent tells a superseded run apart', async () => {
  // The run that was overtaken must not write its result over the newer one.
  const seen: boolean[] = [];
  const build = singleFlight(async (isCurrent) => {
    await new Promise(r => setTimeout(r, 5));
    seen.push(isCurrent());
  });
  await Promise.all([build.run(), build.run({ force: true })]);
  assert.deepEqual(seen, [false, true]);
});
