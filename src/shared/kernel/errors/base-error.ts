/** Transport-agnostic category; the HTTP layer maps each kind to a status. */
export type ErrorKind = 'bad_request' | 'validation' | 'not_found' | 'conflict';

export abstract class BaseError extends Error {
  abstract readonly kind: ErrorKind;
  /** Stable, machine-readable identifier such as `order.not_found`. */
  abstract readonly code: string;

  constructor(
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
