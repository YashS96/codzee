import { describe, expect, it } from 'vitest';
import { parseBearer } from '../../src/adapters/primary/shared/bearer.js';

describe('parseBearer', () => {
  it('extracts the token, case-insensitive scheme', () => {
    expect(parseBearer('Bearer abc.def')).toBe('abc.def');
    expect(parseBearer('bearer abc')).toBe('abc');
    expect(parseBearer('  Bearer   abc  ')).toBe('abc');
  });

  it('rejects other schemes and malformed values', () => {
    expect(parseBearer('Basic dXNlcjpwYXNz')).toBeNull();
    expect(parseBearer('Bearer')).toBeNull();
    expect(parseBearer('Bearer a b')).toBeNull();
    expect(parseBearer(undefined)).toBeNull();
    expect(parseBearer(['Bearer x'])).toBeNull();
  });
});
