// Minimal static file server for the built SvelteKit SPA (build/).
// Portable: runs under Bun or Node (uses only node: builtins). Serves on $PORT
// (Railway/containers inject it) and falls back to index.html for client-side routes.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const ROOT = join(process.cwd(), 'build');
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
};

async function fileAt(p) {
  try {
    const s = await stat(p);
    if (s.isFile()) return p;
  } catch {
    /* not a file */
  }
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent((req.url || '/').split('?')[0]);
    // Block path traversal, then resolve within ROOT.
    const safe = normalize(path).replace(/^(\.\.([/\\]|$))+/, '');
    const target = join(ROOT, safe);

    let resolved = (await fileAt(target)) || (await fileAt(join(target, 'index.html')));
    let status = 200;
    if (!resolved) {
      // SPA fallback — client-side router handles the route.
      resolved = join(ROOT, 'index.html');
      status = 200;
    }

    const data = await readFile(resolved);
    const ext = extname(resolved);
    // Hashed build assets are immutable; HTML should not be cached hard.
    const immutable = resolved.includes('/_app/') && ext !== '.html';
    res.writeHead(status, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache'
    });
    res.end(data);
  } catch {
    res.writeHead(500, { 'content-type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`multilogic: serving build/ on http://${HOST}:${PORT}`);
});
