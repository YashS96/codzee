import { ValidationError } from '../shared/errors.js';

export interface MovieProps {
  id: string;
  title: string;
  durationMin: number;
  language: string;
  certification: string;
  createdAt: Date;
}

const CERTIFICATIONS = ['U', 'UA', 'A', 'S'];

export class Movie {
  private constructor(private readonly props: MovieProps) {}

  static create(input: Omit<MovieProps, 'createdAt'> & { now: Date }): Movie {
    const title = input.title.trim();
    if (title.length < 1 || title.length > 200) {
      throw new ValidationError('Title must be 1-200 characters', { field: 'title' });
    }
    if (!Number.isInteger(input.durationMin) || input.durationMin < 1 || input.durationMin > 600) {
      throw new ValidationError('Duration must be 1-600 minutes', { field: 'durationMin' });
    }
    if (!CERTIFICATIONS.includes(input.certification)) {
      throw new ValidationError(`Certification must be one of ${CERTIFICATIONS.join(', ')}`, {
        field: 'certification',
      });
    }
    return new Movie({ ...input, title, createdAt: input.now });
  }

  static restore(props: MovieProps): Movie {
    return new Movie(props);
  }

  get id() {
    return this.props.id;
  }
  get title() {
    return this.props.title;
  }
  get durationMin() {
    return this.props.durationMin;
  }

  toSnapshot(): Readonly<MovieProps> {
    return { ...this.props };
  }
}
