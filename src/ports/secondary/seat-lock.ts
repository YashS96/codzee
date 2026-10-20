/** Short-lived exclusive lock on a seat while a user completes checkout. */
export interface SeatLock {
  isLocked(key: string): Promise<boolean>;
  lock(key: string, owner: string, ttlSec: number): Promise<void>;
  unlock(key: string): Promise<void>;
}
