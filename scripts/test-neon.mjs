import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { Pool } from 'pg';
import { loadEnvironment } from '../dist/server/server/environment.js';

loadEnvironment();
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required; run neon deploy first.');

const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
const baseUrl = `http://127.0.0.1:${port}`;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 15_000 });
let server;
let productId;

async function start() {
  server = spawn(process.execPath, ['dist/server/server/index.js'], {
    env: { ...process.env, PORT: String(port), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Backend startup timed out.')), 45_000);
    let output = '';
    server.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('Sistema disponível')) { clearTimeout(timer); resolve(); }
    });
    server.on('error', (error) => { clearTimeout(timer); reject(error); });
    server.on('exit', (code) => { clearTimeout(timer); reject(new Error(`Backend exited during startup (code ${code}).`)); });
    // Drain stderr without printing connection details or credentials.
    server.stderr.on('data', () => {});
  });
}

async function stop() {
  if (server && server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, 'exit');
    server.kill();
    await stopped;
  }
}

async function api(path, options) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, signal: AbortSignal.timeout(20_000) });
  assert.ok(response.ok, `${options?.method ?? 'GET'} ${path}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}

try {
  await pool.query('SELECT 1');
  console.log('PASS: real PostgreSQL connection');
  await start();
  const page = await fetch(baseUrl, { signal: AbortSignal.timeout(20_000) });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root"><\/div>/);
  console.log('PASS: compiled frontend served by production backend');

  const input = { nome: `Neon smoke ${Date.now()}`, estabelecimento: 'Teste automatizado', categoria: 'Teste',
    preco: 12.5, estoque: 2, ativo: true, data_compra: '2026-10-25', purchase_id: crypto.randomUUID() };
  const product = await api('/api/produtos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  productId = product.id;
  const stored = await pool.query('SELECT nome, preco, purchase_id FROM produtos WHERE id = $1', [productId]);
  assert.equal(stored.rows[0]?.nome, input.nome);
  assert.equal(stored.rows[0]?.purchase_id, input.purchase_id);
  assert.equal(stored.rows[0]?.preco, 12.5);
  console.log('PASS: HTTP purchase creation persisted in real PostgreSQL');

  const updated = await api(`/api/produtos/${productId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...input, preco: 19.9 }) });
  assert.equal(updated.preco, 19.9);
  await stop();
  await start();
  const products = await api(`/api/produtos?busca=${encodeURIComponent(input.nome)}`);
  assert.equal(products.find((item) => item.id === productId)?.preco, 19.9);
  console.log('PASS: purchase update and persistence after backend restart');

  await api(`/api/produtos/${productId}`, { method: 'DELETE' });
  const deleted = await pool.query('SELECT id FROM produtos WHERE id = $1', [productId]);
  assert.equal(deleted.rowCount, 0);
  productId = undefined;
  console.log('PASS: HTTP deletion confirmed in real PostgreSQL; test data removed');
} finally {
  try {
    if (productId !== undefined) await pool.query('DELETE FROM produtos WHERE id = $1', [productId]);
  } finally {
    await stop();
    await pool.end();
  }
}
