import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { IdempotencyService } from './idempotency.service';

@Module({
  imports: [DatabaseModule],
  providers: [IdempotencyService],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
