export class InvalidIdempotencyKeyError extends Error {
  readonly kind = 'bad_request';
  readonly code = 'idempotency.invalid_key';

  constructor() {
    super('Idempotency-Key must be 1 to 255 printable ASCII characters');
    this.name = 'InvalidIdempotencyKeyError';
  }
}

export class IdempotencyKeyReuseError extends Error {
  readonly kind = 'validation';
  readonly code = 'idempotency.key_reuse';

  constructor() {
    super('This Idempotency-Key was already used with a different request body');
    this.name = 'IdempotencyKeyReuseError';
  }
}
