import { Clock } from '../ports/clock';
import { IdGenerator } from '../ports/id-generator';
import { UnitOfWork } from '../ports/unit-of-work';

export class FixedClock extends Clock {
  constructor(private current: Date) {
    super();
  }

  now(): Date {
    return this.current;
  }

  advanceTo(date: Date): void {
    this.current = date;
  }
}

export class SequentialIdGenerator extends IdGenerator {
  private counter = 0;

  generate(): string {
    this.counter += 1;
    return `00000000-0000-4000-8000-${this.counter.toString().padStart(12, '0')}`;
  }
}

export class PassThroughUnitOfWork extends UnitOfWork {
  runs = 0;

  run<T>(work: () => Promise<T>): Promise<T> {
    this.runs += 1;
    return work();
  }
}
