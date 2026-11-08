import test from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl, validateDiscovery, validateInfo, validateTransaction } from '../src/index.js';
import { inspectAnchor } from '../src/network.js';
import { startMock } from '../src/mock.js';

const codes = findings => findings.map(f => f.code);
const transaction = { id: 'fixture-only', kind: 'deposit', status: 'completed', started_at: '2026-11-01T12:00:00Z', completed_at: '2026-11-01T12:01:00Z', more_info_url: 'https://anchor.example/tx/fixture', amount_in: '100.0000000', amount_out: '99.7', fee_details: { total: '0.3', asset: 'iso4217:USD', breakdown: [{ name: 'service', amount: '0.1' }, { name: 'rail', amount: '0.2' }] } };

test('real TOML syntax including comments and multiple currency tables is parsed', () => {
  const text = '# fixture\nTRANSFER_SERVER_SEP0024 = "https://anchor.example/sep24"\nWEB_AUTH_ENDPOINT = "https://anchor.example/auth"\n[[CURRENCIES]]\ncode="USD"\n[[CURRENCIES]]\ncode="EUR"\n';
  const r = validateDiscovery(text);
  assert.equal(r.document.CURRENCIES.length, 2);
  assert.deepEqual(r.findings, []);
});
test('malformed TOML and insecure discovery endpoints fail', () => {
  assert.ok(codes(validateDiscovery('bad = [').findings).includes('toml.parse'));
  assert.ok(codes(validateDiscovery('TRANSFER_SERVER_SEP0024="http://anchor.example"').findings).includes('discovery.endpoint'));
  assert.ok(codes(validateDiscovery('').findings).includes('discovery.transfer'));
});
test('credentialed and arbitrary HTTP URLs are rejected; local demo is explicit', () => {
  assert.throws(() => safeUrl('https://u:p@anchor.example'));
  assert.throws(() => safeUrl('http://localhost:4180'));
  assert.doesNotThrow(() => safeUrl('http://127.0.0.1:4180', { allowLocal: true }));
  assert.throws(() => safeUrl('http://remote.example', { allowLocal: true }));
});
test('SEP-45 discovery does not incorrectly require SEP-10 as well', () => {
  const r = validateDiscovery('TRANSFER_SERVER_SEP0024="https://anchor.example"\nWEB_AUTH_FOR_CONTRACTS_ENDPOINT="https://anchor.example/auth"');
  assert.equal(r.findings.length, 0);
});
test('info detects numeric coercion, impossible ranges and nonboolean features', () => {
  const r = validateInfo({ deposit: { USD: { enabled: 'true', min_amount: 10, max_amount: 2, fee_percent: '1' } }, withdraw: {}, features: { account_creation: 'yes' } });
  assert.ok(codes(r).includes('info.enabled'));
  assert.ok(codes(r).includes('info.range'));
  assert.ok(codes(r).includes('info.number'));
  assert.ok(codes(r).includes('info.boolean'));
});
test('optional fee information and disabled assets are not rejected', () => {
  const r = validateInfo({ deposit: { native: { enabled: true } }, withdraw: { USD: { enabled: false } } });
  assert.deepEqual(r, []);
});
test('fee breakdown is compared with exact decimal arithmetic', () => {
  assert.deepEqual(validateTransaction(transaction), []);
  const bad = structuredClone(transaction);
  bad.fee_details.total = '0.3000001';
  assert.ok(codes(validateTransaction(bad)).includes('transaction.fee-sum'));
});
test('currency conversion is not incorrectly treated as an arithmetic discrepancy', () => {
  assert.deepEqual(validateTransaction({ ...transaction, amount_out: '950', amount_in_asset: 'iso4217:USD', amount_out_asset: 'iso4217:NGN' }), []);
});
test('invalid amounts timestamps and withdrawal-only status are reported', () => {
  const r = validateTransaction({ ...transaction, status: 'pending_user_transfer_complete', amount_in: 100, completed_at: 'yesterday' });
  for (const code of ['transaction.withdrawal-only', 'transaction.amount', 'transaction.timestamp']) assert.ok(codes(r).includes(code));
  assert.ok(codes(validateTransaction({ ...transaction, completed_at: '2026-10-01T00:00:00Z' })).includes('transaction.time-order'));
  assert.ok(codes(validateTransaction({ ...transaction, started_at: '2026-02-30T00:00:00Z' })).includes('transaction.timestamp'));
});
test('null malformed nested fields and unsupported statuses yield findings', () => {
  assert.equal(validateInfo(null)[0].severity, 'error');
  assert.equal(validateTransaction(null)[0].severity, 'error');
  const r = validateTransaction({ ...transaction, status: 'magically_done', fee_details: { total: '1', asset: 'USD', breakdown: [{ name: 'bad', amount: -1 }] } });
  assert.ok(codes(r).includes('transaction.status'));
  assert.ok(codes(r).includes('transaction.fee-asset'));
  assert.ok(codes(r).includes('transaction.fee-breakdown'));
});
test('network inspection accepts valid mock, detects broken mock, and only performs GETs', async () => {
  for (const broken of [false, true]) {
    const mock = await startMock({ broken });
    try {
      const result = await inspectAnchor(mock.origin, { allowLocal: true });
      assert.equal(result.summary.errors, broken ? 3 : 0);
      assert.equal(result.requests.length, 2);
      assert.ok(mock.requests.every(r => r.method === 'GET'));
      assert.ok(mock.requests.every(r => r.origin === 'https://anchorcheck.example'));
    } finally { await mock.close(); }
  }
});
test('default network mode blocks loopback before sending any request', async () => {
  const mock = await startMock();
  try {
    assert.equal((await inspectAnchor(mock.origin)).summary.errors, 1);
    assert.equal(mock.requests.length, 0);
  } finally { await mock.close(); }
});
