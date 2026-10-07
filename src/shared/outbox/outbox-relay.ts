import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { nextAttemptAt } from './backoff';
import { EventPublisher } from './event-publisher';
import { OutboxConfig } from './outbox.config';
import type { OutboxMessage } from './outbox-message';

interface ClaimedRow {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
  attempts: number;
}

export interface BatchResult {
  claimed: number;
  published: number;
  retried: number;
  failed: number;
}

const MAX_ERROR_LENGTH = 1000;

@Injectable()
export class OutboxRelay {
  private readonly logger = new Logger(OutboxRelay.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly publisher: EventPublisher,
    private readonly config: OutboxConfig,
  ) {}

  /**
   * Claims due rows with FOR UPDATE SKIP LOCKED, so concurrent relays take
   * disjoint batches, and publishes them inside the claiming transaction.
   * A crash rolls the batch back and it is delivered again (at-least-once).
   */
  processBatch(now: Date = new Date()): Promise<BatchResult> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await this.claim(manager, now);
      const result: BatchResult = { claimed: rows.length, published: 0, retried: 0, failed: 0 };
      for (const row of rows) {
        const outcome = await this.deliver(manager, row, now);
        result[outcome] += 1;
      }
      return result;
    });
  }

  private claim(manager: EntityManager, now: Date): Promise<ClaimedRow[]> {
    return manager.query(
      `SELECT id, event_type, aggregate_type, aggregate_id, payload, occurred_at, attempts
         FROM outbox_events
        WHERE status = 'pending' AND next_attempt_at <= $1
        ORDER BY occurred_at, id
        LIMIT $2
          FOR UPDATE SKIP LOCKED`,
      [now, this.config.batchSize],
    );
  }

  private async deliver(
    manager: EntityManager,
    row: ClaimedRow,
    now: Date,
  ): Promise<'published' | 'retried' | 'failed'> {
    try {
      await this.publisher.publish(toMessage(row));
    } catch (error) {
      return this.recordFailure(manager, row, now, error);
    }
    await manager.query(
      `UPDATE outbox_events SET status = 'published', published_at = $2, last_error = NULL WHERE id = $1`,
      [row.id, now],
    );
    return 'published';
  }

  private async recordFailure(
    manager: EntityManager,
    row: ClaimedRow,
    now: Date,
    error: unknown,
  ): Promise<'retried' | 'failed'> {
    const attempts = row.attempts + 1;
    const exhausted = attempts >= this.config.maxAttempts;
    const message = (error instanceof Error ? error.message : String(error)).slice(
      0,
      MAX_ERROR_LENGTH,
    );
    const retryAt = nextAttemptAt(
      now,
      attempts,
      this.config.backoffBaseMs,
      this.config.backoffMaxMs,
    );
    await manager.query(
      `UPDATE outbox_events
          SET attempts = $2, status = $3, next_attempt_at = $4, last_error = $5
        WHERE id = $1`,
      [row.id, attempts, exhausted ? 'failed' : 'pending', retryAt, message],
    );
    this.logger.warn({
      msg: 'event publish failed',
      eventId: row.id,
      attempts,
      exhausted,
      error: message,
    });
    return exhausted ? 'failed' : 'retried';
  }
}

function toMessage(row: ClaimedRow): OutboxMessage {
  return {
    id: row.id,
    type: row.event_type,
    aggregateType: row.aggregate_type,
    aggregateId: row.aggregate_id,
    payload: row.payload,
    occurredAt: row.occurred_at,
  };
}
