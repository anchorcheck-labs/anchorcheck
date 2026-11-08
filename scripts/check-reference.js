import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { inspectAnchor } from '../src/network.js';

const target = 'https://testanchor.stellar.org';
const result = await inspectAnchor(target);
if (result.summary.errors) {
  console.error(JSON.stringify(result, null, 2));
  throw new Error('Reference check failed; no successful evidence was published');
}
assert.equal(result.requests.length, 2);
assert.equal(result.declaredNetworkPassphrase, 'Test SDF Network ; September 2015');
const root = new URL('../', import.meta.url);
await mkdir(new URL('docs/reference/', root), { recursive: true });
await writeFile(new URL('docs/reference/latest.json', root), JSON.stringify(result, null, 2) + '\n');
const block = ['<!-- REFERENCE:START -->', '## Public reference-anchor check', '', 'Checked at: ' + result.inspectedAt, '', 'Target: [' + target + '](' + target + '). Its discovery document declared Stellar Testnet. AnchorCheck performed only the discovery and /info GET requests; no deposits, withdrawals or authentication were initiated.', '', 'Result: ' + result.summary.errors + ' detected errors and ' + result.summary.warnings + ' review warnings within the implemented subset.', '', 'Evidence: [latest.json](docs/reference/latest.json). This is a point-in-time interoperability diagnostic, not full SEP certification or a deployment of AnchorCheck to the blockchain.', '<!-- REFERENCE:END -->'].join('\n');
const path = new URL('README.md', root);
const previous = await readFile(path, 'utf8');
const pattern = /<!-- REFERENCE:START -->[\s\S]*?<!-- REFERENCE:END -->/;
await writeFile(path, pattern.test(previous) ? previous.replace(pattern, () => block) : previous.trimEnd() + '\n\n' + block + '\n');
console.log('Public reference check verified; evidence and README saved.');
