/** Extracts the token from an `Authorization: Bearer <token>` value. Shared by the HTTP and gRPC adapters. */
export function parseBearer(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (rest.length > 0) return null;
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}
