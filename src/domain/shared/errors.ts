/** Base class for errors that carry business meaning. Adapters map `code` to transport-level status. */
export abstract class DomainError extends Error {
  abstract readonly code: string;
  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_FAILED';
}
export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
}
export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
}
export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
}
export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
}
