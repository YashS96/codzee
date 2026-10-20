import type { FastifyInstance } from 'fastify';
import type { AuthUseCases } from '../../../../../ports/primary/auth.js';
import type { HealthUseCases } from '../../../../../ports/primary/health.js';
import type { AuthGuard } from '../../plugins/auth-guard.js';
import { authRoutes, type AuthRouteOptions } from './auth.routes.js';
import { healthRoutes } from './health.routes.js';

export interface V1Deps {
  auth: AuthUseCases;
  health: HealthUseCases;
  guard: AuthGuard;
  info: { name: string; version: string };
  authOptions: AuthRouteOptions;
}

/** Every v1 route. Registered under the `/v1` prefix; a future v2 gets its own folder and prefix. */
export function v1Routes(deps: V1Deps) {
  return async (app: FastifyInstance) => {
    await app.register(healthRoutes(deps.health, deps.info), { prefix: '/health' });
    await app.register(authRoutes(deps.auth, deps.guard, deps.authOptions), { prefix: '/auth' });
  };
}
