import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { IdGenerator } from '../application/ports/id-generator';

@Injectable()
export class UuidIdGenerator extends IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
