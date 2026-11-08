import assert from 'node:assert/strict';
import { startMock } from '../src/mock.js';
import { inspectAnchor } from '../src/network.js';

for (const broken of [false, true]) {
  const mock = await startMock({ broken });
  try {
    const result = await inspectAnchor(mock.origin, { allowLocal: true });
    if (broken) assert.ok(result.summary.errors >= 3);
    else assert.equal(result.summary.errors, 0);
    assert.ok(mock.requests.every(r => r.method === 'GET'));
    console.log((broken ? 'Broken' : 'Valid') + ' LOCAL MOCK: ' + JSON.stringify(result.summary));
  } finally { await mock.close(); }
}
