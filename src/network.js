import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { safeUrl, validateDiscovery, validateInfo, report } from './index.js';

function privateAddress(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  return address === '::' || address === '::1' || /^f[cd]/i.test(address) || /^fe[89ab]/i.test(address) || address.toLowerCase().startsWith('::ffff:');
}

export async function checkTarget(value, options = {}) {
  const url = safeUrl(value, options);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (options.allowLocal && ['localhost', '127.0.0.1', '::1'].includes(host)) return url;
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) throw new Error('Private or reserved network targets require a loopback-only demo');
  return url;
}

export async function getText(value, options = {}) {
  let url = await checkTarget(value, options);
  for (let redirects = 0; redirects <= 3; redirects++) {
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30000), headers: { Accept: 'application/json, text/plain;q=0.9, */*;q=0.1', Origin: 'https://anchorcheck.example' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      if (redirects === 3 || !response.headers.get('location')) throw new Error('Redirect limit exceeded or missing location');
      url = await checkTarget(new URL(response.headers.get('location'), url).href, options);
      continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error('HTTP ' + response.status + ' from ' + url.host); }
    let bytes = 0;
    const chunks = [];
    for await (const chunk of response.body ?? []) {
      bytes += chunk.length;
      if (bytes > 1048576) throw new Error('Response exceeds 1 MiB');
      chunks.push(chunk);
    }
    return { url: url.href, status: response.status, headers: Object.fromEntries(response.headers), text: Buffer.concat(chunks).toString('utf8') };
  }
}

export async function inspectAnchor(home, options = {}) {
  const findings = [];
  const metadata = { inspectedAt: new Date().toISOString(), home, requests: [] };
  try {
    const url = safeUrl(home, options);
    if (url.pathname !== '/' || url.search) throw new Error('Supply a home origin, without a path or query');
    const discovery = await getText(new URL('/.well-known/stellar.toml', url).href, options);
    metadata.requests.push({ url: discovery.url, status: discovery.status });
    const parsed = validateDiscovery(discovery.text, options);
    metadata.declaredNetworkPassphrase = parsed.document?.NETWORK_PASSPHRASE ?? null;
    findings.push(...parsed.findings);
    if (parsed.document && !parsed.findings.some(f => f.severity === 'error')) {
      const endpoint = new URL(parsed.document.TRANSFER_SERVER_SEP0024);
      endpoint.pathname = endpoint.pathname.replace(/\/$/, '') + '/info';
      endpoint.search = '';
      const info = await getText(endpoint.href, options);
      metadata.requests.push({ url: info.url, status: info.status });
      if (!/^application\/json(?:;|$)/i.test(info.headers['content-type'] ?? '')) findings.push({ severity: 'error', code: 'http.content-type', path: '/info', message: 'Expected application/json response' });
      if (info.headers['access-control-allow-origin'] !== '*') findings.push({ severity: 'error', code: 'http.cors', path: '/info', message: 'SEP-24 requires Access-Control-Allow-Origin: *' });
      try { findings.push(...validateInfo(JSON.parse(info.text))); }
      catch { findings.push({ severity: 'error', code: 'info.json', path: '/info', message: 'Invalid JSON response' }); }
    }
  } catch (error) {
    findings.push({ severity: 'error', code: 'network.request', path: '$', message: error.message + (error.cause?.code ? ' (' + error.cause.code + ')' : '') });
  }
  return report(findings, metadata);
}
