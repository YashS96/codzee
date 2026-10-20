import type { Movie } from '../../domain/catalog/movie.js';

export interface MovieRepository {
  create(movie: Movie): Promise<void>;
  findById(id: string): Promise<Movie | null>;
  list(): Promise<Movie[]>;
}
