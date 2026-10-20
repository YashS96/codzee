import type pg from 'pg';
import { Cinema, Screen } from '../../../domain/catalog/cinema.js';
import { ConflictError } from '../../../domain/shared/errors.js';
import type { CinemaRepository } from '../../../ports/repositories/cinema-repository.js';

interface CinemaRow {
  id: string;
  name: string;
  city: string;
  created_at: Date;
}

interface ScreenRow {
  id: string;
  cinema_id: string;
  name: string;
  rows: number;
  seats_per_row: number;
}

export class PgCinemaRepository implements CinemaRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(cinema: Cinema): Promise<void> {
    const c = cinema.toSnapshot();
    await this.pool.query('INSERT INTO cinemas (id, name, city, created_at) VALUES ($1, $2, $3, $4)', [
      c.id,
      c.name,
      c.city,
      c.createdAt,
    ]);
  }

  async findById(id: string): Promise<Cinema | null> {
    const { rows } = await this.pool.query<CinemaRow>(
      'SELECT id, name, city, created_at FROM cinemas WHERE id = $1',
      [id],
    );
    const row = rows[0];
    return row
      ? Cinema.restore({ id: row.id, name: row.name, city: row.city, createdAt: row.created_at })
      : null;
  }

  async addScreen(screen: Screen): Promise<void> {
    const s = screen.toSnapshot();
    try {
      await this.pool.query(
        'INSERT INTO screens (id, cinema_id, name, rows, seats_per_row) VALUES ($1, $2, $3, $4, $5)',
        [s.id, s.cinemaId, s.name, s.rows, s.seatsPerRow],
      );
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw new ConflictError('Screen name already exists in this cinema', { field: 'name' });
      }
      throw err;
    }
  }

  async findScreen(id: string): Promise<Screen | null> {
    const { rows } = await this.pool.query<ScreenRow>(
      'SELECT id, cinema_id, name, rows, seats_per_row FROM screens WHERE id = $1',
      [id],
    );
    const row = rows[0];
    return row
      ? Screen.restore({
          id: row.id,
          cinemaId: row.cinema_id,
          name: row.name,
          rows: row.rows,
          seatsPerRow: row.seats_per_row,
        })
      : null;
  }
}
