#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// generate-certificates.mjs — genera los códigos de los stickers anti-falsificación
// de Elyxie y produce DOS CSV:
//
//   1. stickers-proveedor.csv   → para la fábrica en China.  Columnas: serial,qr_url
//        · `serial`  se IMPRIME visible en el sticker  ("Unique Coding")
//        · `qr_url`  se CODIFICA dentro del QR          ("Anti-counterfeiting code")
//
//   2. certificates-master.csv  → para importar a Supabase. Columnas: token,serial,product_handle
//        · es el maestro privado; relaciona token → {serial, pieza}
//
// SEGURIDAD: el `token` (clave del QR) NO se imprime a la vista. El `serial` visible
// es aleatorio de 14 dígitos (no secuencial) para que tampoco se pueda enumerar por
// la caja de entrada manual. Ambos campos son inadivinables.
//
// Uso:
//   node scripts/generate-certificates.mjs                 # tirada real (ver CONFIG.products)
//   node scripts/generate-certificates.mjs --demo 20       # 20 filas de prueba (sin reparto)
//   node scripts/generate-certificates.mjs --out ./tmp     # carpeta de salida (def: scripts/out)
//
// No tiene dependencias: solo Node ≥18 (crypto integrado). No se commitea al tema.
// ─────────────────────────────────────────────────────────────────────────────

import { randomInt, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

// ── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  // Base de la URL del QR. El host canónico de la tienda (con o sin www) — confirmar
  // cuál no redirige, para no añadir un salto extra al escanear.
  baseUrl: 'https://www.elyxie.com/pages/verificar',

  // Fecha de producción por defecto (YYYY-MM-DD). Se puede sobreescribir por lote con `date`.
  productionDate: '2026-06-22',

  // Reparto de la tirada por producto/acabado/variante.
  //   handle = handle del producto en Shopify   (vacío '' = sello genérico)
  //   sku    = SKU exacto de la variante         (opcional; añade "·variante" en la página)
  //   date   = fecha de producción del lote      (opcional; si no, CONFIG.productionDate)
  // Suma de counts = total de stickers. Ajusta a tu tirada real.
  // Productos reales: el-angel-oro / el-angel-rodio / el-angel-plata · SKUs *-EL (él) / *-ELLA (ella).
  products: [
    { handle: 'el-angel-oro',   sku: 'ANGEL-ORO-EL',    count: 2500 },
    { handle: 'el-angel-oro',   sku: 'ANGEL-ORO-ELLA',  count: 2500 },
    { handle: 'el-angel-rodio', sku: 'ANGEL-RODIO-EL',  count: 1250 },
    { handle: 'el-angel-rodio', sku: 'ANGEL-RODIO-ELLA',count: 1250 },
    { handle: 'el-angel-plata', sku: 'ANGEL-PLATA-EL',  count: 1250 },
    { handle: 'el-angel-plata', sku: 'ANGEL-PLATA-ELLA',count: 1250 },
  ],

  serialDigits: 14,                 // longitud del serial visible (estilo muestra del proveedor)
  tokenLength: 8,                   // chars del token del QR
  // Crockford base32 sin caracteres ambiguos (0/O/1/I/L) — legible y a prueba de erratas
  tokenAlphabet: '23456789ABCDEFGHJKMNPQRSTVWXYZ',
};

// ── CLI mínima ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getFlag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const demoN = getFlag('--demo');
const outDir = path.resolve(getFlag('--out') || path.join('scripts', 'out'));

// Cuando es --demo: N filas sin reparto (product_handle vacío); si no, el reparto de CONFIG.
const plan = demoN
  ? [{ handle: '', sku: '', count: Number(demoN) }]
  : CONFIG.products;

const total = plan.reduce((n, p) => n + p.count, 0);
if (!Number.isInteger(total) || total <= 0) {
  console.error('Total inválido. Revisa CONFIG.products (o pasa --demo N).');
  process.exit(1);
}

// ── Generadores únicos ──────────────────────────────────────────────────────────
const seenSerials = new Set();
const seenTokens = new Set();

function makeSerial() {
  while (true) {
    let s = '';
    for (let i = 0; i < CONFIG.serialDigits; i++) s += String(randomInt(0, 10));
    if (s[0] === '0' && CONFIG.serialDigits > 1) s = String(randomInt(1, 10)) + s.slice(1); // sin 0 a la cabeza
    if (!seenSerials.has(s)) { seenSerials.add(s); return s; }
  }
}

function makeToken() {
  const A = CONFIG.tokenAlphabet;
  while (true) {
    let t = '';
    const bytes = randomBytes(CONFIG.tokenLength);
    for (let i = 0; i < CONFIG.tokenLength; i++) t += A[bytes[i] % A.length];
    if (!seenTokens.has(t)) { seenTokens.add(t); return t; }
  }
}

// ── Construir filas ──────────────────────────────────────────────────────────────
const rows = [];
for (const { handle, sku = '', count, date } of plan) {
  const productionDate = date || CONFIG.productionDate || '';
  for (let i = 0; i < count; i++) {
    const serial = makeSerial();
    const token = makeToken();
    const qrUrl = `${CONFIG.baseUrl}?k=${token}`;
    rows.push({ serial, token, product_handle: handle, sku, production_date: productionDate, qrUrl });
  }
}

// ── Escribir CSV ──────────────────────────────────────────────────────────────────
const csvCell = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (header, mapRow) =>
  [header.join(','), ...rows.map((r) => mapRow(r).map(csvCell).join(','))].join('\n') + '\n';

mkdirSync(outDir, { recursive: true });

const proveedorCsv = toCsv(['serial', 'qr_url'], (r) => [r.serial, r.qrUrl]);
const masterCsv = toCsv(
  ['token', 'serial', 'product_handle', 'sku', 'production_date'],
  (r) => [r.token, r.serial, r.product_handle, r.sku, r.production_date],
);

const proveedorPath = path.join(outDir, 'stickers-proveedor.csv');
const masterPath = path.join(outDir, 'certificates-master.csv');
writeFileSync(proveedorPath, proveedorCsv);
writeFileSync(masterPath, masterCsv);

console.log(`✓ ${rows.length} stickers generados`);
console.log(`  · proveedor (serial,qr_url):           ${proveedorPath}`);
console.log(`  · maestro  (token,serial,product,sku,fecha): ${masterPath}`);
console.log(`  Ejemplo QR: ${rows[0].qrUrl}`);
