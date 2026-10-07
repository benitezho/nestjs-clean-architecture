import { OrderRepository, type ListOrdersQuery, type OrderPage } from '../ports/order.repository';

export class ListOrders {
  constructor(private readonly orders: OrderRepository) {}

  execute(query: ListOrdersQuery): Promise<OrderPage> {
    return this.orders.list(query);
  }
}
