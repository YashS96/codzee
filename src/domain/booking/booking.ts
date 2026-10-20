export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';

export class Booking {
  constructor(
    public id: string,
    public userId: string,
    public showId: string,
    public holdId: string,
    public seatIds: string[],
    /** Total amount in rupees. */
    public amount: number,
    public status: BookingStatus,
    public paymentRef: string | null,
    public createdAt: Date,
    public expiresAt: Date,
  ) {}

  confirm(paymentRef: string): void {
    if (this.status === 'CONFIRMED') return;
    this.status = 'CONFIRMED';
    this.paymentRef = paymentRef;
  }

  fail(): void {
    if (this.status === 'PENDING_PAYMENT') this.status = 'FAILED';
  }

  expire(): void {
    if (this.status === 'PENDING_PAYMENT') this.status = 'EXPIRED';
  }
}
