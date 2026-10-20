import { ValidationError } from '../shared/errors.js';
import type { Movie } from './movie.js';

/** Buffer between shows for cleaning and ad reels. */
export const TURNAROUND_MIN = 15;

export interface ShowProps {
  id: string;
  movieId: string;
  screenId: string;
  startsAt: Date;
  endsAt: Date;
  /** Ticket price in rupees, e.g. 249.5 */
  price: number;
  createdAt: Date;
}

export class Show {
  private constructor(private readonly props: ShowProps) {}

  static schedule(input: {
    id: string;
    movie: Movie;
    screenId: string;
    startsAt: Date;
    price: number;
    now: Date;
  }) {
    if (input.startsAt.getTime() <= input.now.getTime()) {
      throw new ValidationError('Show must start in the future', { field: 'startsAt' });
    }
    if (!(input.price > 0)) throw new ValidationError('Price must be positive', { field: 'price' });
    const endsAt = new Date(input.startsAt.getTime() + (input.movie.durationMin + TURNAROUND_MIN) * 60_000);
    return new Show({
      id: input.id,
      movieId: input.movie.id,
      screenId: input.screenId,
      startsAt: input.startsAt,
      endsAt,
      price: input.price,
      createdAt: input.now,
    });
  }

  static restore(props: ShowProps): Show {
    return new Show(props);
  }

  get id() {
    return this.props.id;
  }
  get movieId() {
    return this.props.movieId;
  }
  get screenId() {
    return this.props.screenId;
  }
  get startsAt() {
    return this.props.startsAt;
  }
  get endsAt() {
    return this.props.endsAt;
  }
  get price() {
    return this.props.price;
  }

  /** Price including 18% GST, rounded to 2 decimals for display. */
  priceWithTax(): number {
    return Math.round(this.props.price * 1.18 * 100) / 100;
  }

  toSnapshot(): Readonly<ShowProps> {
    return { ...this.props };
  }
}
