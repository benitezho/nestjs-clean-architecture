import { Injectable } from '@nestjs/common';
import type { PlaceOrderCommand } from '../../../application/use-cases/place-order.use-case';
import type { Money } from '../../../domain/money';
import type { Order } from '../../../domain/order';
import type { MoneyResponse, OrderResponse } from '../dto/order.response';
import type { PlaceOrderRequest } from '../dto/place-order.request';

/** Keeps HTTP DTOs out of the application layer and domain objects out of responses. */
@Injectable()
export class OrderHttpMapper {
  toPlaceOrderCommand(request: PlaceOrderRequest): PlaceOrderCommand {
    return {
      customerId: request.customerId,
      items: request.items.map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: { amount: item.unitPrice.amount, currency: item.unitPrice.currency },
      })),
    };
  }

  toResponse(order: Order): OrderResponse {
    return {
      id: order.id.value,
      customerId: order.customerId,
      status: order.status,
      items: order.items.map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitPrice: this.toMoney(item.unitPrice),
        lineTotal: this.toMoney(item.lineTotal),
      })),
      total: this.toMoney(order.total),
      placedAt: order.placedAt.toISOString(),
      cancelledAt: order.cancelledAt?.toISOString() ?? null,
    };
  }

  private toMoney(money: Money): MoneyResponse {
    return { amount: money.amount, currency: money.currency };
  }
}
