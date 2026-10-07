export type ErrorKind = 'validation' | 'not_found' | 'conflict';

/**
 * Base class for business-rule violations. `kind` is a transport-agnostic
 * category that outer layers translate (e.g. to an HTTP status).
 */
export abstract class DomainError extends Error {
  abstract readonly kind: ErrorKind;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
