import TOML from '@iarna/toml';

export const SPEC = 'SEP-24 v3.8.0 (selected checks, not certification)';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const statuses = new Set(['incomplete', 'pending_user_transfer_start', 'pending_user_transfer_complete', 'pending_external', 'pending_anchor', 'on_hold', 'pending_stellar', 'pending_trust', 'pending_user', 'completed', 'refunded', 'expired', 'no_market', 'too_small', 'too_large', 'error']);
const decimal = value => typeof value === 'string' && /^(0|[1-9]\d*)(\.\d{1,7})?$/.test(value);
const units = value => {
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10000000n + BigInt(fraction.padEnd(7, '0'));
};
const utc = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 19) === value.slice(0, 19);

export function safeUrl(value, { allowLocal = false } = {}) {
  if (!nonempty(value)) throw new Error('Expected an absolute HTTPS URL');
  const url = new URL(value);
  if (url.username || url.password || url.hash) throw new Error('Credentials and fragments are not allowed in endpoint URLs');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowLocal && local && url.protocol === 'http:')) {
    throw new Error('HTTPS required; HTTP is allowed only for explicit loopback demos');
  }
  return url;
}

function reporter() {
  const findings = [];
  return { findings, add: (severity, code, path, message) => findings.push({ severity, code, path, message }) };
}

export function validateDiscovery(text, options = {}) {
  const { findings, add } = reporter();
  let document;
  try { document = TOML.parse(text); }
  catch { return { document: null, findings: [{ severity: 'error', code: 'toml.parse', path: '$', message: 'Invalid TOML document' }] }; }
  for (const field of ['TRANSFER_SERVER_SEP0024', 'WEB_AUTH_ENDPOINT', 'WEB_AUTH_FOR_CONTRACTS_ENDPOINT']) {
    if (document[field] === undefined) continue;
    try { safeUrl(document[field], options); }
    catch (error) { add('error', 'discovery.endpoint', field, error.message); }
  }
  if (!nonempty(document.TRANSFER_SERVER_SEP0024)) add('error', 'discovery.transfer', 'TRANSFER_SERVER_SEP0024', 'SEP-24 transfer endpoint is required');
  if (!document.WEB_AUTH_ENDPOINT && !document.WEB_AUTH_FOR_CONTRACTS_ENDPOINT) {
    add('warning', 'discovery.auth', '$', 'No SEP-10 or SEP-45 endpoint declared; authentication support needs review');
  }
  if (document.CURRENCIES !== undefined && !Array.isArray(document.CURRENCIES)) add('error', 'discovery.currencies', 'CURRENCIES', 'Expected an array of currency tables');
  return { document, findings };
}

export function validateInfo(info) {
  const { findings, add } = reporter();
  if (!object(info)) return [{ severity: 'error', code: 'info.object', path: '$', message: 'Expected a JSON object' }];
  let enabled = 0;
  for (const direction of ['deposit', 'withdraw']) {
    if (!object(info[direction])) {
      add('error', 'info.direction', direction, 'Expected an asset-code-to-settings object');
      continue;
    }
    for (const [code, settings] of Object.entries(info[direction])) {
      const path = direction + '.' + code;
      if (!code || !object(settings)) { add('error', 'info.asset', path, 'Expected asset settings'); continue; }
      if (typeof settings.enabled !== 'boolean') add('error', 'info.enabled', path + '.enabled', 'Expected boolean');
      if (settings.enabled === true) enabled++;
      for (const field of ['min_amount', 'max_amount', 'fee_fixed', 'fee_percent', 'fee_minimum']) {
        if (settings[field] !== undefined && (typeof settings[field] !== 'number' || !Number.isFinite(settings[field]) || settings[field] < 0)) {
          add('error', 'info.number', path + '.' + field, 'Expected a finite non-negative JSON number');
        }
      }
      if (typeof settings.min_amount === 'number' && typeof settings.max_amount === 'number' && settings.min_amount > settings.max_amount) add('error', 'info.range', path, 'min_amount exceeds max_amount');
      if ('authentication_required' in settings) add('warning', 'info.legacy-auth', path + '.authentication_required', 'Legacy flag: SEP-24 transaction endpoints require authentication regardless of this value');
    }
  }
  for (const field of ['fee', 'features']) {
    if (info[field] !== undefined && !object(info[field])) add('error', 'info.object', field, 'Expected an object');
  }
  if (object(info.fee)) {
    for (const field of ['enabled', 'authentication_required']) if (info.fee[field] !== undefined && typeof info.fee[field] !== 'boolean') add('error', 'info.boolean', 'fee.' + field, 'Expected boolean');
  }
  if (object(info.features)) {
    for (const field of ['account_creation', 'claimable_balances']) if (info.features[field] !== undefined && typeof info.features[field] !== 'boolean') add('error', 'info.boolean', 'features.' + field, 'Expected boolean');
  }
  if (!enabled) add('warning', 'info.no-enabled-assets', '$', 'No enabled deposit or withdrawal assets were found');
  return findings;
}

