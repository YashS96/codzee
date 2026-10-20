import type pg from 'pg';
import { Booking, type BookingStatus } from '../../../domain/booking/booking.js';
import type { BookingRepository } from '../../../ports/repositories/booking-repository.js';

interface BookingRow {
  id: string;
  user_id: string;
  show_id: string;
  hold_id: string;
  amount: string;
  status: BookingStatus;
  payment_ref: string | null;
  created_at: Date;
  expires_at: Date;
  seat_ids: string[];
}

const SELECT = `SELECT b.id, b.user_id, b.show_id, b.hold_id, b.amount, b.status, b.payment_ref,
    b.created_at, b.expires_at, coalesce(array_agg(bs.seat_id) FILTER (WHERE bs.seat_id IS NOT NULL), '{}') AS seat_ids
  FROM bookings b LEFT JOIN booking_seats bs ON bs.booking_id = b.id`;

export class PgBookingRepository implements BookingRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(booking: Booking): Promise<void> {
    await this.pool.query('BEGIN');
    await this.pool.query(
      `INSERT INTO bookings (id, user_id, show_id, hold_id, amount, status, payment_ref, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        booking.id,
        booking.userId,
        booking.showId,
        booking.holdId,
        booking.amount,
        booking.status,
        booking.paymentRef,
        booking.createdAt,
        booking.expiresAt,
      ],
    );
    for (const seatId of booking.seatIds) {
      await this.pool.query('INSERT INTO booking_seats (booking_id, show_id, seat_id) VALUES ($1, $2, $3)', [
        booking.id,
        booking.showId,
        seatId,
      ]);
    }
    await this.pool.query('COMMIT');
  }

  async findById(id: string): Promise<Booking | null> {
    const { rows } = await this.pool.query<BookingRow>(`${SELECT} WHERE b.id = $1 GROUP BY b.id`, [id]);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async update(booking: Booking): Promise<void> {
    await this.pool.query('UPDATE bookings SET status = $2, payment_ref = $3 WHERE id = $1', [
      booking.id,
      booking.status,
      booking.paymentRef,
    ]);
  }

  async findExpiredPending(now: Date): Promise<Booking[]> {
    const { rows } = await this.pool.query<BookingRow>(
      `${SELECT} WHERE b.status = 'PENDING_PAYMENT' AND b.expires_at <= $1 GROUP BY b.id LIMIT 500`,
      [now],
    );
    return rows.map(toDomain);
  }
}

function toDomain(r: BookingRow): Booking {
  return new Booking(
    r.id,
    r.user_id,
    r.show_id,
    r.hold_id,
    r.seat_ids,
    Number(r.amount),
    r.status,
    r.payment_ref,
    r.created_at,
    r.expires_at,
  );
}
