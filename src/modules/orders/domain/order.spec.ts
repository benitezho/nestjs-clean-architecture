import {
  CurrencyMismatchError,
  EmptyOrderError,
  InvalidOrderError,
  InvalidQuantityError,
  OrderAlreadyCancelledError,
} from './errors/order-errors';
import { OrderCancelled } from './events/order-cancelled.event';
import { OrderPlaced } from './events/order-placed.event';
import { Money } from './money';
import { Order } from './order';
import { OrderId } from './order-id';
import { OrderItem } from './order-item';
import { OrderStatus } from './order-status';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const NOW = new Date('2026-01-15T10:00:00.000Z');

const item = (overrides: Partial<{ quantity: number; currency: string; amount: number }> = {}) =>
  OrderItem.create({
    sku: 'SKU-1',
    name: 'Widget',
    quantity: overrides.quantity ?? 2,
    unitPrice: Money.of(overrides.amount ?? 500, overrides.currency ?? 'USD'),
  });

const placeOrder = (items = [item()]) =>
  Order.place({ id: OrderId.from(ID), customerId: 'customer-1', items, placedAt: NOW });

describe('Order', () => {
  describe('place', () => {
    it('starts PLACED with a total computed from its items', () => {
      const order = placeOrder([
        item({ quantity: 2, amount: 500 }),
        item({ quantity: 1, amount: 250 }),
      ]);

      expect(order.status).toBe(OrderStatus.PLACED);
      expect(order.total.equals(Money.of(1250, 'USD'))).toBe(true);
      expect(order.version).toBe(0);
    });

    it('requires at least one item', () => {
      expect(() => placeOrder([])).toThrow(EmptyOrderError);
    });

    it('requires all items to share a currency', () => {
      expect(() => placeOrder([item(), item({ currency: 'EUR' })])).toThrow(CurrencyMismatchError);
    });

    it('requires a customer', () => {
      expect(() =>
        Order.place({ id: OrderId.from(ID), customerId: ' ', items: [item()], placedAt: NOW }),
      ).toThrow(InvalidOrderError);
    });

    it.each([0, -1, 1.5])('rejects item quantity %p', (quantity) => {
      expect(() => item({ quantity })).toThrow(InvalidQuantityError);
    });

    it('records an OrderPlaced event', () => {
      const [event] = placeOrder().pullEvents();

      expect(event).toBeInstanceOf(OrderPlaced);
      expect(event?.name).toBe('order.placed');
      expect(event?.aggregateId).toBe(ID);
      expect(event?.occurredAt).toBe(NOW);
      expect(event?.payload()).toEqual({
        orderId: ID,
        customerId: 'customer-1',
        total: { amount: 1000, currency: 'USD' },
        itemCount: 1,
      });
    });
  });

  describe('cancel', () => {
    const LATER = new Date('2026-01-15T11:00:00.000Z');

    it('moves a PLACED order to CANCELLED and records OrderCancelled', () => {
      const order = placeOrder();
      order.pullEvents();

      order.cancel(LATER);

      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(order.cancelledAt).toBe(LATER);
      const [event] = order.pullEvents();
      expect(event).toBeInstanceOf(OrderCancelled);
      expect(event?.payload()).toMatchObject({ orderId: ID, cancelledAt: LATER.toISOString() });
    });

    it('cannot be cancelled twice', () => {
      const order = placeOrder();
      order.cancel(LATER);

      expect(() => order.cancel(LATER)).toThrow(OrderAlreadyCancelledError);
    });

    it('does not record an event when the transition is rejected', () => {
      const order = placeOrder();
      order.cancel(LATER);
      order.pullEvents();

      expect(() => order.cancel(LATER)).toThrow();
      expect(order.pullEvents()).toEqual([]);
    });
  });

  describe('pullEvents', () => {
    it('drains the recorded events', () => {
      const order = placeOrder();

      expect(order.pullEvents()).toHaveLength(1);
      expect(order.pullEvents()).toEqual([]);
    });

    it('assigns each event a unique id', () => {
      const order = placeOrder();
      order.cancel(NOW);

      const [placed, cancelled] = order.pullEvents();

      expect(placed?.eventId).not.toBe(cancelled?.eventId);
    });
  });

  describe('rehydrate', () => {
    it('restores state without recording events', () => {
      const order = Order.rehydrate({
        id: OrderId.from(ID),
        customerId: 'customer-1',
        items: [item()],
        status: OrderStatus.CANCELLED,
        placedAt: NOW,
        cancelledAt: NOW,
        version: 3,
      });

      expect(order.version).toBe(3);
      expect(order.status).toBe(OrderStatus.CANCELLED);
      expect(order.pullEvents()).toEqual([]);
    });
  });
});
