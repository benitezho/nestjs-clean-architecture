import type { OutboxMessage } from './outbox-message';

/**
 * Delivery is at-least-once: implementations must reject (throw) on failure
 * and consumers must dedupe on `message.id`. Use it as the message key.
 */
export abstract class EventPublisher {
  abstract publish(message: OutboxMessage): Promise<void>;
}