export function validateTransaction(transaction, options = {}) {
  const { findings, add } = reporter();
  if (!object(transaction)) return [{ severity: 'error', code: 'transaction.object', path: '$', message: 'Expected a transaction object' }];
  for (const field of ['id', 'kind', 'status']) if (!nonempty(transaction[field])) add('error', 'transaction.required', field, 'Required non-empty string');
  if (!['deposit', 'withdrawal'].includes(transaction.kind)) add('error', 'transaction.kind', 'kind', 'Expected deposit or withdrawal');
  if (!statuses.has(transaction.status)) add('error', 'transaction.status', 'status', 'Unknown SEP-24 status');
  if (transaction.kind === 'deposit' && transaction.status === 'pending_user_transfer_complete') add('error', 'transaction.withdrawal-only', 'status', 'This status is only used for withdrawals');
  for (const field of ['started_at', 'updated_at', 'completed_at', 'user_action_required_by']) {
    if (transaction[field] !== undefined && !utc(transaction[field])) add('error', 'transaction.timestamp', field, 'Expected a valid UTC ISO timestamp ending in Z');
  }
  if (transaction.started_at === undefined) add('error', 'transaction.required', 'started_at', 'Transaction start timestamp is required');
  if (utc(transaction.started_at) && utc(transaction.completed_at) && Date.parse(transaction.completed_at) < Date.parse(transaction.started_at)) add('error', 'transaction.time-order', 'completed_at', 'Completion precedes start');
  if (['completed', 'refunded'].includes(transaction.status) && !transaction.completed_at) add('warning', 'transaction.completion-time', 'completed_at', 'Terminal transaction has no completion timestamp');
  if (transaction.more_info_url === undefined) add('warning', 'transaction.more-info', 'more_info_url', 'No more_info_url: wallet follow-up flow needs review');
  else { try { safeUrl(transaction.more_info_url, options); } catch (error) { add('error', 'transaction.url', 'more_info_url', error.message); } }
  for (const field of ['amount_in', 'amount_out', 'amount_fee']) {
    if (transaction[field] !== undefined && !decimal(transaction[field])) add('error', 'transaction.amount', field, 'Expected a non-negative decimal string with at most seven places');
  }
  if (transaction.amount_in === undefined) add('warning', 'transaction.amount-missing', 'amount_in', 'No amount_in: verify whether this is appropriate for the current lifecycle stage');
  if (transaction.amount_fee !== undefined) add('warning', 'transaction.deprecated-fee', 'amount_fee', 'Deprecated field; prefer fee_details');
  if (transaction.fee_details !== undefined) {
    const fee = transaction.fee_details;
    if (!object(fee)) add('error', 'transaction.fee', 'fee_details', 'Expected an object');
    else {
      if (!decimal(fee.total)) add('error', 'transaction.fee-total', 'fee_details.total', 'Expected a non-negative decimal string');
      if (!nonempty(fee.asset) || !/^(stellar:|iso4217:)/.test(fee.asset)) add('error', 'transaction.fee-asset', 'fee_details.asset', 'Expected a SEP-38 asset identifier');
      if (fee.breakdown !== undefined) {
        if (!Array.isArray(fee.breakdown)) add('error', 'transaction.fee-breakdown', 'fee_details.breakdown', 'Expected an array');
        else {
          const valid = fee.breakdown.every(item => object(item) && nonempty(item.name) && decimal(item.amount));
          if (!valid) add('error', 'transaction.fee-breakdown', 'fee_details.breakdown', 'Each item needs a name and decimal amount');
          else if (decimal(fee.total) && fee.breakdown.reduce((sum, item) => sum + units(item.amount), 0n) !== units(fee.total)) add('error', 'transaction.fee-sum', 'fee_details.breakdown', 'Breakdown does not sum to fee total');
        }
      }
    }
  }
  // Do not compare amount_in/out across different or unspecified asset units.
  if (transaction.status_eta !== undefined && (typeof transaction.status_eta !== 'number' || !Number.isFinite(transaction.status_eta) || transaction.status_eta < 0)) add('error', 'transaction.eta', 'status_eta', 'Expected non-negative seconds');
  return findings;
}

export function report(findings, metadata = {}) {
  return { schemaVersion: 1, specification: SPEC, scope: 'Selected discovery, info, and captured-transaction checks; authentication and funds flows are not exercised', ...metadata,
    summary: { errors: findings.filter(f => f.severity === 'error').length, warnings: findings.filter(f => f.severity === 'warning').length }, findings };
}
