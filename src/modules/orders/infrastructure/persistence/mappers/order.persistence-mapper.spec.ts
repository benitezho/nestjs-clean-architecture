import { Money } from '../../../domain/money';
import { Order } from '../../../domain/order';
import { OrderId } from '../../../domain/order-id';
import { OrderItem } from '../../../domain/order-item';
import { OrderStatus } from '../../../domain/order-status';
import { OrderItemEntity } from '../order-item.entity';
import { OrderEntity } from '../order.entity';
import { OrderPersistenceMapper, type OrderRecord } from './order.persistence-mapper';
import { PersistenceMappingError } from './persistence-mapping.error';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function itemRow(position: number, sku: string, overrides: Partial<OrderItemEntity> = {}) {
  return Object.assign(new OrderItemEntity(), {
    orderId: ID,
    position,
    sku,
    name: `Item ${sku}`,
    quantity: 2,
    unitPriceAmount: 500,
    ...overrides,
  });
}

function record(overrides: Partial<OrderEntity> = {}): OrderRecord {
  return {
    order: Object.assign(new OrderEntity(), {
      id: ID,
      customerId: 'customer-1',
      status: 'PLACED',
      currency: 'USD',
      totalAmount: 2000,
      placedAt: new Date('2026-01-15T10:00:00.000Z'),
      cancelledAt: null,
      version: 1,
      ...overrides,
    }),
    items: [itemRow(1, 'B'), itemRow(0, 'A')],
  };
}

describe('OrderPersistenceMapper', () => {
  const mapper = new OrderPersistenceMapper();

  describe('toDomain', () => {
    it('maps a null cancelled_at to undefined', () => {
      expect(mapper.toDomain(record({ cancelledAt: null })).cancelledAt).toBeUndefined();
    });

    it('keeps cancelled status and date', () => {
      const cancelledAt = new Date('2026-01-16T10:00:00.000Z');

      const order = mapper.toDomain(record({ status: 'CANCELLED', cancelledAt }));

      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(order.cancelledAt).toEqual(cancelledAt);
    });

    it('restores items in position order with the order currency', () => {
      const order = mapper.toDomain(record());

      expect(order.items.map((i) => i.sku)).toEqual(['A', 'B']);
      expect(order.items[0]?.unitPrice.currency).toBe('USD');
      expect(order.total.amount).toBe(2000);
      expect(order.version).toBe(1);
    });

    it('rejects a status that is not part of the domain', () => {
      expect(() => mapper.toDomain(record({ status: 'SHIPPED' }))).toThrow(
        new PersistenceMappingError(`Order ${ID} has unknown status "SHIPPED"`),
      );
    });

    it('reports stored data that breaks a domain rule as a mapping error', () => {
      const corrupt = { ...record(), items: [itemRow(0, 'A', { quantity: 0 })] };

      expect(() => mapper.toDomain(corrupt)).toThrow(PersistenceMappingError);
    });
  });

  describe('toPersistence', () => {
    it('maps an undefined cancelledAt to null', () => {
      const { order } = mapper.toPersistence(mapper.toDomain(record()));

      expect(order.cancelledAt).toBeNull();
    });

    it('maps cancelledAt, derived totals and item positions', () => {
      const cancelledAt = new Date('2026-01-16T10:00:00.000Z');
      const domain = mapper.toDomain(record({ status: 'CANCELLED', cancelledAt }));

      const { order, items } = mapper.toPersistence(domain);

      expect(order).toMatchObject({ status: 'CANCELLED', cancelledAt, totalAmount: 2000 });
      expect(items.map((i) => [i.orderId, i.position, i.sku])).toEqual([
        [ID, 0, 'A'],
        [ID, 1, 'B'],
      ]);
    });
  });

  describe('round trip', () => {
    it('restores an equal aggregate, keeping version and cancelledAt', () => {
      const original = Order.rehydrate({
        id: OrderId.from(ID),
        customerId: 'customer-1',
        items: [
          OrderItem.create({
            sku: 'A',
            name: 'Mug',
            quantity: 3,
            unitPrice: Money.of(1999, 'EUR'),
          }),
        ],
        status: OrderStatus.CANCELLED,
        placedAt: new Date('2026-01-15T10:00:00.000Z'),
        cancelledAt: new Date('2026-01-16T10:00:00.000Z'),
        version: 7,
      });

      const restored = mapper.toDomain(mapper.toPersistence(original));

      expect(restored).toEqual(original);
      expect(restored.version).toBe(7);
      expect(restored.cancelledAt).toEqual(original.cancelledAt);
    });
  });
});
