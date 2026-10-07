import { Injectable } from '@nestjs/common';
import { Clock } from '../application/ports/clock';

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
