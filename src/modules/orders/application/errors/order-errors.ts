import { ApplicationError } from '../../../../shared/kernel/errors/application-error';

export class OrderNotFoundError extends ApplicationError {
  readonly kind = 'not_found';
  readonly code = 'order.not_found';

  constructor(id: string) {
    super(`Order ${id} not found`, { orderId: id });
  }
}

/** Thrown by repositories when the aggregate changed since it was loaded. */
export class ConcurrentModificationError extends ApplicationError {
  readonly kind = 'conflict';
  readonly code = 'order.concurrent_modification';

  constructor(id: string) {
    super(`Order ${id} was modified concurrently; reload and retry`, { orderId: id });
  }
}
