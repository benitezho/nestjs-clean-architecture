import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { TEMPLATE_DATABASE, withDatabase } from './pg-environment';

const ROOT = join(__dirname, '..', '..');

declare global {
  var __PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

export default async function globalSetup(): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:17-alpine').start();
  const adminUrl = container.getConnectionUri();

  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  await admin.query(`CREATE DATABASE ${TEMPLATE_DATABASE}`);
  await admin.end();

  // Runs the real CLI path (pnpm migration:run) against the template database.
  execFileSync(
    join(ROOT, 'node_modules', '.bin', 'typeorm-ts-node-commonjs'),
    ['-d', 'src/shared/database/data-source.ts', 'migration:run'],
    {
      cwd: ROOT,
      env: {
        ...process.env,
        DATABASE_URL: withDatabase(adminUrl, TEMPLATE_DATABASE),
        TS_NODE_TRANSPILE_ONLY: 'true',
      },
      stdio: 'pipe',
    },
  );

  process.env.TEST_PG_ADMIN_URL = adminUrl;
  globalThis.__PG_CONTAINER__ = container;
}
