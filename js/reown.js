import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { defineChain } from '@reown/appkit/networks';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID || 'e96bf6ff5968197fd8f9375d610c4e86';

const bsc = defineChain({
  id: 56,
  caipNetworkId: 'eip155:56',
  chainNamespace: 'eip155',
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: { default: { http: ['https://bsc-dataseed.binance.org'] } },
  blockExplorers: { default: { name: 'BscScan', url: 'https://bscscan.com' } },
});

const riche = defineChain({
  id: 132026,
  caipNetworkId: 'eip155:132026',
  chainNamespace: 'eip155',
  name: 'Riche Chain',
  nativeCurrency: { name: 'RIC', symbol: 'RIC', decimals: 18 },
  rpcUrls: { default: { http: ['https://seed-richechain.com/'] } },
  blockExplorers: { default: { name: 'RicheScan', url: 'https://richescan.com' } },
});

const NETWORKS = { bsc, riche };
const DEFAULT_NETWORK = bsc;

const isLocalDev = typeof window !== 'undefined' &&
  ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

const appKit = createAppKit({
  adapters: [new EthersAdapter()],
  networks: [bsc, riche],
  defaultNetwork: DEFAULT_NETWORK,
  projectId,
  metadata: {
    name: 'RECEH DEX',
    description: 'Decentralized exchange for swaps and liquidity on BNB Smart Chain and Riche Chain',
    url: isLocalDev ? window.location.origin : 'https://recehdex.github.io/',
    icons: ['https://recehdex.github.io/favicon.png'],
  },
  chainImages: {
    56: 'https://raw.githubusercontent.com/recehdex/recehdex.github.io/refs/heads/main/images/bsc-logo-100x100.png',
    132026: 'https://raw.githubusercontent.com/recehdex/token-logo/refs/heads/main/WRIC.webp',
  },
  enableNetworkSwitch: true,
  enableReconnect: true,
  enableMobileFullScreen: true,
  experimental_preferUniversalLinks: true,
  features: { analytics: false, email: false, socials: [] },
});

let lastProvider = null;
let lastAddress = null;
let lastChainId = DEFAULT_NETWORK.id;

function getProvider() {
  try {
    const p = appKit.getWalletProvider?.() || appKit.getProviders?.()?.eip155 || lastProvider || null;
    if (p) lastProvider = p;
    return p;
  } catch { return lastProvider; }
}
function getAddress() {
  try { return appKit.getAddress?.() || lastAddress || null; } catch { return lastAddress; }
}
function getChainId() {
  try { return appKit.getChainId?.() || lastChainId || null; } catch { return lastChainId; }
}

async function sync(state = {}) {
  const provider = state?.isConnected === false ? null : (state?.provider || getProvider());
  if (!provider) {
    lastProvider = null; lastAddress = null;
    window.dispatchEvent(new CustomEvent('receh:appkit-wallet', { detail: { provider: null, address: null, chainId: null, isConnected: false } }));
    return null;
  }
  let address = state?.address || getAddress() || null;
  let chainId = state?.chainId ?? getChainId() ?? null;
  try {
    const accounts = await provider.request({ method: 'eth_accounts' });
    if (!address) address = accounts?.[0] || null;
  } catch {}
  try {
    const chainHex = await provider.request({ method: 'eth_chainId' });
    chainId = parseInt(String(chainHex), 16);
  } catch {}
  lastProvider = provider;
  lastAddress = address;
  lastChainId = Number(chainId) || DEFAULT_NETWORK.id;
  const isConnected = Boolean(address);
  window.dispatchEvent(new CustomEvent('receh:appkit-wallet', {
    detail: { provider, address, chainId: lastChainId, isConnected },
  }));
  return provider;
}

async function disconnect() {
  try { await appKit.disconnect?.(); } catch (e) { console.warn('AppKit disconnect failed:', e); }
  lastProvider = null; lastAddress = null;
  window.dispatchEvent(new CustomEvent('receh:appkit-wallet', { detail: { provider: null, address: null, chainId: null, isConnected: false } }));
}

try { appKit.subscribeProvider?.(sync); } catch (e) { console.warn('AppKit provider subscription unavailable:', e); }
try {
  appKit.subscribeProviders?.((providers = {}) => {
    const provider = providers?.eip155 || null;
    void sync({ provider, isConnected: Boolean(provider) });
  });
} catch (e) { console.warn('AppKit providers subscription unavailable:', e); }

function resolveNetwork(keyOrId) {
  if (typeof keyOrId === 'string' && NETWORKS[keyOrId]) return NETWORKS[keyOrId];
  return Object.values(NETWORKS).find((n) => n.id === Number(keyOrId)) || null;
}

window.__RECEH_REOWN__ = {
  appKit, getProvider, getAddress, getChainId,
  networks: NETWORKS,
  getNetwork: (keyOrId) => resolveNetwork(keyOrId) || DEFAULT_NETWORK,

  switchNetwork: async (keyOrId) => {
    const net = resolveNetwork(keyOrId);
    if (!net) throw new Error('Unsupported network.');
    if (typeof appKit.switchNetwork !== 'function') throw new Error('Reown network switching is unavailable.');
    return appKit.switchNetwork(net, { throwOnFailure: true });
  },

  setActiveNetwork: async (keyOrId) => {
    const net = resolveNetwork(keyOrId);
    if (!net || typeof appKit.switchNetwork !== 'function') return;
    try { await appKit.switchNetwork(net); } catch {}
  },
  open: () => appKit.open({ view: 'Connect' }),
  disconnect,
  sync,
};

queueMicrotask(() => { void sync(); });
