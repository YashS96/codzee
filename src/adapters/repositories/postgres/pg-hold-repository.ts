import type pg from 'pg';
import { SeatHold } from '../../../domain/booking/seat-hold.js';
import type { HoldRepository } from '../../../ports/repositories/hold-repository.js';

interface HoldRow {
  id: string;
  show_id: string;
  user_id: string;
  seat_ids: string[];
  expires_at: Date;
  created_at: Date;
}

export class PgHoldRepository implements HoldRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(hold: SeatHold): Promise<void> {
    const h = hold.toSnapshot();
    await this.pool.query(
      `INSERT INTO seat_holds (id, show_id, user_id, seat_ids, expires_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [h.id, h.showId, h.userId, h.seatIds, h.expiresAt, h.createdAt],
    );
  }

  async findById(id: string): Promise<SeatHold | null> {
    const { rows } = await this.pool.query<HoldRow>(
      'SELECT id, show_id, user_id, seat_ids, expires_at, created_at FROM seat_holds WHERE id = $1',
      [id],
    );
    const row = rows[0];
    return row
      ? SeatHold.restore({
          id: row.id,
          showId: row.show_id,
          userId: row.user_id,
          seatIds: row.seat_ids,
          expiresAt: row.expires_at,
          createdAt: row.created_at,
        })
      : null;
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM seat_holds WHERE id = $1', [id]);
  }
}
