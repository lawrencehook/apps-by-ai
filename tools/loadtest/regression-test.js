// Exercise the real CLI so a reported failure cannot silently exit successfully.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

for (const [fixture, expectedExit] of [['good', 0], ['bad', 1], ['rejection', 1]]) {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'run.js'),
    `../tools/loadtest/fixtures/${fixture}`], { encoding: 'utf8', timeout: 10000 });
  assert.ifError(result.error);
  assert.equal(result.status, expectedExit, `${fixture}: ${result.stdout}\n${result.stderr}`);
  if (fixture === 'rejection') {
    assert.match(result.stdout, /unhandled startup rejection/);
    assert.match(result.stdout, /0 with uncaught errors, 1 with unhandled rejections/);
  }
  console.log(`${fixture}: exit ${expectedExit} as expected`);
}
