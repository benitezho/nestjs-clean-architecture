import { DomainEvent } from './domain-event';

export class OrderCancelled extends DomainEvent {
  readonly name = 'order.cancelled';
  readonly aggregateType = 'order';

  constructor(
    orderId: string,
    occurredAt: Date,
    private readonly customerId: string,
  ) {
    super(orderId, occurredAt);
  }

  payload(): Record<string, unknown> {
    return {
      orderId: this.aggregateId,
      customerId: this.customerId,
      cancelledAt: this.occurredAt.toISOString(),
    };
  }
}
