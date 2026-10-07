import { Injectable } from '@nestjs/common';
import type { Mapper } from '../../../../../shared/kernel/mapping/mapper';
import type { OutboxMessage } from '../../../../../shared/outbox/outbox-message';
import type { DomainEvent } from '../../../domain/events/domain-event';

@Injectable()
export class OutboxMessageMapper implements Mapper<DomainEvent, OutboxMessage> {
  map(event: DomainEvent): OutboxMessage {
    return {
      id: event.eventId,
      type: event.name,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event.payload(),
      occurredAt: event.occurredAt,
    };
  }
}
