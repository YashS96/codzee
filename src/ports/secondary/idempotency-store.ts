/** Maps a client-supplied Idempotency-Key to the resource it created. */
export interface IdempotencyStore {
  get(key: string): Promise<string | null>;
  save(key: string, resourceId: string, ttlSec: number): Promise<void>;
}
