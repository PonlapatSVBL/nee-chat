/** Returns a same-origin path (pathname + search + hash) or null if the value could leave the origin. */
export function safePath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  if (/[\\\s\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const probe = new URL(value, 'http://nee.invalid');
    if (probe.origin !== 'http://nee.invalid') return null;
    // Dot-segments (e.g. '/..//evil.com') normalise to a protocol-relative '//host' path.
    if (probe.pathname.startsWith('//')) return null;
    const result = `${probe.pathname}${probe.search}${probe.hash}`;
    if (!result.startsWith('/') || result.startsWith('//')) return null;
    return result;
  } catch {
    return null;
  }
}

/** Picks a safe same-origin path to continue to after login. */
export function resolveNext(params: URLSearchParams, origin: string): string {
  const direct = safePath(params.get('next'));
  if (direct) return direct;

  const redirectTo = params.get('redirect_to');
  if (redirectTo) {
    try {
      const url = new URL(redirectTo);
      if (url.origin === origin) {
        const nested = safePath(url.searchParams.get('next'));
        if (nested) return nested;
      }
    } catch {
      // ignore malformed redirect_to
    }
  }
  return '/';
}
