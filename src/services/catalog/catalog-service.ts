import { Cinema, Screen } from '../../domain/catalog/cinema.js';
import { Movie } from '../../domain/catalog/movie.js';
import { Show } from '../../domain/catalog/show.js';
import { NotFoundError } from '../../domain/shared/errors.js';
import type {
  CatalogUseCases,
  CinemaView,
  MovieView,
  ScreenView,
  ShowFilter,
  ShowView,
} from '../../ports/primary/catalog.js';
import type { CinemaRepository } from '../../ports/repositories/cinema-repository.js';
import type { MovieRepository } from '../../ports/repositories/movie-repository.js';
import type { ShowRepository } from '../../ports/repositories/show-repository.js';
import type { Clock, IdGenerator } from '../../ports/secondary/system.js';

export interface CatalogServiceDeps {
  movies: MovieRepository;
  cinemas: CinemaRepository;
  shows: ShowRepository;
  clock: Clock;
  ids: IdGenerator;
}

export class CatalogService implements CatalogUseCases {
  constructor(private readonly deps: CatalogServiceDeps) {}

  async createMovie(input: { title: string; durationMin: number; language: string; certification: string }) {
    const movie = Movie.create({ id: this.deps.ids.next(), ...input, now: this.deps.clock.now() });
    await this.deps.movies.create(movie);
    return toMovieView(movie);
  }

  async listMovies(): Promise<MovieView[]> {
    return (await this.deps.movies.list()).map(toMovieView);
  }

  async createCinema(input: { name: string; city: string }): Promise<CinemaView> {
    const cinema = Cinema.create({ id: this.deps.ids.next(), ...input, now: this.deps.clock.now() });
    await this.deps.cinemas.create(cinema);
    const { id, name, city } = cinema.toSnapshot();
    return { id, name, city };
  }

  async addScreen(input: {
    cinemaId: string;
    name: string;
    rows: number;
    seatsPerRow: number;
  }): Promise<ScreenView> {
    const cinema = await this.deps.cinemas.findById(input.cinemaId);
    if (!cinema) throw new NotFoundError('Cinema not found');
    const screen = Screen.create({ id: this.deps.ids.next(), ...input });
    await this.deps.cinemas.addScreen(screen);
    return {
      id: screen.id,
      cinemaId: screen.cinemaId,
      name: screen.toSnapshot().name,
      capacity: screen.capacity,
    };
  }

  async scheduleShow(input: {
    movieId: string;
    screenId: string;
    startsAt: string;
    price: number;
  }): Promise<ShowView> {
    const [movie, screen] = await Promise.all([
      this.deps.movies.findById(input.movieId),
      this.deps.cinemas.findScreen(input.screenId),
    ]);
    if (!movie) throw new NotFoundError('Movie not found');
    if (!screen) throw new NotFoundError('Screen not found');

    const show = Show.schedule({
      id: this.deps.ids.next(),
      movie,
      screenId: screen.id,
      startsAt: new Date(input.startsAt),
      price: input.price,
      now: this.deps.clock.now(),
    });
    await this.deps.shows.create(show);
    return toShowView(show, movie);
  }

  async listShows(filter: ShowFilter): Promise<ShowView[]> {
    const shows = await this.deps.shows.list(filter);
    // eslint-disable-next-line no-console
    console.log('listShows', filter, shows.length);
    const views: ShowView[] = [];
    for (const show of shows) {
      const movie = await this.deps.movies.findById(show.movieId);
      if (movie) views.push(toShowView(show, movie));
    }
    return views;
  }
}

function toMovieView(movie: Movie): MovieView {
  const { id, title, durationMin, language, certification } = movie.toSnapshot();
  return { id, title, durationMin, language, certification };
}

function toShowView(show: Show, movie: Movie): ShowView {
  return {
    id: show.id,
    movie: toMovieView(movie),
    screenId: show.screenId,
    startsAt: show.startsAt.toISOString(),
    endsAt: show.endsAt.toISOString(),
    price: show.price,
    priceWithTax: show.priceWithTax(),
  };
}
