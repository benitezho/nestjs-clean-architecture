import { Money } from '../../domain/money';
import { Order } from '../../domain/order';
import { OrderId } from '../../domain/order-id';
import { OrderItem } from '../../domain/order-item';
import type { OrderStatus } from '../../domain/order-status';
import { OrderItemEntity } from './order-item.entity';
import { OrderEntity } from './order.entity';

/** Single place where persistence rows and the domain model are converted. */
export class OrderMapper {
  static toDomain(entity: OrderEntity): Order {
    if (!entity.items) {
      throw new Error(`Order ${entity.id} was loaded without its items`);
    }
    const items = [...entity.items]
      .sort((a, b) => a.position - b.position)
      .map((row) =>
        OrderItem.create({
          sku: row.sku,
          name: row.name,
          quantity: row.quantity,
          unitPrice: Money.of(row.unitPriceAmount, entity.currency),
        }),
      );
    return Order.rehydrate({
      id: OrderId.from(entity.id),
      customerId: entity.customerId,
      items,
      status: entity.status as OrderStatus,
      placedAt: entity.placedAt,
      cancelledAt: entity.cancelledAt ?? undefined,
      version: entity.version,
    });
  }

  static toEntity(order: Order): { order: OrderEntity; items: OrderItemEntity[] } {
    const row = new OrderEntity();
    row.id = order.id.value;
    row.customerId = order.customerId;
    row.status = order.status;
    row.currency = order.currency;
    row.totalAmount = order.total.amount;
    row.placedAt = order.placedAt;
    row.cancelledAt = order.cancelledAt ?? null;
    row.version = order.version;

    const items = order.items.map((item, position) => {
      const itemRow = new OrderItemEntity();
      itemRow.orderId = order.id.value;
      itemRow.position = position;
      itemRow.sku = item.sku;
      itemRow.name = item.name;
      itemRow.quantity = item.quantity;
      itemRow.unitPriceAmount = item.unitPrice.amount;
      return itemRow;
    });
    return { order: row, items };
  }
}
