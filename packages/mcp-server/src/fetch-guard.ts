/**
 * Outbound fetches for the analysis tools, with an opt-in private-network
 * block for shared/hosted deployments.
 *
 * A local stdio server (npx @rankcli/mcp-server) runs on the user's own
 * machine, where auditing http://localhost:3000 is a feature - so the block
 * is off by default. A shared endpoint must not let a caller make it fetch
 * internal services or cloud metadata (169.254.169.254, *.internal, ...),
 * so it passes { blockPrivateNetworks: true }.
 *
 * Every redirect hop is re-checked. Limitation: the address is checked by
 * a DNS lookup before fetch() resolves the name again, so a rebinding DNS
 * server could still swap it in between - pair this with a connection-level
 * guard in the host process (the hosted audit worker has one).
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export interface FetchGuardOptions {
  /** Refuse loopback, private, link-local, CGNAT and metadata addresses. */
  blockPrivateNetworks?: boolean;
}

const USER_AGENT = 'RankCLI/1.0 (+https://rankcli.dev)';
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 15_000;

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inV4(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split('/');
  const mask = Number(bits) === 0 ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const BLOCKED_V4 = [
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8', '169.254.0.0/16',
  '172.16.0.0/12', '192.0.0.0/24', '192.168.0.0/16', '198.18.0.0/15', '224.0.0.0/4', '240.0.0.0/4',
];

/** Loopback, private, link-local, CGNAT, multicast/reserved - anything not on the public internet. */
export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return BLOCKED_V4.some(cidr => inV4(ip, cidr));
  if (version === 6) {
    const v6 = ip.toLowerCase();
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (v6 === '::' || v6 === '::1') return true;
    const first = parseInt(v6.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    return false;
  }
  return true; // not an IP at all - refuse rather than guess
}

async function assertPublicUrl(url: URL): Promise<void> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) {
    throw new Error(`Refusing to fetch ${url.origin}: private network address`);
  }
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(a => isPrivateAddress(a.address))) {
    throw new Error(`Refusing to fetch ${url.origin}: private network address`);
  }
}

/**
 * fetch() for the analysis tools: http(s) only, a timeout, and (when
 * blockPrivateNetworks is on) every hop checked against private ranges.
 */
export async function guardedFetch(rawUrl: string, options: FetchGuardOptions = {}): Promise<Response> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Refusing to fetch ${url.protocol} URL - only http(s) is supported`);
    }
    if (options.blockPrivateNetworks) await assertPublicUrl(url);

    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: options.blockPrivateNetworks ? 'manual' : 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const location = response.headers.get('location');
    if (options.blockPrivateNetworks && response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url);
      continue;
    }
    return response;
  }
  throw new Error(`Too many redirects fetching ${rawUrl}`);
}
