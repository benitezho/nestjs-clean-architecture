import { OrderStatus } from '../../domain/order-status';
import { OrderItemEntity } from './order-item.entity';
import { OrderEntity } from './order.entity';
import { OrderMapper } from './order.mapper';

function itemRow(position: number, sku: string): OrderItemEntity {
  return Object.assign(new OrderItemEntity(), {
    orderId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    position,
    sku,
    name: `Item ${sku}`,
    quantity: 2,
    unitPriceAmount: 500,
  });
}

function orderRow(overrides: Partial<OrderEntity> = {}): OrderEntity {
  return Object.assign(new OrderEntity(), {
    id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    customerId: 'customer-1',
    status: 'PLACED',
    currency: 'USD',
    totalAmount: 2000,
    placedAt: new Date('2026-01-15T10:00:00.000Z'),
    cancelledAt: null,
    version: 1,
    items: [itemRow(1, 'B'), itemRow(0, 'A')],
    ...overrides,
  });
}

describe('OrderMapper', () => {
  describe('toDomain', () => {
    it('maps a null cancelled_at to undefined', () => {
      const order = OrderMapper.toDomain(orderRow({ cancelledAt: null }));

      expect(order.cancelledAt).toBeUndefined();
    });

    it('keeps a cancelled_at date', () => {
      const cancelledAt = new Date('2026-01-16T10:00:00.000Z');

      const order = OrderMapper.toDomain(orderRow({ status: 'CANCELLED', cancelledAt }));

      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(order.cancelledAt).toEqual(cancelledAt);
    });

    it('restores items in position order with the order currency', () => {
      const order = OrderMapper.toDomain(orderRow());

      expect(order.items.map((i) => i.sku)).toEqual(['A', 'B']);
      expect(order.items[0]?.unitPrice.currency).toBe('USD');
      expect(order.total.amount).toBe(2000);
      expect(order.version).toBe(1);
    });

    it('fails loudly when items were not loaded', () => {
      expect(() => OrderMapper.toDomain(orderRow({ items: undefined }))).toThrow(
        /without its items/,
      );
    });
  });

  describe('toEntity', () => {
    it('maps an undefined cancelledAt to null', () => {
      const domain = OrderMapper.toDomain(orderRow());

      const { order } = OrderMapper.toEntity(domain);

      expect(order.cancelledAt).toBeNull();
    });

    it('maps a cancelledAt date and derived totals', () => {
      const cancelledAt = new Date('2026-01-16T10:00:00.000Z');
      const domain = OrderMapper.toDomain(orderRow({ status: 'CANCELLED', cancelledAt }));

      const { order, items } = OrderMapper.toEntity(domain);

      expect(order.cancelledAt).toEqual(cancelledAt);
      expect(order.totalAmount).toBe(2000);
      expect(items.map((i) => [i.position, i.sku])).toEqual([
        [0, 'A'],
        [1, 'B'],
      ]);
    });
  });
});
