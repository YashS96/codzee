/** Server-side session state: refresh tokens and revoked access tokens. */
export interface SessionStore {
  saveRefreshToken(token: string, userId: string, ttlSec: number): Promise<void>;
  /** Atomically reads and deletes — a refresh token is single-use. Returns the owning userId. */
  consumeRefreshToken(token: string): Promise<string | null>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAccessToken(jti: string, ttlSec: number): Promise<void>;
  isAccessTokenRevoked(jti: string): Promise<boolean>;
}
