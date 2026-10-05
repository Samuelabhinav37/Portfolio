// Cache API key for the feed endpoints. Keying on the raw request URL let
// any visitor append ?anything and get a guaranteed cache miss, which made
// the Function refetch every upstream (and spend OTX/NVD/Radar quota) per
// request. The key is this endpoint's path plus only the query params it
// actually reads, so every other variation shares one cache entry.
export function cacheKey(request, params = []) {
  const url = new URL(request.url);
  const key = new URL(url.origin + url.pathname);
  for (const p of params) {
    const v = url.searchParams.get(p);
    if (v != null) key.searchParams.set(p, v);
  }
  return new Request(key.toString(), { method: 'GET' });
}
