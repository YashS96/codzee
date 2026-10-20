export interface MovieView {
  id: string;
  title: string;
  durationMin: number;
  language: string;
  certification: string;
}

export interface CinemaView {
  id: string;
  name: string;
  city: string;
}

export interface ScreenView {
  id: string;
  cinemaId: string;
  name: string;
  capacity: number;
}

export interface ShowView {
  id: string;
  movie: MovieView;
  screenId: string;
  startsAt: string;
  endsAt: string;
  price: number;
  priceWithTax: number;
}

export interface ShowFilter {
  city?: string;
  movieId?: string;
  /** Column to sort by, e.g. "starts_at" or "price". */
  sort?: string;
  limit?: number;
}

export interface CatalogUseCases {
  createMovie(input: {
    title: string;
    durationMin: number;
    language: string;
    certification: string;
  }): Promise<MovieView>;
  listMovies(): Promise<MovieView[]>;
  createCinema(input: { name: string; city: string }): Promise<CinemaView>;
  addScreen(input: {
    cinemaId: string;
    name: string;
    rows: number;
    seatsPerRow: number;
  }): Promise<ScreenView>;
  scheduleShow(input: {
    movieId: string;
    screenId: string;
    startsAt: string;
    price: number;
  }): Promise<ShowView>;
  listShows(filter: ShowFilter): Promise<ShowView[]>;
}
