import { createServer } from 'node:http';

export async function startMock({ broken = false, port = 0 } = {}) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ method: req.method, path: req.url, origin: req.headers.origin });
    const origin = 'http://127.0.0.1:' + server.address().port;
    if (req.method !== 'GET') { res.writeHead(405); res.end(); return; }
    if (req.url === '/.well-known/stellar.toml') {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Access-Control-Allow-Origin': '*' });
      res.end('TRANSFER_SERVER_SEP0024 = "' + origin + '/sep24"\nWEB_AUTH_ENDPOINT = "' + origin + '/auth"\n');
    } else if (req.url === '/sep24/info') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...(broken ? {} : { 'Access-Control-Allow-Origin': '*' }) });
      res.end(JSON.stringify({ deposit: { native: { enabled: broken ? 'yes' : true, min_amount: broken ? 100 : 1, max_amount: 50 } }, withdraw: { native: { enabled: false } }, features: { account_creation: true } }));
    } else { res.writeHead(404); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { origin: 'http://127.0.0.1:' + server.address().port, requests, close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
