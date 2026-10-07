import type { ErrorKind } from '../../domain/errors/domain-error';

export abstract class ApplicationError extends Error {
  abstract readonly kind: ErrorKind;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class OrderNotFoundError extends ApplicationError {
  readonly kind = 'not_found';
  readonly code = 'order.not_found';

  constructor(id: string) {
    super(`Order ${id} not found`);
  }
}

/** Thrown by repositories when the aggregate changed since it was loaded. */
export class ConcurrentModificationError extends ApplicationError {
  readonly kind = 'conflict';
  readonly code = 'order.concurrent_modification';

  constructor(id: string) {
    super(`Order ${id} was modified concurrently; reload and retry`);
  }
}
