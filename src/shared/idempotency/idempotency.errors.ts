import { ApplicationError } from '../kernel/errors/application-error';

export class InvalidIdempotencyKeyError extends ApplicationError {
  readonly kind = 'bad_request';
  readonly code = 'idempotency.invalid_key';

  constructor() {
    super('Idempotency-Key must be 1 to 255 printable ASCII characters');
  }
}

export class IdempotencyKeyReuseError extends ApplicationError {
  readonly kind = 'validation';
  readonly code = 'idempotency.key_reuse';

  constructor() {
    super('This Idempotency-Key was already used with a different request body');
  }
}
