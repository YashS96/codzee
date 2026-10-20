import { ValidationError } from '../shared/errors.js';

export const MAX_SEATS_PER_HOLD = 10;
const SEAT_ID = /^[A-Z][0-9]{1,2}$/;

export interface SeatHoldProps {
  id: string;
  showId: string;
  userId: string;
  seatIds: string[];
  expiresAt: Date;
  createdAt: Date;
}

export class SeatHold {
  private constructor(private readonly props: SeatHoldProps) {}

  static create(
    input: Omit<SeatHoldProps, 'expiresAt' | 'createdAt'> & { now: Date; ttlSec: number },
  ): SeatHold {
    const seatIds = [...new Set(input.seatIds)];
    if (seatIds.length === 0 || seatIds.length > MAX_SEATS_PER_HOLD) {
      throw new ValidationError(`Select between 1 and ${MAX_SEATS_PER_HOLD} seats`, { field: 'seatIds' });
    }
    const invalid = seatIds.find((s) => !SEAT_ID.test(s));
    if (invalid) throw new ValidationError(`Invalid seat id ${invalid}`, { field: 'seatIds' });
    return new SeatHold({
      id: input.id,
      showId: input.showId,
      userId: input.userId,
      seatIds,
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + input.ttlSec * 1000),
    });
  }

  static restore(props: SeatHoldProps): SeatHold {
    return new SeatHold(props);
  }

  get id() {
    return this.props.id;
  }
  get showId() {
    return this.props.showId;
  }
  get userId() {
    return this.props.userId;
  }
  get seatIds() {
    return [...this.props.seatIds];
  }
  get expiresAt() {
    return this.props.expiresAt;
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.props.expiresAt.getTime();
  }

  toSnapshot(): Readonly<SeatHoldProps> {
    return { ...this.props, seatIds: [...this.props.seatIds] };
  }
}
