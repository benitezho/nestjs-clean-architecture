import { ConcurrentModificationError } from '../errors/order-errors';
import type { DomainEvent } from '../../domain/events/domain-event';
import { Order } from '../../domain/order';
import type { OrderId } from '../../domain/order-id';
import {
  OrderRepository,
  type ListOrdersQuery,
  type OrderCursor,
  type OrderPage,
} from '../ports/order.repository';

/** Test double with the same optimistic-locking contract as the real adapter. */
export class InMemoryOrderRepository extends OrderRepository {
  readonly publishedEvents: DomainEvent[] = [];
  private readonly rows = new Map<string, Order>();

  save(order: Order): Promise<void> {
    const stored = this.rows.get(order.id.value);
    if ((stored?.version ?? 0) !== order.version) {
      return Promise.reject(new ConcurrentModificationError(order.id.value));
    }
    this.publishedEvents.push(...order.pullEvents());
    this.rows.set(
      order.id.value,
      Order.rehydrate({ ...snapshotOf(order), version: order.version + 1 }),
    );
    return Promise.resolve();
  }

  findById(id: OrderId): Promise<Order | undefined> {
    const stored = this.rows.get(id.value);
    return Promise.resolve(stored && Order.rehydrate({ ...snapshotOf(stored) }));
  }

  list({ limit, after }: ListOrdersQuery): Promise<OrderPage> {
    const sorted = [...this.rows.values()].sort(
      (a, b) => b.placedAt.getTime() - a.placedAt.getTime() || b.id.value.localeCompare(a.id.value),
    );
    const start = after ? sorted.findIndex((o) => isAfter(o, after)) : 0;
    const window = start === -1 ? [] : sorted.slice(start, start + limit + 1);
    const orders = window.slice(0, limit);
    const last = orders.at(-1);
    const hasMore = window.length > limit && last !== undefined;
    return Promise.resolve({
      orders,
      nextCursor: hasMore ? { placedAt: last.placedAt, id: last.id.value } : undefined,
    });
  }
}

function snapshotOf(order: Order) {
  return {
    id: order.id,
    customerId: order.customerId,
    items: [...order.items],
    status: order.status,
    placedAt: order.placedAt,
    cancelledAt: order.cancelledAt,
    version: order.version,
  };
}

function isAfter(order: Order, cursor: OrderCursor): boolean {
  const placed = order.placedAt.getTime();
  const cursorPlaced = cursor.placedAt.getTime();
  return placed < cursorPlaced || (placed === cursorPlaced && order.id.value < cursor.id);
}
