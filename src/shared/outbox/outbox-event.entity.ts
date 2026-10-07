import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

export type OutboxStatus = 'pending' | 'published' | 'failed';

@Entity({ name: 'outbox_events' })
@Index('idx_outbox_events_pending', ['nextAttemptAt'], { where: "status = 'pending'" })
export class OutboxEventEntity {
  @PrimaryColumn({ type: 'uuid', primaryKeyConstraintName: 'pk_outbox_events' })
  id!: string;

  @Column({ name: 'aggregate_type', type: 'varchar', length: 64 })
  aggregateType!: string;

  @Column({ name: 'aggregate_id', type: 'varchar', length: 64 })
  aggregateId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 128 })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: object;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt!: Date;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status!: OutboxStatus;

  @Column({ type: 'int', default: 0 })
  attempts!: number;

  @Column({ name: 'next_attempt_at', type: 'timestamptz', default: () => 'now()' })
  nextAttemptAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
