import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleDemoAPI } from './demo-api.mjs';
import { handleEditAPI } from './edit-api.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.MOUM_DEMO_PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('MOUM_DEMO_PORT must be 1–65535.');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (await handleDemoAPI(request, response, url)) return;
    if (await handleEditAPI(request, response, url)) return;
    const relative = decodeURIComponent(url.pathname === '/' ? '/examples/grid/index.html' : url.pathname);
    const target = path.resolve(root, '.' + relative);
    const local = path.relative(root, target);
    if (local.startsWith('..') || path.isAbsolute(local) || local.split(path.sep).some(part => part.startsWith('.') || ['node_modules', 'output'].includes(part))) { response.writeHead(403); response.end(); return; }
    const content = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(content);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`MOUM demo: http://127.0.0.1:${port}/examples/grid/index.html`));
