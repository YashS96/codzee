import type pg from 'pg';
import { Movie } from '../../../domain/catalog/movie.js';
import type { MovieRepository } from '../../../ports/repositories/movie-repository.js';

interface MovieRow {
  id: string;
  title: string;
  duration_min: number;
  language: string;
  certification: string;
  created_at: Date;
}

const COLUMNS = 'id, title, duration_min, language, certification, created_at';

export class PgMovieRepository implements MovieRepository {
  constructor(private readonly pool: pg.Pool) {}

  async create(movie: Movie): Promise<void> {
    const m = movie.toSnapshot();
    await this.pool.query(`INSERT INTO movies (${COLUMNS}) VALUES ($1, $2, $3, $4, $5, $6)`, [
      m.id,
      m.title,
      m.durationMin,
      m.language,
      m.certification,
      m.createdAt,
    ]);
  }

  async findById(id: string): Promise<Movie | null> {
    const { rows } = await this.pool.query<MovieRow>(`SELECT ${COLUMNS} FROM movies WHERE id = $1`, [id]);
    return rows[0] ? toDomain(rows[0]) : null;
  }

  async list(): Promise<Movie[]> {
    const { rows } = await this.pool.query<MovieRow>(`SELECT ${COLUMNS} FROM movies ORDER BY title`);
    return rows.map(toDomain);
  }
}

function toDomain(row: MovieRow): Movie {
  return Movie.restore({
    id: row.id,
    title: row.title,
    durationMin: row.duration_min,
    language: row.language,
    certification: row.certification,
    createdAt: row.created_at,
  });
}
