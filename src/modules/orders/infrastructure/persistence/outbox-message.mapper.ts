import type { DomainEvent } from '../../domain/events/domain-event';
import type { OutboxMessage } from '../../../../shared/outbox/outbox-message';

export function toOutboxMessage(event: DomainEvent): OutboxMessage {
  return {
    id: event.eventId,
    type: event.name,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    payload: event.payload(),
    occurredAt: event.occurredAt,
  };
}
