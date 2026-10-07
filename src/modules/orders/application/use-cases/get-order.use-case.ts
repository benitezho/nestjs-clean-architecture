import type { Order } from '../../domain/order';
import { OrderId } from '../../domain/order-id';
import { OrderNotFoundError } from '../errors/application-error';
import { OrderRepository } from '../ports/order.repository';

export class GetOrder {
  constructor(private readonly orders: OrderRepository) {}

  async execute(rawId: string): Promise<Order> {
    const id = OrderId.from(rawId);
    const order = await this.orders.findById(id);
    if (!order) {
      throw new OrderNotFoundError(id.value);
    }
    return order;
  }
}
