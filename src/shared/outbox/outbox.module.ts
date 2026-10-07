import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { DatabaseModule } from '../database/database.module';
import { EventPublisher } from './event-publisher';
import { LoggingEventPublisher } from './logging-event-publisher';
import { OutboxConfig } from './outbox.config';
import { OutboxRelay } from './outbox-relay';
import { OutboxRelayWorker } from './outbox-relay.worker';
import { OutboxWriter } from './outbox-writer';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: OutboxConfig,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): OutboxConfig => ({
        enabled: config.get('OUTBOX_RELAY_ENABLED', { infer: true }),
        pollIntervalMs: config.get('OUTBOX_POLL_INTERVAL_MS', { infer: true }),
        batchSize: config.get('OUTBOX_BATCH_SIZE', { infer: true }),
        maxAttempts: config.get('OUTBOX_MAX_ATTEMPTS', { infer: true }),
        backoffBaseMs: config.get('OUTBOX_BACKOFF_BASE_MS', { infer: true }),
        backoffMaxMs: config.get('OUTBOX_BACKOFF_MAX_MS', { infer: true }),
      }),
    },
    // Replace `useClass` to publish to Kafka, SNS, etc.
    { provide: EventPublisher, useClass: LoggingEventPublisher },
    OutboxWriter,
    OutboxRelay,
    OutboxRelayWorker,
  ],
  exports: [OutboxWriter],
})
export class OutboxModule {}
