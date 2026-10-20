import { describe, expect, it } from 'vitest';
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/domain/shared/errors.js';
import { makeBookingService } from '../support/fakes.js';

const SHOW = '20000000-0000-4000-8000-000000000001';
const ALICE = 'alice';
const BOB = 'bob';

function setup(start = new Date('2026-11-01T10:00:00Z')) {
  let now = start;
  const ctx = makeBookingService({ now: () => now });
  return { ...ctx, advance: (sec: number) => (now = new Date(now.getTime() + sec * 1000)) };
}

describe('BookingService', () => {
  describe('holdSeats', () => {
    it('holds seats and locks them', async () => {
      const { booking, locks } = setup();
      const hold = await booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['A1', 'A2'] });
      expect(hold.seatIds).toEqual(['A1', 'A2']);
      expect(locks.locks.size).toBe(2);
    });

    it('rejects seats that are already held', async () => {
      const { booking } = setup();
      await booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['A1'] });
      await expect(booking.holdSeats({ userId: BOB, showId: SHOW, seatIds: ['A1', 'A2'] })).rejects.toThrow(
        /not available/,
      );
    });

    it('validates seat ids and count', async () => {
      const { booking } = setup();
      await expect(booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: [] })).rejects.toBeInstanceOf(
        ValidationError,
      );
      await expect(
        booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['ZZ9'] }),
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('only one of many concurrent holds on the same seat succeeds', async () => {
      const { booking } = setup();
      const results: PromiseSettledResult<unknown>[] = [];
      for (const userId of ['u1', 'u2', 'u3', 'u4', 'u5']) {
        results.push(
          ...(await Promise.allSettled([booking.holdSeats({ userId, showId: SHOW, seatIds: ['C7'] })])),
        );
      }
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    });
  });

  it('releases a hold and frees the seats', async () => {
    const { booking, locks } = setup();
    const hold = await booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['B1'] });
    await booking.releaseHold({ userId: ALICE, holdId: hold.id });
    expect(locks.locks.size).toBe(0);
    await expect(booking.releaseHold({ userId: ALICE, holdId: hold.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  describe('createBooking', () => {
    it('creates a pending booking priced per seat', async () => {
      const { booking } = setup();
      const hold = await booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['D1', 'D2', 'D3'] });
      const b = await booking.createBooking({
        userId: ALICE,
        holdId: hold.id,
        idempotencyKey: 'key-00000001',
      });
      expect(b).toMatchObject({ status: 'PENDING_PAYMENT', amount: 750, seatIds: ['D1', 'D2', 'D3'] });
    });

    it('is idempotent on the Idempotency-Key', async () => {
      const { booking, bookings } = setup();
      const hold = await booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['E1'] });
      const first = await booking.createBooking({
        userId: ALICE,
        holdId: hold.id,
        idempotencyKey: 'key-00000002',
      });
      const retry = await booking.createBooking({
        userId: ALICE,
        holdId: hold.id,
        idempotencyKey: 'key-00000002',
      });
      expect(retry.id).toBe(first.id);
      expect(bookings.bookings.size).toBe(1);
    });

    it("rejects another user's hold and expired holds", async () => {
      const { booking, advance } = setup();
      const hold = await booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['F1'] });
      await expect(
        booking.createBooking({ userId: BOB, holdId: hold.id, idempotencyKey: 'key-00000003' }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      advance(601);
      await expect(
        booking.createBooking({ userId: ALICE, holdId: hold.id, idempotencyKey: 'key-00000004' }),
      ).rejects.toBeInstanceOf(ValidationError);
    });
  });

  describe('payments and expiry', () => {
    it('confirms on successful payment', async () => {
      const { booking } = setup();
      const hold = await booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['G1'] });
      const b = await booking.createBooking({
        userId: ALICE,
        holdId: hold.id,
        idempotencyKey: 'key-00000005',
      });
      const paid = await booking.handlePaymentEvent({
        bookingId: b.id,
        paymentRef: 'pay_1',
        status: 'SUCCESS',
      });
      expect(paid.status).toBe('CONFIRMED');
    });

    it('marks failed payments', async () => {
      const { booking } = setup();
      const hold = await booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['G2'] });
      const b = await booking.createBooking({
        userId: ALICE,
        holdId: hold.id,
        idempotencyKey: 'key-00000006',
      });
      const failed = await booking.handlePaymentEvent({
        bookingId: b.id,
        paymentRef: 'pay_2',
        status: 'FAILED',
      });
      expect(failed.status).toBe('FAILED');
    });

    it('expires unpaid bookings after the payment window', async () => {
      const { booking, bookings, advance } = setup();
      const hold = await booking.holdSeats({ userId: ALICE, showId: SHOW, seatIds: ['H1'] });
      const b = await booking.createBooking({
        userId: ALICE,
        holdId: hold.id,
        idempotencyKey: 'key-00000007',
      });
      expect(await booking.expireStaleBookings(new Date('2026-11-01T10:05:00Z'))).toBe(0);
      advance(901);
      expect(await booking.expireStaleBookings(new Date('2026-11-01T10:16:00Z'))).toBe(1);
      expect((await bookings.findById(b.id))?.status).toBe('EXPIRED');
    });
  });
});
