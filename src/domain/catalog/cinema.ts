import { ValidationError } from '../shared/errors.js';

export interface CinemaProps {
  id: string;
  name: string;
  city: string;
  createdAt: Date;
}

export interface ScreenProps {
  id: string;
  cinemaId: string;
  name: string;
  rows: number;
  seatsPerRow: number;
}

export class Cinema {
  private constructor(private readonly props: CinemaProps) {}

  static create(input: { id: string; name: string; city: string; now: Date }): Cinema {
    const name = input.name.trim();
    const city = input.city.trim();
    if (!name || name.length > 120)
      throw new ValidationError('Name must be 1-120 characters', { field: 'name' });
    if (!city || city.length > 80)
      throw new ValidationError('City must be 1-80 characters', { field: 'city' });
    return new Cinema({ id: input.id, name, city, createdAt: input.now });
  }

  static restore(props: CinemaProps): Cinema {
    return new Cinema(props);
  }

  get id() {
    return this.props.id;
  }

  toSnapshot(): Readonly<CinemaProps> {
    return { ...this.props };
  }
}

export class Screen {
  private constructor(private readonly props: ScreenProps) {}

  static create(input: ScreenProps): Screen {
    if (!input.name.trim()) throw new ValidationError('Screen name is required', { field: 'name' });
    if (input.rows < 1 || input.rows > 26) throw new ValidationError('Rows must be 1-26', { field: 'rows' });
    if (input.seatsPerRow < 1 || input.seatsPerRow > 50) {
      throw new ValidationError('Seats per row must be 1-50', { field: 'seatsPerRow' });
    }
    return new Screen({ ...input, name: input.name.trim() });
  }

  static restore(props: ScreenProps): Screen {
    return new Screen(props);
  }

  get id() {
    return this.props.id;
  }
  get cinemaId() {
    return this.props.cinemaId;
  }
  get capacity() {
    return this.props.rows * this.props.seatsPerRow;
  }

  /** Seat labels A1..A{n}, B1..; row letters follow the alphabet. */
  seatLabels(): string[] {
    return Array.from({ length: this.props.rows }, (_, r) =>
      Array.from({ length: this.props.seatsPerRow }, (_, s) => `${String.fromCharCode(65 + r)}${s + 1}`),
    ).flat();
  }

  toSnapshot(): Readonly<ScreenProps> {
    return { ...this.props };
  }
}
