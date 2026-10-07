import { DomainError } from '../../../../shared/kernel/errors/domain-error';

export class InvalidMoneyError extends DomainError {
  readonly kind = 'validation';
  readonly code = 'money.invalid';
}

export class CurrencyMismatchError extends DomainError {
  readonly kind = 'validation';
  readonly code = 'money.currency_mismatch';

  constructor(expected: string, actual: string) {
    super(`Currency mismatch: expected ${expected}, got ${actual}`, { expected, actual });
  }
}

export class InvalidOrderIdError extends DomainError {
  readonly kind = 'validation';
  readonly code = 'order.invalid_id';

  constructor(value: string) {
    super(`"${value}" is not a valid order id`, { value });
  }
}

export class InvalidOrderError extends DomainError {
  readonly kind = 'validation';
  readonly code = 'order.invalid';
}

export class EmptyOrderError extends DomainError {
  readonly kind = 'validation';
  readonly code = 'order.empty';

  constructor() {
    super('An order must contain at least one item');
  }
}

export class InvalidQuantityError extends DomainError {
  readonly kind = 'validation';
  readonly code = 'order.invalid_quantity';

  constructor(quantity: number) {
    super(`Quantity must be a positive integer, got ${quantity}`, { quantity });
  }
}

export class OrderAlreadyCancelledError extends DomainError {
  readonly kind = 'conflict';
  readonly code = 'order.already_cancelled';

  constructor(id: string) {
    super(`Order ${id} is already cancelled`, { orderId: id });
  }
}
