import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const manifest = (await readFile(path.join(root, 'SHA256SUMS.txt'), 'utf8')).trim().split(/\r?\n/);
for (const line of manifest) {
  const match = /^([a-f0-9]{64})  ([\w./-]+)$/.exec(line);
  assert(match, 'Invalid SHA-256 manifest line.');
  const [, expected, file] = match;
  assert(!file.startsWith('/') && !file.split('/').includes('..'), 'Invalid manifest path.');
  const actual = createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
  assert.equal(actual, expected, file);
}
console.log(`PASS SHA-256 verified for ${manifest.length} MOUM bundle files.`);
