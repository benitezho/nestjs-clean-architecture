import { OrderCancelled } from '../../../domain/events/order-cancelled.event';
import { OutboxMessageMapper } from './outbox-message.mapper';

describe('OutboxMessageMapper', () => {
  it('maps a domain event to an outbox message', () => {
    const occurredAt = new Date('2026-01-16T10:00:00.000Z');
    const event = new OrderCancelled('order-1', occurredAt, 'customer-1');

    expect(new OutboxMessageMapper().map(event)).toEqual({
      id: event.eventId,
      type: 'order.cancelled',
      aggregateType: 'order',
      aggregateId: 'order-1',
      payload: event.payload(),
      occurredAt,
    });
  });
});
