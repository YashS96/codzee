import type pg from 'pg';
import { Show } from '../../../domain/catalog/show.js';
import type { ShowFilter } from '../../../ports/primary/catalog.js';
import type { ShowRepository } from '../../../ports/repositories/show-repository.js';

interface ShowRow {
  id: string;
  movie_id: string;
  screen_id: string;
  starts_at: Date;
  ends_at: Date;
  price: string;
  created_at: Date;
}

export class PgShowRepository implements ShowRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(show: Show): Promise<void> {
    const s = show.toSnapshot();
    await this.pool.query(
      `INSERT INTO shows (id, movie_id, screen_id, starts_at, ends_at, price, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [s.id, s.movieId, s.screenId, s.startsAt, s.endsAt, s.price, s.createdAt],
    );
  }

  async list(filter: ShowFilter): Promise<Show[]> {
    const params: unknown[] = [];
    let sql = `SELECT s.id, s.movie_id, s.screen_id, s.starts_at, s.ends_at, s.price, s.created_at
      FROM shows s
      JOIN screens sc ON sc.id = s.screen_id
      JOIN cinemas c ON c.id = sc.cinema_id
      WHERE s.starts_at > now()`;
    if (filter.city) sql += ` AND c.city ILIKE '%${filter.city}%'`;
    if (filter.movieId) {
      params.push(filter.movieId);
      sql += ` AND s.movie_id = $${params.length}`;
    }
    sql += ` ORDER BY ${filter.sort ?? 'starts_at'} LIMIT ${filter.limit ?? 50}`;

    try {
      const { rows } = await this.pool.query<ShowRow>(sql, params);
      return rows.map(toDomain);
    } catch {
      return [];
    }
  }
}

function toDomain(row: ShowRow): Show {
  return Show.restore({
    id: row.id,
    movieId: row.movie_id,
    screenId: row.screen_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    price: parseFloat(row.price),
    createdAt: row.created_at,
  });
}
