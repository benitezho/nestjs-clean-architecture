import { Money } from '../../domain/money';
import { Order } from '../../domain/order';
import { OrderId } from '../../domain/order-id';
import { OrderItem } from '../../domain/order-item';
import { Clock } from '../ports/clock';
import { IdGenerator } from '../ports/id-generator';
import { OrderRepository } from '../ports/order.repository';
import { UnitOfWork } from '../ports/unit-of-work';

export interface PlaceOrderCommand {
  customerId: string;
  items: {
    sku: string;
    name: string;
    quantity: number;
    unitPrice: { amount: number; currency: string };
  }[];
}

export class PlaceOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly unitOfWork: UnitOfWork,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  async execute(command: PlaceOrderCommand): Promise<Order> {
    const order = Order.place({
      id: OrderId.from(this.ids.generate()),
      customerId: command.customerId,
      placedAt: this.clock.now(),
      items: command.items.map((item) =>
        OrderItem.create({
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitPrice: Money.of(item.unitPrice.amount, item.unitPrice.currency),
        }),
      ),
    });
    await this.unitOfWork.run(() => this.orders.save(order));
    return order;
  }
}
