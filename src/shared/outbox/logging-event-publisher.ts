import { Injectable, Logger } from '@nestjs/common';
import { EventPublisher } from './event-publisher';
import type { OutboxMessage } from './outbox-message';

/** Default publisher: writes the event to the log. Swap it for a real broker. */
@Injectable()
export class LoggingEventPublisher extends EventPublisher {
  private readonly logger = new Logger(LoggingEventPublisher.name);

  publish(message: OutboxMessage): Promise<void> {
    this.logger.log({
      msg: 'event published',
      key: message.id,
      type: message.type,
      aggregateId: message.aggregateId,
      payload: message.payload,
    });
    return Promise.resolve();
  }
}
