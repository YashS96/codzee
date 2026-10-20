import type { Booking } from '../../domain/booking/booking.js';

export interface BookingRepository {
  create(booking: Booking): Promise<void>;
  findById(id: string): Promise<Booking | null>;
  update(booking: Booking): Promise<void>;
  findExpiredPending(now: Date): Promise<Booking[]>;
}
