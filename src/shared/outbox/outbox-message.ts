/** What the outbox stores and what publishers receive. `id` is the dedupe key. */
export interface OutboxMessage {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}
