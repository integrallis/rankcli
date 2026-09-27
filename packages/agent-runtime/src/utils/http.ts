/**
 * Isomorphic HTTP utilities using native fetch
 * Works in both Node.js (18+) and Deno
 */

export interface HttpRequestConfig {
  headers?: Record<string, string>;
  timeout?: number;
  validateStatus?: (status: number) => boolean;
  maxRedirects?: number;
  auth?: { username: string; password: string };
  params?: Record<string, string | number | boolean>;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_USER_AGENT = 'RankCLI/1.0 (+https://rankcli.dev)';

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeout: number): { controller: AbortController; timeoutId: ReturnType<typeof setTimeout> } {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  return { controller, timeoutId };
}

/**
 * Convert Headers to plain object
 */
function headersToObject(headers: Headers): Record<string, string> {
  const obj: Record<string, string> = {};
  headers.forEach((value, key) => {
    obj[key.toLowerCase()] = value;
  });
  return obj;
}

/**
 * HTTP GET request
 */
/**
 * True when a response is really the site's HTML being served for a path that has no file.
 *
 * A single-page app's catch-all answers 200 with index.html for /sitemap.xml, /llms.txt,
 * /robots.txt - anything. Trusting the status code there turns "you have no llms.txt" into
 * "your llms.txt is invalid and has no title", which sends the user looking for a file that
 * was never there. animerm.ai is exactly this: a real robots.txt, and HTML at the other two.
 */
export function looksLikeHtmlFallback(body: unknown, contentType?: string | null): boolean {
  if (contentType && /text\/html/i.test(contentType)) return true;
  if (typeof body !== 'string') return false;
  const head = body.trimStart().slice(0, 200).toLowerCase();
  return head.startsWith('<!doctype html') || head.startsWith('<html');
}

export async function httpGet<T = string>(
  url: string,
  config: HttpRequestConfig = {}
): Promise<HttpResponse<T>> {
  const {
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    validateStatus = (status) => status >= 200 && status < 300,
    maxRedirects = 5,
    params,
  } = config;

  // Build URL with query params
  let finalUrl = url;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      searchParams.append(key, String(value));
    }
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}${searchParams.toString()}`;
  }

  const { controller, timeoutId } = createTimeoutController(timeout);

  try {
    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        ...headers,
      },
      signal: controller.signal,
      redirect: maxRedirects > 0 ? 'follow' : 'manual',
    });

    const contentType = response.headers.get('content-type') || '';
    let data: T;

    // The timeout covers the body too: clearing it once headers arrived let a server that
    // stalls or trickles the body hang the audit with no limit at all.
    if (contentType.includes('application/json')) {
      data = await response.json() as T;
    } else {
      data = await response.text() as unknown as T;
    }
    clearTimeout(timeoutId);

    if (!validateStatus(response.status)) {
      const error = new Error(`Request failed with status ${response.status}`) as Error & { response: HttpResponse<T> };
      error.response = {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: headersToObject(response.headers),
      };
      throw error;
    }

    return {
      data,
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * HTTP HEAD request
 */
export async function httpHead(
  url: string,
  config: HttpRequestConfig = {}
): Promise<HttpResponse<null>> {
  const {
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    validateStatus = (status) => status >= 200 && status < 300,
    maxRedirects = 5,
  } = config;

  const { controller, timeoutId } = createTimeoutController(timeout);

  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        ...headers,
      },
      signal: controller.signal,
      redirect: maxRedirects > 0 ? 'follow' : 'manual',
    });

    clearTimeout(timeoutId);

    if (!validateStatus(response.status)) {
      const error = new Error(`Request failed with status ${response.status}`) as Error & { response: HttpResponse<null> };
      error.response = {
        data: null,
        status: response.status,
        statusText: response.statusText,
        headers: headersToObject(response.headers),
      };
      throw error;
    }

    return {
      data: null,
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * HTTP POST request
 */
export async function httpPost<T = unknown>(
  url: string,
  data?: unknown,
  config: HttpRequestConfig = {}
): Promise<HttpResponse<T>> {
  const {
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    validateStatus = (status) => status >= 200 && status < 300,
    auth,
  } = config;

  const { controller, timeoutId } = createTimeoutController(timeout);

  const requestHeaders: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Content-Type': 'application/json',
    ...headers,
  };

  // Add basic auth if provided
  if (auth) {
    const credentials = btoa(`${auth.username}:${auth.password}`);
    requestHeaders['Authorization'] = `Basic ${credentials}`;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders,
      body: data ? JSON.stringify(data) : undefined,
      signal: controller.signal,
    });

    const contentType = response.headers.get('content-type') || '';
    let responseData: T;

    // The timeout covers the body too: clearing it once headers arrived let a server that
    // stalls or trickles the body hang the audit with no limit at all.
    if (contentType.includes('application/json')) {
      responseData = await response.json() as T;
    } else {
      responseData = await response.text() as unknown as T;
    }
    clearTimeout(timeoutId);

    if (!validateStatus(response.status)) {
      const error = new Error(`Request failed with status ${response.status}`) as Error & { response: HttpResponse<T> };
      error.response = {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: headersToObject(response.headers),
      };
      throw error;
    }

    return {
      data: responseData,
      status: response.status,
      statusText: response.statusText,
      headers: headersToObject(response.headers),
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

/**
 * Follow redirects manually and return the chain
 */
export async function followRedirects(
  url: string,
  config: HttpRequestConfig = {}
): Promise<{ chain: string[]; finalUrl: string; status: number }> {
  const {
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    maxRedirects = 10,
  } = config;

  const chain: string[] = [url];
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    const { controller, timeoutId } = createTimeoutController(timeout);

    try {
      const response = await fetch(currentUrl, {
        method: 'HEAD',
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          ...headers,
        },
        signal: controller.signal,
        redirect: 'manual',
      });

      clearTimeout(timeoutId);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          // Resolve relative URLs
          currentUrl = new URL(location, currentUrl).toString();
          chain.push(currentUrl);
          redirectCount++;
          continue;
        }
      }

      return { chain, finalUrl: currentUrl, status: response.status };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  return { chain, finalUrl: currentUrl, status: 0 };
}
