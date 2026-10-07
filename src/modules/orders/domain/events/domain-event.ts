import { randomUUID } from 'node:crypto';

/** `eventId` doubles as the idempotency key for downstream consumers. */
export abstract class DomainEvent {
  readonly eventId: string = randomUUID();

  abstract readonly name: string;
  abstract readonly aggregateType: string;

  constructor(
    readonly aggregateId: string,
    readonly occurredAt: Date,
  ) {}

  abstract payload(): Record<string, unknown>;
}
