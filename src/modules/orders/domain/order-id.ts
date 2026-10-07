import { InvalidOrderIdError } from './errors/order-errors';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class OrderId {
  private constructor(readonly value: string) {}

  static from(value: string): OrderId {
    if (!UUID_PATTERN.test(value)) {
      throw new InvalidOrderIdError(value);
    }
    return new OrderId(value.toLowerCase());
  }

  equals(other: OrderId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
