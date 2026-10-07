import type { Money } from '../../domain/money';
import type { Order } from '../../domain/order';
import type { MoneyResponse, OrderResponse } from './dto/order.response';

const toMoney = (money: Money): MoneyResponse => ({
  amount: money.amount,
  currency: money.currency,
});

export function presentOrder(order: Order): OrderResponse {
  return {
    id: order.id.value,
    customerId: order.customerId,
    status: order.status,
    items: order.items.map((item) => ({
      sku: item.sku,
      name: item.name,
      quantity: item.quantity,
      unitPrice: toMoney(item.unitPrice),
      lineTotal: toMoney(item.lineTotal),
    })),
    total: toMoney(order.total),
    placedAt: order.placedAt.toISOString(),
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
  };
}
