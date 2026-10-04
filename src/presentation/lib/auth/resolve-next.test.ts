import { describe, expect, it } from 'vitest';
import { resolveNext } from './resolve-next';

const origin = 'http://localhost:3000';

describe('resolveNext', () => {
  it('uses a same-origin relative next path', () => {
    expect(resolveNext(new URLSearchParams('next=%2Fpayments%2Fnew'), origin)).toBe('/payments/new');
  });

  it('extracts next from redirect_to when present', () => {
    const params = new URLSearchParams({ redirect_to: 'http://localhost:3000/auth/callback?next=%2Fmore' });
    expect(resolveNext(params, origin)).toBe('/more');
  });

  it('falls back to / for missing, absolute, protocol-relative or foreign values', () => {
    expect(resolveNext(new URLSearchParams(''), origin)).toBe('/');
    expect(resolveNext(new URLSearchParams('next=https%3A%2F%2Fevil.example'), origin)).toBe('/');
    expect(resolveNext(new URLSearchParams('next=%2F%2Fevil.example'), origin)).toBe('/');
    expect(resolveNext(new URLSearchParams({ redirect_to: 'https://evil.example/x?next=/more' }), origin)).toBe('/');
  });

  it('handles the real magic-link callback params (token_hash, type, redirect_to)', () => {
    const params = new URLSearchParams({
      token_hash: 'abc',
      type: 'email',
      redirect_to: 'http://localhost:3000/auth/callback?next=%2Fpayments%2Fnew',
    });
    expect(resolveNext(params, origin)).toBe('/payments/new');
  });
});
