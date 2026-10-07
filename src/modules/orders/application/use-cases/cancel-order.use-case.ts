import type { Order } from '../../domain/order';
import { OrderId } from '../../domain/order-id';
import { OrderNotFoundError } from '../errors/application-error';
import { Clock } from '../ports/clock';
import { OrderRepository } from '../ports/order.repository';
import { UnitOfWork } from '../ports/unit-of-work';

export class CancelOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
  ) {}

  execute(rawId: string): Promise<Order> {
    const id = OrderId.from(rawId);
    return this.unitOfWork.run(async () => {
      const order = await this.orders.findById(id);
      if (!order) {
        throw new OrderNotFoundError(id.value);
      }
      order.cancel(this.clock.now());
      await this.orders.save(order);
      return order;
    });
  }
}
