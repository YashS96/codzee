import type { Booking } from '../../src/domain/booking/booking.js';
import type { SeatHold } from '../../src/domain/booking/seat-hold.js';
import type { BookingRepository } from '../../src/ports/repositories/booking-repository.js';
import type { HoldRepository } from '../../src/ports/repositories/hold-repository.js';
import type { IdempotencyStore } from '../../src/ports/secondary/idempotency-store.js';
import type { SeatLock } from '../../src/ports/secondary/seat-lock.js';
import { BookingService } from '../../src/services/booking/booking-service.js';
import type { HealthIndicator } from '../../src/ports/secondary/health-indicator.js';
import type { PasswordHasher } from '../../src/ports/secondary/password-hasher.js';
import type { SessionStore } from '../../src/ports/secondary/session-store.js';
import type { Clock, IdGenerator } from '../../src/ports/secondary/system.js';
import type { UserRepository } from '../../src/ports/repositories/user-repository.js';
import { ConflictError } from '../../src/domain/shared/errors.js';
import type { Email } from '../../src/domain/user/email.js';
import type { User } from '../../src/domain/user/user.js';

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();
  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: Email) {
    return [...this.users.values()].find((u) => u.email.equals(email)) ?? null;
  }
  async create(user: User) {
    if (await this.findByEmail(user.email)) throw new ConflictError('Email is already registered');
    this.users.set(user.id, user);
  }
}

export class InMemorySessionStore implements SessionStore {
  readonly refresh = new Map<string, string>();
  readonly revoked = new Set<string>();
  async saveRefreshToken(token: string, userId: string) {
    this.refresh.set(token, userId);
  }
  async consumeRefreshToken(token: string) {
    const userId = this.refresh.get(token) ?? null;
    this.refresh.delete(token);
    return userId;
  }
  async revokeRefreshToken(token: string) {
    this.refresh.delete(token);
  }
  async revokeAccessToken(jti: string) {
    this.revoked.add(jti);
  }
  async isAccessTokenRevoked(jti: string) {
    return this.revoked.has(jti);
  }
}

/** Reversible "hash" — fast and deterministic for tests. */
export const fakeHasher: PasswordHasher = {
  hash: async (p) => `hashed:${p}`,
  verify: async (p, h) => h === `hashed:${p}`,
};

export const fixedClock = (iso = '2026-01-01T00:00:00Z'): Clock => ({ now: () => new Date(iso) });

export const sequentialIds = (): IdGenerator => {
  let n = 0;
  return { next: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
};

export const indicator = (name: string, healthy: boolean | (() => Promise<void>)): HealthIndicator => ({
  name,
  check:
    typeof healthy === 'function'
      ? healthy
      : async () => {
          if (!healthy) throw new Error(`${name} unreachable`);
        },
});

export class InMemorySeatLock implements SeatLock {
  readonly locks = new Map<string, string>();
  async isLocked(key: string) {
    return this.locks.has(key);
  }
  async lock(key: string, owner: string) {
    this.locks.set(key, owner);
  }
  async unlock(key: string) {
    this.locks.delete(key);
  }
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  readonly keys = new Map<string, string>();
  async get(key: string) {
    return this.keys.get(key) ?? null;
  }
  async save(key: string, resourceId: string) {
    this.keys.set(key, resourceId);
  }
}

export class InMemoryHoldRepository implements HoldRepository {
  readonly holds = new Map<string, SeatHold>();
  async create(hold: SeatHold) {
    this.holds.set(hold.id, hold);
  }
  async findById(id: string) {
    return this.holds.get(id) ?? null;
  }
  async delete(id: string) {
    this.holds.delete(id);
  }
}

export class InMemoryBookingRepository implements BookingRepository {
  readonly bookings = new Map<string, Booking>();
  async create(booking: Booking) {
    this.bookings.set(booking.id, booking);
  }
  async findById(id: string) {
    return this.bookings.get(id) ?? null;
  }
  async update(booking: Booking) {
    this.bookings.set(booking.id, booking);
  }
  async findExpiredPending(now: Date) {
    return [...this.bookings.values()].filter(
      (b) => b.status === 'PENDING_PAYMENT' && b.expiresAt.getTime() <= now.getTime(),
    );
  }
}

export function makeBookingService(clock: Clock = { now: () => new Date() }) {
  const deps = {
    holds: new InMemoryHoldRepository(),
    bookings: new InMemoryBookingRepository(),
    locks: new InMemorySeatLock(),
    idempotency: new InMemoryIdempotencyStore(),
  };
  const booking = new BookingService({
    ...deps,
    clock,
    ids: uuidIds(),
    holdTtlSec: 600,
    paymentWindowSec: 900,
    seatPrice: 250,
  });
  return { booking, ...deps };
}

/** Sequential ids shaped like UUIDs so they pass route validation. */
export const uuidIds = (): IdGenerator => {
  let n = 0;
  return { next: () => `10000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
};
