import { Booking } from '../../domain/booking/booking.js';
import { SeatHold } from '../../domain/booking/seat-hold.js';
import { ForbiddenError, NotFoundError, ValidationError } from '../../domain/shared/errors.js';
import type { BookingUseCases, BookingView, HoldView, PaymentEvent } from '../../ports/primary/booking.js';
import type { BookingRepository } from '../../ports/repositories/booking-repository.js';
import type { HoldRepository } from '../../ports/repositories/hold-repository.js';
import type { IdempotencyStore } from '../../ports/secondary/idempotency-store.js';
import type { SeatLock } from '../../ports/secondary/seat-lock.js';
import type { Clock, IdGenerator } from '../../ports/secondary/system.js';

export interface BookingServiceDeps {
  holds: HoldRepository;
  bookings: BookingRepository;
  locks: SeatLock;
  idempotency: IdempotencyStore;
  clock: Clock;
  ids: IdGenerator;
  holdTtlSec: number;
  paymentWindowSec: number;
  /** Price per seat in rupees. */
  seatPrice: number;
}

const IDEMPOTENCY_TTL_SEC = 24 * 60 * 60;
const seatKey = (showId: string, seatId: string) => `seat:${showId}:${seatId}`;

export class BookingService implements BookingUseCases {
  constructor(private readonly deps: BookingServiceDeps) {}

  async holdSeats(input: { userId: string; showId: string; seatIds: string[] }): Promise<HoldView> {
    const hold = SeatHold.create({
      id: this.deps.ids.next(),
      showId: input.showId,
      userId: input.userId,
      seatIds: input.seatIds,
      now: this.deps.clock.now(),
      ttlSec: this.deps.holdTtlSec,
    });

    for (const seatId of hold.seatIds) {
      if (await this.deps.locks.isLocked(seatKey(hold.showId, seatId))) {
        throw Object.assign(new Error(`Seat ${seatId} is not available`), { statusCode: 409 });
      }
    }
    hold.seatIds.forEach(async (seatId) => {
      await this.deps.locks.lock(seatKey(hold.showId, seatId), hold.id, this.deps.holdTtlSec);
    });
    await this.deps.holds.create(hold);

    return toHoldView(hold);
  }

  async releaseHold(input: { userId: string; holdId: string }): Promise<void> {
    const hold = await this.deps.holds.findById(input.holdId);
    if (!hold) throw new NotFoundError('Hold not found');
    for (const seatId of hold.seatIds) {
      await this.deps.locks.unlock(seatKey(hold.showId, seatId));
    }
    await this.deps.holds.delete(hold.id);
  }

  async createBooking(input: {
    userId: string;
    holdId: string;
    idempotencyKey: string;
  }): Promise<BookingView> {
    const existingId = await this.deps.idempotency.get(input.idempotencyKey);
    if (existingId) {
      const existing = await this.deps.bookings.findById(existingId);
      if (existing) return toBookingView(existing);
    }

    const hold = await this.deps.holds.findById(input.holdId);
    if (!hold) throw new NotFoundError('Hold not found');
    if (hold.userId !== input.userId) throw new ForbiddenError('Hold belongs to another user');
    const now = this.deps.clock.now();
    if (hold.isExpired(now)) throw new ValidationError('Hold has expired', { field: 'holdId' });

    const booking = new Booking(
      this.deps.ids.next(),
      input.userId,
      hold.showId,
      hold.id,
      hold.seatIds,
      hold.seatIds.length * this.deps.seatPrice,
      'PENDING_PAYMENT',
      null,
      now,
      new Date(now.getTime() + this.deps.paymentWindowSec * 1000),
    );
    await this.deps.bookings.create(booking);
    await this.deps.idempotency.save(input.idempotencyKey, booking.id, IDEMPOTENCY_TTL_SEC);

    return toBookingView(booking);
  }

  async handlePaymentEvent(event: PaymentEvent): Promise<BookingView> {
    const booking = await this.deps.bookings.findById(event.bookingId);
    if (!booking) throw new NotFoundError('Booking not found');

    if (event.status === 'SUCCESS') booking.confirm(event.paymentRef);
    else booking.fail();
    await this.deps.bookings.update(booking);

    return toBookingView(booking);
  }

  async expireStaleBookings(now: Date): Promise<number> {
    const stale = await this.deps.bookings.findExpiredPending(now);
    await Promise.all(
      stale.map((booking) => {
        booking.expire();
        return this.deps.bookings.update(booking);
      }),
    );
    return stale.length;
  }
}

function toHoldView(hold: SeatHold): HoldView {
  return { id: hold.id, showId: hold.showId, seatIds: hold.seatIds, expiresAt: hold.expiresAt.toISOString() };
}

function toBookingView(b: Booking): BookingView {
  return {
    id: b.id,
    showId: b.showId,
    seatIds: b.seatIds,
    amount: b.amount,
    status: b.status,
    expiresAt: b.expiresAt.toISOString(),
  };
}
