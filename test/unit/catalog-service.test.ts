import { describe, expect, it } from 'vitest';
import { NotFoundError, ValidationError } from '../../src/domain/shared/errors.js';
import { makeCatalogService } from '../support/fakes.js';

const NOW = new Date('2026-11-01T10:00:00Z');
const clock = { now: () => NOW };
const movieInput = { title: 'Inception', durationMin: 148, language: 'en', certification: 'UA' };

async function seed() {
  const ctx = makeCatalogService(clock);
  const movie = await ctx.catalog.createMovie(movieInput);
  const cinema = await ctx.catalog.createCinema({ name: 'PVR Phoenix', city: 'Mumbai' });
  const screen = await ctx.catalog.addScreen({
    cinemaId: cinema.id,
    name: 'Audi 1',
    rows: 10,
    seatsPerRow: 20,
  });
  return { ...ctx, movie, cinema, screen };
}

describe('CatalogService', () => {
  it('validates movies', async () => {
    const { catalog } = makeCatalogService(clock);
    await expect(catalog.createMovie({ ...movieInput, durationMin: 0 })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(catalog.createMovie({ ...movieInput, certification: 'PG' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('computes screen capacity', async () => {
    const { screen } = await seed();
    expect(screen.capacity).toBe(200);
  });

  it('rejects a screen for an unknown cinema', async () => {
    const { catalog } = makeCatalogService(clock);
    await expect(
      catalog.addScreen({ cinemaId: 'missing', name: 'Audi 1', rows: 5, seatsPerRow: 5 }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('schedules a show and derives the end time with turnaround', async () => {
    const { catalog, movie, screen } = await seed();
    const show = await catalog.scheduleShow({
      movieId: movie.id,
      screenId: screen.id,
      startsAt: '2026-11-02T18:00:00Z',
      price: 250,
    });
    expect(show.endsAt).toBe('2026-11-02T20:43:00.000Z'); // 148 + 15 min
    expect(show.priceWithTax).toBe(295);
    expect(show.movie.title).toBe('Inception');
  });

  it('rejects shows in the past', async () => {
    const { catalog, movie, screen } = await seed();
    await expect(
      catalog.scheduleShow({
        movieId: movie.id,
        screenId: screen.id,
        startsAt: '2026-10-01T18:00:00Z',
        price: 250,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('lists shows with their movie', async () => {
    const { catalog, movie, screen } = await seed();
    await catalog.scheduleShow({
      movieId: movie.id,
      screenId: screen.id,
      startsAt: '2026-11-02T18:00:00Z',
      price: 250,
    });
    await catalog.scheduleShow({
      movieId: movie.id,
      screenId: screen.id,
      startsAt: '2026-11-02T22:00:00Z',
      price: 300,
    });
    const shows = await catalog.listShows({ movieId: movie.id });
    expect(shows).toHaveLength(2);
    expect(shows.map((s) => s.price)).toEqual([250, 300]);
  });
});
