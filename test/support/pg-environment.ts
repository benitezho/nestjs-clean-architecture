import { randomBytes } from 'node:crypto';
import { Client } from 'pg';

export const TEMPLATE_DATABASE = 'template_migrated';

export function withDatabase(connectionUrl: string, database: string): string {
  const url = new URL(connectionUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

/**
 * Clones the migrated template into a fresh database, so every test file gets
 * full isolation without re-running migrations.
 */
export async function createIsolatedDatabase(): Promise<string> {
  const adminUrl = process.env.TEST_PG_ADMIN_URL;
  if (!adminUrl) {
    throw new Error('TEST_PG_ADMIN_URL is not set; is the Jest globalSetup configured?');
  }
  const name = `test_${randomBytes(6).toString('hex')}`;
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  try {
    await createFromTemplate(admin, name);
  } finally {
    await admin.end();
  }
  return withDatabase(adminUrl, name);
}

/** Postgres rejects concurrent CREATE DATABASE from one template; retry briefly. */
async function createFromTemplate(admin: Client, name: string): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await admin.query(`CREATE DATABASE "${name}" TEMPLATE ${TEMPLATE_DATABASE}`);
      return;
    } catch (error) {
      if (attempt >= 10) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }
}
