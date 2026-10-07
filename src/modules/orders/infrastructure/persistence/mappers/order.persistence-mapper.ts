import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../../../shared/kernel/errors/domain-error';
import type { DataMapper } from '../../../../../shared/kernel/mapping/data-mapper';
import { Money } from '../../../domain/money';
import { Order } from '../../../domain/order';
import { OrderId } from '../../../domain/order-id';
import { OrderItem } from '../../../domain/order-item';
import { isOrderStatus } from '../../../domain/order-status';
import { OrderItemEntity } from '../order-item.entity';
import { OrderEntity } from '../order.entity';
import { PersistenceMappingError } from './persistence-mapping.error';

/** An order row together with its item rows. */
export interface OrderRecord {
  order: OrderEntity;
  items: OrderItemEntity[];
}

/** Single place where persistence rows and the Order aggregate are converted. */
@Injectable()
export class OrderPersistenceMapper implements DataMapper<Order, OrderRecord> {
  toDomain({ order: row, items }: OrderRecord): Order {
    if (!isOrderStatus(row.status)) {
      throw new PersistenceMappingError(`Order ${row.id} has unknown status "${row.status}"`);
    }
    const status = row.status;
    try {
      return Order.rehydrate({
        id: OrderId.from(row.id),
        customerId: row.customerId,
        items: [...items]
          .sort((a, b) => a.position - b.position)
          .map((item) => this.itemToDomain(item, row.currency)),
        status,
        placedAt: row.placedAt,
        cancelledAt: row.cancelledAt ?? undefined,
        version: row.version,
      });
    } catch (error) {
      if (error instanceof DomainError) {
        throw new PersistenceMappingError(
          `Order ${row.id} violates a domain rule: ${error.message}`,
          {
            cause: error,
          },
        );
      }
      throw error;
    }
  }

  toPersistence(order: Order): OrderRecord {
    const row = new OrderEntity();
    row.id = order.id.value;
    row.customerId = order.customerId;
    row.status = order.status;
    row.currency = order.currency;
    row.totalAmount = order.total.amount;
    row.placedAt = order.placedAt;
    row.cancelledAt = order.cancelledAt ?? null;
    row.version = order.version;

    return {
      order: row,
      items: order.items.map((item, position) => this.itemToPersistence(order, item, position)),
    };
  }

  private itemToDomain(row: OrderItemEntity, currency: string): OrderItem {
    return OrderItem.create({
      sku: row.sku,
      name: row.name,
      quantity: row.quantity,
      unitPrice: Money.of(row.unitPriceAmount, currency),
    });
  }

  private itemToPersistence(order: Order, item: OrderItem, position: number): OrderItemEntity {
    const row = new OrderItemEntity();
    row.orderId = order.id.value;
    row.position = position;
    row.sku = item.sku;
    row.name = item.name;
    row.quantity = item.quantity;
    row.unitPriceAmount = item.unitPrice.amount;
    return row;
  }
}
