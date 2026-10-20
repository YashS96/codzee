import type { UntypedServiceImplementation } from '@grpc/grpc-js';
import { z } from 'zod';
import type { AuthUseCases } from '../../../../../ports/primary/auth.js';
import { UnauthorizedError, ValidationError } from '../../../../../domain/shared/errors.js';
import type { GrpcLogger } from '../../errors.js';
import { bearerFromMetadata, unary } from '../../unary.js';

const registerReq = z.object({
  email: z.string().max(254),
  name: z.string().max(100),
  password: z.string().max(72),
});
const loginReq = z.object({ email: z.string().max(254), password: z.string().max(72) });
const refreshReq = z.object({ refreshToken: z.string().min(1).max(512) });
const logoutReq = z.object({ refreshToken: z.string().max(512) });

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError('Invalid request', {
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  return result.data;
}

export function authHandlers(auth: AuthUseCases, log: GrpcLogger): UntypedServiceImplementation {
  const principal = async (call: Parameters<typeof bearerFromMetadata>[0]) => {
    const token = bearerFromMetadata(call);
    if (!token) throw new UnauthorizedError('Missing bearer token');
    return auth.authenticate(token);
  };

  return {
    Register: unary(log, async (call) => auth.register(parse(registerReq, call.request))),
    Login: unary(log, async (call) => auth.login(parse(loginReq, call.request))),
    Refresh: unary(log, async (call) => auth.refresh(parse(refreshReq, call.request).refreshToken)),
    Logout: unary(log, async (call) => {
      const { refreshToken } = parse(logoutReq, call.request);
      await auth.logout({ principal: await principal(call), refreshToken: refreshToken || undefined });
      return {};
    }),
    GetProfile: unary(log, async (call) => auth.getProfile((await principal(call)).userId)),
  };
}
