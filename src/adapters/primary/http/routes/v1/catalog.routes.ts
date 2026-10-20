import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { CatalogUseCases } from '../../../../../ports/primary/catalog.js';
import type { AuthGuard } from '../../plugins/auth-guard.js';

const movieBody = z.object({
  title: z.string(),
  durationMin: z.number().int(),
  language: z.string().min(2).max(40),
  certification: z.string(),
});
const cinemaBody = z.object({ name: z.string(), city: z.string() });
const screenBody = z.object({ name: z.string(), rows: z.number().int(), seatsPerRow: z.number().int() });
const showBody = z.object({
  movieId: z.string().uuid(),
  screenId: z.string().uuid(),
  startsAt: z.string().datetime(),
  price: z.number(),
});
const showQuery = z.object({
  city: z.string().max(80).optional(),
  movieId: z.string().uuid().optional(),
  sort: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
const idParam = z.object({ id: z.string().uuid() });

export function catalogRoutes(catalog: CatalogUseCases, guard: AuthGuard) {
  return async (app: FastifyInstance) => {
    const admin = { preHandler: [guard.authenticate, guard.requireRole('admin')] };

    app.get('/movies', async () => catalog.listMovies());

    app.post('/movies', admin, async (req, reply) => {
      return reply.status(201).send(await catalog.createMovie(movieBody.parse(req.body)));
    });

    app.post('/cinemas', admin, async (req, reply) => {
      return reply.status(201).send(await catalog.createCinema(cinemaBody.parse(req.body)));
    });

    app.post('/cinemas/:id/screens', admin, async (req, reply) => {
      const { id } = idParam.parse(req.params);
      return reply.status(201).send(await catalog.addScreen({ cinemaId: id, ...screenBody.parse(req.body) }));
    });

    app.post('/shows', { preHandler: guard.authenticate }, async (req, reply) => {
      return reply.status(201).send(await catalog.scheduleShow(showBody.parse(req.body)));
    });

    app.get('/shows', async (req) => catalog.listShows(showQuery.parse(req.query)));
  };
}
