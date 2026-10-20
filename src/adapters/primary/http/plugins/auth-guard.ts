import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify';
import type { AuthUseCases, AuthenticatedPrincipal } from '../../../../ports/primary/auth.js';
import { ForbiddenError, UnauthorizedError } from '../../../../domain/shared/errors.js';
import type { Role } from '../../../../domain/user/user.js';
import { parseBearer } from '../../shared/bearer.js';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}

export function bearerToken(request: FastifyRequest): string | null {
  return parseBearer(request.headers.authorization);
}

export function makeAuthGuard(auth: AuthUseCases) {
  const authenticate: preHandlerAsyncHookHandler = async (request: FastifyRequest, _reply: FastifyReply) => {
    const token = bearerToken(request);
    if (!token) throw new UnauthorizedError('Missing bearer token');
    request.principal = await auth.authenticate(token);
  };

  const requireRole =
    (...roles: Role[]): preHandlerAsyncHookHandler =>
    async (request) => {
      if (!request.principal) throw new UnauthorizedError('Not authenticated');
      if (!roles.includes(request.principal.role)) throw new ForbiddenError('Insufficient role');
    };

  return { authenticate, requireRole };
}

export type AuthGuard = ReturnType<typeof makeAuthGuard>;

export function principalOf(request: FastifyRequest): AuthenticatedPrincipal {
  if (!request.principal) throw new UnauthorizedError('Not authenticated');
  return request.principal;
}
