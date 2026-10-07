import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/** Single source of truth for the app and the TypeORM CLI (ts and compiled js). */
export function buildDataSourceOptions(url: string): DataSourceOptions {
  return {
    type: 'postgres',
    url,
    entities: [join(__dirname, '..', '..', '**', '*.entity.{ts,js}')],
    migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
    synchronize: false,
    migrationsRun: false,
  };
}
