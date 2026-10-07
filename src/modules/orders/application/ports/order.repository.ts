import type { Order } from '../../domain/order';
import type { OrderId } from '../../domain/order-id';

/** Keyset position: orders are listed newest first, ties broken by id. */
export interface OrderCursor {
  placedAt: Date;
  id: string;
}

export interface ListOrdersQuery {
  limit: number;
  after?: OrderCursor;
}

export interface OrderPage {
  orders: Order[];
  nextCursor?: OrderCursor;
}

export abstract class OrderRepository {
  /**
   * Persists the aggregate and its pulled domain events atomically.
   * Throws ConcurrentModificationError if the stored version moved on.
   */
  abstract save(order: Order): Promise<void>;
  abstract findById(id: OrderId): Promise<Order | undefined>;
  abstract list(query: ListOrdersQuery): Promise<OrderPage>;
}
