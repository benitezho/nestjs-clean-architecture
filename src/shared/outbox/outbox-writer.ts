import { Injectable } from '@nestjs/common';
import { TransactionManager } from '../database/transaction-manager';
import { OutboxEventEntity } from './outbox-event.entity';
import type { OutboxMessage } from './outbox-message';

@Injectable()
export class OutboxWriter {
  constructor(private readonly transactions: TransactionManager) {}

  /** Must be called inside an active transaction so events commit with the state change. */
  async write(messages: OutboxMessage[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }
    const rows = messages.map((message) =>
      Object.assign(new OutboxEventEntity(), {
        id: message.id,
        aggregateType: message.aggregateType,
        aggregateId: message.aggregateId,
        eventType: message.type,
        payload: message.payload,
        occurredAt: message.occurredAt,
      }),
    );
    await this.transactions.requireManager().insert(OutboxEventEntity, rows);
  }
}
