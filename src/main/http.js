'use strict';
// Ana süreçten giden TÜM web istekleri buradan geçer. Yalnızca https ve izin
// verilen Steam alan adlarına gidilir; yönlendirmeler de her adımda denetlenir.

const STEAM_HOSTS = ['steamcommunity.com', 'store.steampowered.com', 'api.steampowered.com'];
const IMAGE_HOSTS = ['cdn.cloudflare.steamstatic.com', 'shared.cloudflare.steamstatic.com', 'cdn.akamai.steamstatic.com', 'shared.akamai.steamstatic.com'];

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

function hostAllowed(hostname, list) {
  return list.some((h) => hostname === h || hostname.endsWith('.' + h));
}

function isAllowedUrl(u, hosts = STEAM_HOSTS) {
  let url;
  try { url = new URL(u); } catch { return false; }
  if (url.protocol !== 'https:') return false;
  if (url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;
  return hostAllowed(url.hostname, hosts);
}

class HttpError extends Error {
  constructor(code, message, status) {
    super(message || code);
    this.code = code;
    this.status = status;
  }
}

/**
 * @param {string} url
 * @param {{cookies?: string, hosts?: string[], timeoutMs?: number, maxBytes?: number, binary?: boolean}} opt
 */
async function get(url, opt = {}) {
  const hosts = opt.hosts || STEAM_HOSTS;
  const maxBytes = opt.maxBytes || 8 * 1024 * 1024;
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedUrl(current, hosts)) throw new HttpError('BLOCKED', 'Address not allowed');
    const headers = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' };
    // Oturum çerezi yalnızca steamcommunity.com'a gider.
    if (opt.cookies && new URL(current).hostname.endsWith('steamcommunity.com')) headers.Cookie = opt.cookies;
    let res;
    try {
      res = await fetch(current, { headers, redirect: 'manual', signal: AbortSignal.timeout(opt.timeoutMs || 20000) });
    } catch (e) {
      throw new HttpError('NETWORK', e && e.name === 'TimeoutError' ? 'Timeout' : 'Network error');
    }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) throw new HttpError('REDIRECT', 'Invalid redirect', res.status);
      const next = new URL(loc, current).href;
      if (/\/login(\/|\?|$)/i.test(new URL(next).pathname)) throw new HttpError('SESSION_EXPIRED', 'Steam session expired', res.status);
      current = next;
      continue;
    }
    if (res.status === 429) throw new HttpError('RATE_LIMIT', 'Steam rate limit (429)', 429);
    if (res.status === 403) throw new HttpError('FORBIDDEN', 'Access denied (403)', 403);
    if (!res.ok) throw new HttpError('HTTP', `HTTP ${res.status}`, res.status);
    const len = Number(res.headers.get('content-length') || 0);
    if (len > maxBytes) throw new HttpError('TOO_BIG', 'Response too large');
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > maxBytes) throw new HttpError('TOO_BIG', 'Response too large');
    return opt.binary ? buf : buf.toString('utf8');
  }
  throw new HttpError('REDIRECT', 'Too many redirects');
}

async function getJson(url, opt) {
  const text = await get(url, opt);
  try { return JSON.parse(text); } catch { throw new HttpError('PARSE', 'Invalid JSON response'); }
}

module.exports = { get, getJson, isAllowedUrl, HttpError, STEAM_HOSTS, IMAGE_HOSTS };
