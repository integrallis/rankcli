/**
 * Request defaults for one site: headers added to every request the audit makes to it
 * (`--header`, `--cookie`, the config file's `headers`) and, for a build directory served
 * locally, the origin those requests go to instead. The audit's checks fetch through the
 * global fetch, so one wrapper covers all of them; requests to other hosts are untouched, so a
 * token for the site never reaches anyone else.
 */
export interface RequestDefaults {
  /** The audited origin, e.g. https://example.com. Its www./non-www. twin counts as the same site. */
  origin: string;
  headers?: Record<string, string>;
  /** Send the site's requests to this origin instead (a local server with the build output). */
  rewriteTo?: string;
}

interface ActiveDefaults extends RequestDefaults {
  hosts: Set<string>;
}

const active: ActiveDefaults[] = [];
let originalFetch: typeof fetch | undefined;

/** Install the defaults; the returned function removes them again. */
export function installRequestDefaults(defaults: RequestDefaults): () => void {
  const host = new URL(defaults.origin).hostname.toLowerCase();
  const hosts = new Set([host, host.startsWith('www.') ? host.slice(4) : `www.${host}`]);
  const entry: ActiveDefaults = { ...defaults, hosts };
  active.push(entry);
  if (!originalFetch) {
    originalFetch = globalThis.fetch;
    globalThis.fetch = fetchWithDefaults;
  }
  return () => {
    const index = active.indexOf(entry);
    if (index >= 0) active.splice(index, 1);
    if (active.length === 0 && originalFetch) {
      globalThis.fetch = originalFetch;
      originalFetch = undefined;
    }
  };
}

function fetchWithDefaults(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const passthrough = originalFetch ?? globalThis.fetch;
  const url = input instanceof Request ? input.url : String(input);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return passthrough(input, init);
  }
  const match = active.find(a => a.hosts.has(parsed.hostname.toLowerCase()));
  if (!match) return passthrough(input, init);

  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  for (const [key, value] of Object.entries(match.headers ?? {})) headers.set(key, value);

  let target = url;
  if (match.rewriteTo) {
    const to = new URL(match.rewriteTo);
    parsed.protocol = to.protocol;
    parsed.host = to.host;
    target = parsed.toString();
  }

  if (input instanceof Request) {
    const request = new Request(target, {
      method: input.method,
      redirect: input.redirect,
      signal: input.signal,
      ...init,
      headers,
    });
    return passthrough(request);
  }
  return passthrough(target, { ...init, headers });
}
