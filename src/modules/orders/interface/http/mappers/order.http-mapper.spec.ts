import { Money } from '../../../domain/money';
import { Order } from '../../../domain/order';
import { OrderId } from '../../../domain/order-id';
import { OrderItem } from '../../../domain/order-item';
import type { PlaceOrderRequest } from '../dto/place-order.request';
import { OrderHttpMapper } from './order.http-mapper';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

function placedOrder(): Order {
  return Order.place({
    id: OrderId.from(ID),
    customerId: 'customer-1',
    placedAt: new Date('2026-01-15T10:00:00.000Z'),
    items: [
      OrderItem.create({ sku: 'A', name: 'Mug', quantity: 2, unitPrice: Money.of(1999, 'USD') }),
    ],
  });
}

describe('OrderHttpMapper', () => {
  const mapper = new OrderHttpMapper();

  describe('toResponse', () => {
    it('shapes a placed order', () => {
      expect(mapper.toResponse(placedOrder())).toEqual({
        id: ID,
        customerId: 'customer-1',
        status: 'PLACED',
        items: [
          {
            sku: 'A',
            name: 'Mug',
            quantity: 2,
            unitPrice: { amount: 1999, currency: 'USD' },
            lineTotal: { amount: 3998, currency: 'USD' },
          },
        ],
        total: { amount: 3998, currency: 'USD' },
        placedAt: '2026-01-15T10:00:00.000Z',
        cancelledAt: null,
      });
    });

    it('serialises cancelledAt as ISO string', () => {
      const order = placedOrder();
      order.cancel(new Date('2026-01-16T10:00:00.000Z'));

      expect(mapper.toResponse(order)).toMatchObject({
        status: 'CANCELLED',
        cancelledAt: '2026-01-16T10:00:00.000Z',
      });
    });
  });

  describe('toPlaceOrderCommand', () => {
    it('copies the request into a plain command', () => {
      const request: PlaceOrderRequest = {
        customerId: 'customer-1',
        items: [
          { sku: 'A', name: 'Mug', quantity: 2, unitPrice: { amount: 1999, currency: 'USD' } },
        ],
      };

      const command = mapper.toPlaceOrderCommand(request);

      expect(command).toEqual({
        customerId: 'customer-1',
        items: [
          { sku: 'A', name: 'Mug', quantity: 2, unitPrice: { amount: 1999, currency: 'USD' } },
        ],
      });
      expect(command).not.toBe(request);
      expect(command.items[0]).not.toBe(request.items[0]);
    });
  });
});
