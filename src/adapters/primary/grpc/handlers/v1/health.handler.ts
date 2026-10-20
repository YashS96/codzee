import type { UntypedServiceImplementation } from '@grpc/grpc-js';
import type { HealthUseCases } from '../../../../../ports/primary/health.js';
import { NotFoundError } from '../../../../../domain/shared/errors.js';
import type { GrpcLogger } from '../../errors.js';
import { unary } from '../../unary.js';

/** Service name a gRPC liveness probe should use; it never checks dependencies. */
export const LIVENESS_SERVICE = 'liveness';
const READINESS_SERVICES = new Set(['', 'codzee.v1.AuthService']);

/**
 * grpc.health.v1.Health — `service: ""` is overall readiness, `service: "liveness"` is liveness.
 * Watch is not implemented; grpc-js answers it with UNIMPLEMENTED.
 */
export function healthHandlers(health: HealthUseCases, log: GrpcLogger): UntypedServiceImplementation {
  return {
    Check: unary<{ service: string }, { status: string }>(log, async (call) => {
      const service = call.request.service;
      if (service === LIVENESS_SERVICE) return { status: 'SERVING' };
      if (!READINESS_SERVICES.has(service)) throw new NotFoundError(`unknown service "${service}"`);
      const report = await health.readiness();
      return { status: report.status === 'ok' ? 'SERVING' : 'NOT_SERVING' };
    }),
  };
}
