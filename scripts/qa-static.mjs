import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const app = read('app.js');
const reown = read('js/reown.js');
const html = read('index.html');
const sw = read('public/sw.js');
const manifest = JSON.parse(read('public/pwa/manifest.webmanifest'));
const fail = (m) => { console.error(`QA FAIL: ${m}`); process.exit(1); };

// --- chains ---------------------------------------------------------------
if (!/const CHAINS = \{/.test(app)) fail('CHAINS configuration missing');
for (const id of [56, 132026]) if (!new RegExp(`id:\\s*${id}\\b`).test(app)) fail(`chain id ${id} missing from app.js`);
if (!/DEFAULT_CHAIN_KEY = "bsc"/.test(app)) fail('BSC must be the default chain');
if (!/networks:\s*\[bsc,\s*riche\]/.test(reown)) fail('Reown must list both networks (BSC first)');
if (!/defaultNetwork:\s*DEFAULT_NETWORK/.test(reown) || !/DEFAULT_NETWORK = bsc/.test(reown)) fail('Reown default network must be BSC');
if (!/chainEpoch/.test(app) || !/function applyChain\(/.test(app)) fail('applyChain / chainEpoch missing');
if (!/function requestWalletChain\(|async function requestWalletChain\(/.test(app)) fail('wallet network switching missing');
if (/readProvider\b/.test(app)) fail('single global read provider must not return');
if (/\bROUTE_HUBS\b/.test(app)) fail('static ROUTE_HUBS must not return (hubs are per chain)');
if (/save\("(custom|txns)"/.test(app)) fail('custom tokens / history must be saved per chain');
if (/S\.provider\s*\|\|\s*readProv\(\)/.test(app)) fail('reads must use rdProv() so a wallet on another chain cannot leak its data');

// --- ui -------------------------------------------------------------------
for (const id of ['netSwitch', 'netBtn', 'netMenu', 'mobNet', 'swapSub']) if (!html.includes(`id="${id}"`)) fail(`missing #${id}`);
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((m) => m[1]);
const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dup.length) fail(`duplicate HTML ids: ${[...new Set(dup)].join(', ')}`);
for (const m of app.matchAll(/\$\("([A-Za-z0-9_]+)"\)/g)) {
  if (!ids.includes(m[1]) && !['toastStack', 'mobDisconnectBtn', 'mobConnectBtn'].includes(m[1])) fail(`app.js uses #${m[1]} which is not in index.html`);
}

// --- hygiene --------------------------------------------------------------
if (/analytics\s*:\s*true/.test(reown)) fail('Reown analytics must be disabled');
if (!/window\.navTo\s*=\s*navTo/.test(app)) fail('navTo is not globally available');
if (!/window\.connectWallet\s*=\s*connectWallet/.test(app)) fail('connectWallet is not globally available');
if (!/CACHE_VERSION = 'receh-dex-shell-v13'/.test(sw)) fail('service-worker version not updated');
if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) fail('PWA icons missing');
for (const icon of manifest.icons) if (!fs.existsSync(path.join(root, 'public', icon.src.replace(/^\//, '')))) fail(`missing PWA icon: ${icon.src}`);
if (/console\.log\s*\(/.test(app)) fail('production console.log remains');
if (/\bdebugger\b|TODO|FIXME/.test(`${app}\n${reown}\n${sw}`)) fail('debug/TODO marker remains');
console.log('RECEH DEX static QA: PASS');
