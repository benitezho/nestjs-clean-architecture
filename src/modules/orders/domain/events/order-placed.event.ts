import { DomainEvent } from './domain-event';

export class OrderPlaced extends DomainEvent {
  readonly name = 'order.placed';
  readonly aggregateType = 'order';

  constructor(
    orderId: string,
    occurredAt: Date,
    private readonly customerId: string,
    private readonly total: { amount: number; currency: string },
    private readonly itemCount: number,
  ) {
    super(orderId, occurredAt);
  }

  payload(): Record<string, unknown> {
    return {
      orderId: this.aggregateId,
      customerId: this.customerId,
      total: this.total,
      itemCount: this.itemCount,
    };
  }
}
