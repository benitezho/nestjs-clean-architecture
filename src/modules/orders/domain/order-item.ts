import { InvalidOrderError, InvalidQuantityError } from './errors/order-errors';
import { Money } from './money';

export interface OrderItemProps {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
}

export class OrderItem {
  private constructor(
    readonly sku: string,
    readonly name: string,
    readonly quantity: number,
    readonly unitPrice: Money,
  ) {}

  static create(props: OrderItemProps): OrderItem {
    if (props.sku.trim() === '') {
      throw new InvalidOrderError('Item sku must not be blank');
    }
    if (!Number.isSafeInteger(props.quantity) || props.quantity < 1) {
      throw new InvalidQuantityError(props.quantity);
    }
    return new OrderItem(props.sku, props.name, props.quantity, props.unitPrice);
  }

  get lineTotal(): Money {
    return this.unitPrice.multiply(this.quantity);
  }
}
