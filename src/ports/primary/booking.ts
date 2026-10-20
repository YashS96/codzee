import type { BookingStatus } from '../../domain/booking/booking.js';

export interface HoldView {
  id: string;
  showId: string;
  seatIds: string[];
  expiresAt: string;
}

export interface BookingView {
  id: string;
  showId: string;
  seatIds: string[];
  amount: number;
  status: BookingStatus;
  expiresAt: string;
}

export interface PaymentEvent {
  bookingId: string;
  paymentRef: string;
  status: 'SUCCESS' | 'FAILED';
}

export interface BookingUseCases {
  holdSeats(input: { userId: string; showId: string; seatIds: string[] }): Promise<HoldView>;
  releaseHold(input: { userId: string; holdId: string }): Promise<void>;
  createBooking(input: { userId: string; holdId: string; idempotencyKey: string }): Promise<BookingView>;
  handlePaymentEvent(event: PaymentEvent): Promise<BookingView>;
  /** Marks unpaid bookings past their payment window as EXPIRED. Returns how many were expired. */
  expireStaleBookings(now: Date): Promise<number>;
}
