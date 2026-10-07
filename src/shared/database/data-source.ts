import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source-options';

/** Entry point for the TypeORM CLI (`pnpm migration:*`). Not imported by the app. */
export default new DataSource(buildDataSourceOptions(process.env.DATABASE_URL ?? ''));
