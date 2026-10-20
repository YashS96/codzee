import { Metadata, status, type ServiceError } from '@grpc/grpc-js';
import { DomainError } from '../../../domain/shared/errors.js';

const STATUS_BY_CODE: Record<string, status> = {
  VALIDATION_FAILED: status.INVALID_ARGUMENT,
  UNAUTHORIZED: status.UNAUTHENTICATED,
  FORBIDDEN: status.PERMISSION_DENIED,
  NOT_FOUND: status.NOT_FOUND,
  CONFLICT: status.ALREADY_EXISTS,
};

export interface GrpcLogger {
  error(obj: object, msg: string): void;
}

/** Maps domain errors to gRPC status codes; anything unexpected becomes INTERNAL without leaking details. */
export function toServiceError(err: unknown, log: GrpcLogger): Partial<ServiceError> {
  if (err instanceof DomainError) {
    const metadata = new Metadata();
    metadata.set('error-code', err.code);
    return { code: STATUS_BY_CODE[err.code] ?? status.INVALID_ARGUMENT, details: err.message, metadata };
  }
  log.error({ err }, 'unhandled gRPC error');
  return { code: status.INTERNAL, details: 'Internal server error' };
}
