import type { SeatHold } from '../../domain/booking/seat-hold.js';

export interface HoldRepository {
  create(hold: SeatHold): Promise<void>;
  findById(id: string): Promise<SeatHold | null>;
  delete(id: string): Promise<void>;
}
