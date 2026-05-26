// build.js — pre-compile *.jsx into dist/*.js so the live page doesn't have to
// ship Babel-standalone (~800 KB gzipped) and run a runtime transpile pass
// (300-1500 ms blocking) on every visit.
//
// Usage:
//   npm run build         # one-shot
//   npm run watch         # rebuild on file change
//
// The four source files (tweaks-panel, pendant, sections, app) are classic
// scripts that share global scope — no bundling needed, only JSX → JS.

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const SOURCES = ['tweaks-panel.jsx', 'pendant.jsx', 'sections.jsx', 'app.jsx'];
const OUTDIR = path.join(ROOT, 'dist');

fs.mkdirSync(OUTDIR, { recursive: true });

const baseOpts = {
  loader: { '.jsx': 'jsx' },
  target: 'es2020',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
};

async function buildOnce() {
  const start = Date.now();
  await Promise.all(SOURCES.map((src) => {
    const out = path.join(OUTDIR, src.replace(/\.jsx$/, '.js'));
    return esbuild.build({ ...baseOpts, entryPoints: [path.join(ROOT, src)], outfile: out });
  }));
  const ms = Date.now() - start;
  const sizes = SOURCES.map((src) => {
    const out = path.join(OUTDIR, src.replace(/\.jsx$/, '.js'));
    const orig = fs.statSync(path.join(ROOT, src)).size;
    const built = fs.statSync(out).size;
    return `  ${src.padEnd(20)} ${(orig/1024).toFixed(1).padStart(6)} KB → ${(built/1024).toFixed(1).padStart(6)} KB`;
  }).join('\n');
  console.log(`\nbuilt in ${ms}ms:\n${sizes}\n`);
}

async function buildWatch() {
  const ctxs = await Promise.all(SOURCES.map((src) => {
    const out = path.join(OUTDIR, src.replace(/\.jsx$/, '.js'));
    return esbuild.context({ ...baseOpts, entryPoints: [path.join(ROOT, src)], outfile: out });
  }));
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log('watching for changes…');
}

if (process.argv.includes('--watch')) buildWatch();
else buildOnce();
