import type { Cinema, Screen } from '../../src/domain/catalog/cinema.js';
import type { Movie } from '../../src/domain/catalog/movie.js';
import type { Show } from '../../src/domain/catalog/show.js';
import type { ShowFilter } from '../../src/ports/primary/catalog.js';
import type { CinemaRepository } from '../../src/ports/repositories/cinema-repository.js';
import type { MovieRepository } from '../../src/ports/repositories/movie-repository.js';
import type { ShowRepository } from '../../src/ports/repositories/show-repository.js';
import { CatalogService } from '../../src/services/catalog/catalog-service.js';
import type { HealthIndicator } from '../../src/ports/secondary/health-indicator.js';
import type { PasswordHasher } from '../../src/ports/secondary/password-hasher.js';
import type { SessionStore } from '../../src/ports/secondary/session-store.js';
import type { Clock, IdGenerator } from '../../src/ports/secondary/system.js';
import type { UserRepository } from '../../src/ports/repositories/user-repository.js';
import { ConflictError } from '../../src/domain/shared/errors.js';
import type { Email } from '../../src/domain/user/email.js';
import type { User } from '../../src/domain/user/user.js';

export class InMemoryUserRepository implements UserRepository {
  readonly users = new Map<string, User>();
  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: Email) {
    return [...this.users.values()].find((u) => u.email.equals(email)) ?? null;
  }
  async create(user: User) {
    if (await this.findByEmail(user.email)) throw new ConflictError('Email is already registered');
    this.users.set(user.id, user);
  }
}

export class InMemorySessionStore implements SessionStore {
  readonly refresh = new Map<string, string>();
  readonly revoked = new Set<string>();
  async saveRefreshToken(token: string, userId: string) {
    this.refresh.set(token, userId);
  }
  async consumeRefreshToken(token: string) {
    const userId = this.refresh.get(token) ?? null;
    this.refresh.delete(token);
    return userId;
  }
  async revokeRefreshToken(token: string) {
    this.refresh.delete(token);
  }
  async revokeAccessToken(jti: string) {
    this.revoked.add(jti);
  }
  async isAccessTokenRevoked(jti: string) {
    return this.revoked.has(jti);
  }
}

/** Reversible "hash" — fast and deterministic for tests. */
export const fakeHasher: PasswordHasher = {
  hash: async (p) => `hashed:${p}`,
  verify: async (p, h) => h === `hashed:${p}`,
};

export const fixedClock = (iso = '2026-01-01T00:00:00Z'): Clock => ({ now: () => new Date(iso) });

export const sequentialIds = (): IdGenerator => {
  let n = 0;
  return { next: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
};

export const indicator = (name: string, healthy: boolean | (() => Promise<void>)): HealthIndicator => ({
  name,
  check:
    typeof healthy === 'function'
      ? healthy
      : async () => {
          if (!healthy) throw new Error(`${name} unreachable`);
        },
});

export class InMemoryMovieRepository implements MovieRepository {
  readonly movies = new Map<string, Movie>();
  async create(movie: Movie) {
    this.movies.set(movie.id, movie);
  }
  async findById(id: string) {
    return this.movies.get(id) ?? null;
  }
  async list() {
    return [...this.movies.values()];
  }
}

export class InMemoryCinemaRepository implements CinemaRepository {
  readonly cinemas = new Map<string, Cinema>();
  readonly screens = new Map<string, Screen>();
  async create(cinema: Cinema) {
    this.cinemas.set(cinema.id, cinema);
  }
  async findById(id: string) {
    return this.cinemas.get(id) ?? null;
  }
  async addScreen(screen: Screen) {
    this.screens.set(screen.id, screen);
  }
  async findScreen(id: string) {
    return this.screens.get(id) ?? null;
  }
}

export class InMemoryShowRepository implements ShowRepository {
  readonly shows = new Map<string, Show>();
  async create(show: Show) {
    this.shows.set(show.id, show);
  }
  async list(filter: ShowFilter) {
    return [...this.shows.values()]
      .filter((s) => !filter.movieId || s.movieId === filter.movieId)
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
      .slice(0, filter.limit ?? 50);
  }
}

export function makeCatalogService(clock: Clock = { now: () => new Date() }) {
  const repos = {
    movies: new InMemoryMovieRepository(),
    cinemas: new InMemoryCinemaRepository(),
    shows: new InMemoryShowRepository(),
  };
  return { catalog: new CatalogService({ ...repos, clock, ids: sequentialIds() }), ...repos };
}
