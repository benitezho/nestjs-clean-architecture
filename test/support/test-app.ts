import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventPublisher } from '../../src/shared/outbox/event-publisher';
import { setupOpenApi } from '../../src/shared/http/openapi';
import { createIsolatedDatabase } from './pg-environment';

export interface TestApp {
  app: INestApplication;
  dataSource: DataSource;
  reset(): Promise<void>;
}

let environment: Promise<void> | undefined;

/**
 * AppModule validates process.env when it is first imported, so the database
 * and env overrides are fixed per test file: the first call wins.
 */
function prepareEnvironment(overrides: Record<string, string>): Promise<void> {
  environment ??= createIsolatedDatabase().then((databaseUrl) => {
    Object.assign(
      process.env,
      { NODE_ENV: 'test', LOG_LEVEL: 'silent', OUTBOX_RELAY_ENABLED: 'false' },
      overrides,
      { DATABASE_URL: databaseUrl },
    );
  });
  return environment;
}

export async function createTestApp(
  options: { env?: Record<string, string>; publisher?: EventPublisher } = {},
): Promise<TestApp> {
  await prepareEnvironment(options.env ?? {});
  const { AppModule } = await import('../../src/app.module');

  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.publisher) {
    builder.overrideProvider(EventPublisher).useValue(options.publisher);
  }
  const app = (await builder.compile()).createNestApplication();
  setupOpenApi(app);
  await app.init();

  const dataSource = app.get(DataSource);
  return {
    app,
    dataSource,
    reset: async () => {
      await dataSource.query(
        'TRUNCATE orders, order_items, outbox_events, idempotency_keys RESTART IDENTITY CASCADE',
      );
    },
  };
}

export async function eventually(
  assertion: () => Promise<void> | void,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      await assertion();
      return;
    } catch (error) {
      if (Date.now() > deadline) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}
