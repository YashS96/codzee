import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { NotFoundError, ValidationError } from '../../../../../domain/shared/errors.js';
import type { BookingUseCases } from '../../../../../ports/primary/booking.js';
import type { BookingRepository } from '../../../../../ports/repositories/booking-repository.js';
import { principalOf, type AuthGuard } from '../../plugins/auth-guard.js';

const showParam = z.object({ showId: z.string().uuid() });
const idParam = z.object({ id: z.string().uuid() });
const holdBody = z.object({ seatIds: z.array(z.string()).min(1) });
const bookingBody = z.object({ holdId: z.string().uuid() });
const paymentBody = z.object({
  bookingId: z.string().uuid(),
  paymentRef: z.string().min(1),
  status: z.enum(['SUCCESS', 'FAILED']),
});

export function bookingRoutes(booking: BookingUseCases, bookings: BookingRepository, guard: AuthGuard) {
  return async (app: FastifyInstance) => {
    const authed = { preHandler: guard.authenticate };

    app.post('/shows/:showId/holds', authed, async (req, reply) => {
      const { showId } = showParam.parse(req.params);
      const { seatIds } = holdBody.parse(req.body);
      const hold = await booking.holdSeats({ userId: principalOf(req).userId, showId, seatIds });
      return reply.status(201).send(hold);
    });

    app.delete('/holds/:id', authed, async (req, reply) => {
      const { id } = idParam.parse(req.params);
      await booking.releaseHold({ userId: principalOf(req).userId, holdId: id });
      return reply.status(204).send();
    });

    app.post('/bookings', authed, async (req, reply) => {
      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8) {
        throw new ValidationError('Idempotency-Key header is required');
      }
      const { holdId } = bookingBody.parse(req.body);
      const created = await booking.createBooking({
        userId: principalOf(req).userId,
        holdId,
        idempotencyKey,
      });
      return reply.status(201).send(created);
    });

    app.get('/bookings/:id', authed, async (req) => {
      const { id } = idParam.parse(req.params);
      const found = await bookings.findById(id);
      if (!found) throw new NotFoundError('Booking not found');
      return found;
    });

    // Called by the payment provider.
    app.post('/payments/webhook', async (req) => booking.handlePaymentEvent(paymentBody.parse(req.body)));
  };
}
