export function safePath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
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
