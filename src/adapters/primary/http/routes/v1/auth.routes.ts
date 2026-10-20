import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AuthUseCases } from '../../../../../ports/primary/auth.js';
import { principalOf, type AuthGuard } from '../../plugins/auth-guard.js';

const registerBody = z.object({
  email: z.string().max(254),
  name: z.string().max(100),
  password: z.string().max(72),
});
const loginBody = z.object({ email: z.string().max(254), password: z.string().max(72) });
const refreshBody = z.object({ refreshToken: z.string().min(1).max(512) });
const logoutBody = z.object({ refreshToken: z.string().max(512).optional() }).optional();

export interface AuthRouteOptions {
  rateLimit: { max: number; timeWindow: number };
}

export function authRoutes(auth: AuthUseCases, guard: AuthGuard, opts: AuthRouteOptions) {
  return async (app: FastifyInstance) => {
    const limited = { config: { rateLimit: opts.rateLimit } };

    app.post('/register', limited, async (req, reply) => {
      const user = await auth.register(registerBody.parse(req.body));
      return reply.status(201).send(user);
    });

    app.post('/login', limited, async (req) => auth.login(loginBody.parse(req.body)));

    app.post('/refresh', limited, async (req) => auth.refresh(refreshBody.parse(req.body).refreshToken));

    app.post('/logout', { preHandler: guard.authenticate }, async (req, reply) => {
      const body = logoutBody.parse(req.body);
      await auth.logout({ principal: principalOf(req), refreshToken: body?.refreshToken });
      return reply.status(204).send();
    });

    app.get('/me', { preHandler: guard.authenticate }, async (req) =>
      auth.getProfile(principalOf(req).userId),
    );
  };
}
