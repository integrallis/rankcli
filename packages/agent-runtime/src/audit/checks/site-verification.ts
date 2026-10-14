/**
 * Site ownership verification that lives outside the HTML.
 *
 * Google Search Console and Bing Webmaster Tools both accept a DNS TXT record on the domain in
 * place of a meta tag, and Bing also accepts a /BingSiteAuth.xml file. Anyone with DNS access
 * tends to verify that way (rankcli.dev does), so a check that only reads the <head> reports
 * most verified sites as unverified.
 *
 * DNS needs node:dns. The Deno/edge bundle has no such module and an offline run has no
 * resolver, so there `dnsChecked` is false and the callers say the verification is not visible
 * in the HTML rather than that it is missing. Results are cached per host for a few minutes:
 * two checks on every page of a multi-page audit would otherwise repeat the same lookups.
 */

import { httpGet, looksLikeHtmlFallback } from '../../utils/http.js';

export interface SiteVerification {
  /** The domain's TXT records could be read. False in Deno, offline, or when the lookup failed. */
  dnsChecked: boolean;
  /** A `google-site-verification=...` TXT record on the domain. */
  googleDns: boolean;
  /** An `MS=...` TXT record on the domain. */
  bingDns: boolean;
  /** `/BingSiteAuth.xml` answers 200 with a `<users>` document. */
  bingSiteAuthFile: boolean;
}

const UNCHECKED: SiteVerification = {
  dnsChecked: false,
  googleDns: false,
  bingDns: false,
  bingSiteAuthFile: false,
};

const DNS_TIMEOUT_MS = 2000;
const FILE_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, { expires: number; result: Promise<SiteVerification> }>();

export function lookupSiteVerification(url: string): Promise<SiteVerification> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return Promise.resolve(UNCHECKED);
  }
  const host = parsed.hostname.toLowerCase();
  const now = Date.now();
  const cached = cache.get(host);
  if (cached && cached.expires > now) return cached.result;

  const result = Promise.all([readTxtRecords(host), fetchBingSiteAuth(parsed.origin)]).then(
    ([txt, bingSiteAuthFile]) => ({
      dnsChecked: txt.checked,
      googleDns: txt.records.some((record) => /^google-site-verification=/i.test(record)),
      bingDns: txt.records.some((record) => /^MS=/i.test(record)),
      bingSiteAuthFile,
    })
  );
  cache.set(host, { expires: now + CACHE_TTL_MS, result });
  return result;
}

/** Tests run many hosts through one process. */
export function clearSiteVerificationCache(): void {
  cache.clear();
}

// -----------------------------------------------------------------------------
// DNS
// -----------------------------------------------------------------------------

type ResolveTxt = (name: string) => Promise<string[][]>;

let resolveTxtLoader: Promise<ResolveTxt | null> | undefined;

/**
 * node:dns's resolveTxt when this is Node, null elsewhere. The specifier is a variable so
 * esbuild leaves the import alone in the Deno bundle (platform neutral, where `node:dns` does
 * not resolve) instead of failing the build; at runtime any failure to load it means no DNS.
 */
function loadResolveTxt(): Promise<ResolveTxt | null> {
  resolveTxtLoader ??= (async () => {
    if (typeof process === 'undefined' || !process.versions?.node) return null;
    try {
      const specifier = 'node:dns';
      const dns = await import(specifier);
      const resolveTxt = dns?.promises?.resolveTxt ?? dns?.default?.promises?.resolveTxt;
      return typeof resolveTxt === 'function' ? (resolveTxt as ResolveTxt) : null;
    } catch {
      return null;
    }
  })();
  return resolveTxtLoader;
}

/**
 * The names a verification record can sit on. Google and Bing put it on the registrable
 * domain, which without a public suffix list is one of the host's shorter suffixes: for
 * docs.example.co.uk that is co.uk, example.co.uk or the host itself. All are asked in
 * parallel; a suffix that is only a public suffix has no such record and costs nothing.
 */
function domainCandidates(host: string): string[] {
  if (/^[\d.]+$/.test(host) || host.includes(':')) return []; // an IP address has no TXT records
  const labels = host.split('.').filter(Boolean);
  const names: string[] = [];
  for (let n = 2; n <= labels.length && names.length < 4; n++) {
    names.push(labels.slice(-n).join('.'));
  }
  return names.length > 0 ? names : [host];
}

async function readTxtRecords(host: string): Promise<{ checked: boolean; records: string[] }> {
  const resolveTxt = await loadResolveTxt();
  if (!resolveTxt) return { checked: false, records: [] };
  const lookups = await Promise.all(domainCandidates(host).map((name) => resolveTxtWithin(resolveTxt, name)));
  return {
    checked: lookups.every((records) => records !== null),
    records: lookups.flatMap((records) => records ?? []),
  };
}

// The name exists but has no TXT records, or does not exist at all: an answer, not a failure.
const NO_RECORD_CODES = new Set(['ENODATA', 'ENOTFOUND']);

/** One name's TXT records (each joined from its chunks); [] when it has none; null on failure. */
async function resolveTxtWithin(resolveTxt: ResolveTxt, name: string): Promise<string[] | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), DNS_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      resolveTxt(name).then(
        (records) => records.map((chunks) => chunks.join('').trim()),
        (error: unknown) => (NO_RECORD_CODES.has((error as { code?: string })?.code ?? '') ? [] : null)
      ),
      timeout,
    ]);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// -----------------------------------------------------------------------------
// BingSiteAuth.xml
// -----------------------------------------------------------------------------

async function fetchBingSiteAuth(origin: string): Promise<boolean> {
  try {
    const response = await httpGet<string>(`${origin}/BingSiteAuth.xml`, {
      timeout: FILE_TIMEOUT_MS,
      maxBytes: 64 * 1024,
    });
    return (
      response.status === 200 &&
      typeof response.data === 'string' &&
      !looksLikeHtmlFallback(response.data, response.headers['content-type']) &&
      /<users[\s>]/i.test(response.data)
    );
  } catch {
    return false;
  }
}
