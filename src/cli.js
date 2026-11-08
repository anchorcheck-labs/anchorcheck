import { readFile, writeFile } from 'node:fs/promises';
import { validateDiscovery, validateInfo, validateTransaction, report } from './index.js';
import { inspectAnchor } from './network.js';
import { startMock } from './mock.js';

async function main() {
  const [command, target, ...flags] = process.argv.slice(2);
  let output, allowLocal = false;
  for (let i = 0; i < flags.length; i++) {
    if (flags[i] === '--output' && flags[i + 1] && !flags[i + 1].startsWith('--')) output = flags[++i];
    else if (flags[i] === '--allow-local') allowLocal = true;
    else throw new Error('Unknown or incomplete option: ' + flags[i]);
  }
  if (command === 'mock') {
    const port = target === undefined ? 4180 : Number(target);
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid port');
    const mock = await startMock({ port });
    console.log('LOCAL MOCK ONLY — ' + mock.origin);
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await mock.close(); process.exit(0); });
    return;
  }
  if (!['check', 'info', 'transaction', 'discovery'].includes(command) || !target) {
    console.log('Usage:\n  node src/cli.js check https://anchor.example [--output report.json]\n  node src/cli.js info|transaction|discovery FILE [--output report.json]\n  node src/cli.js mock [PORT]\nLoopback mocks require --allow-local when checking.');
    process.exitCode = command ? 2 : 0;
    return;
  }
  let result;
  if (command === 'check') result = await inspectAnchor(target, { allowLocal });
  else {
    const text = await readFile(target, 'utf8');
    const findings = command === 'discovery' ? validateDiscovery(text, { allowLocal }).findings : command === 'info' ? validateInfo(JSON.parse(text)) : validateTransaction(JSON.parse(text), { allowLocal });
    result = report(findings, { mode: command, source: target });
  }
  if (output) await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (result.summary.errors) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 2; });
