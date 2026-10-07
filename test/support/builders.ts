import { randomUUID } from 'node:crypto';
import { Money } from '../../src/modules/orders/domain/money';
import { Order } from '../../src/modules/orders/domain/order';
import { OrderId } from '../../src/modules/orders/domain/order-id';
import { OrderItem } from '../../src/modules/orders/domain/order-item';

export function buildOrder(overrides: { placedAt?: Date; customerId?: string } = {}): Order {
  return Order.place({
    id: OrderId.from(randomUUID()),
    customerId: overrides.customerId ?? 'customer-1',
    placedAt: overrides.placedAt ?? new Date(),
    items: [
      OrderItem.create({
        sku: 'SKU-1',
        name: 'Mug',
        quantity: 2,
        unitPrice: Money.of(1999, 'USD'),
      }),
      OrderItem.create({
        sku: 'SKU-2',
        name: 'Plate',
        quantity: 1,
        unitPrice: Money.of(500, 'USD'),
      }),
    ],
  });
}
