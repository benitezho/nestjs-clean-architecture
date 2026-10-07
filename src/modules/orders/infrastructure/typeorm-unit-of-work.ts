import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../application/ports/unit-of-work';
import { TransactionManager } from '../../../shared/database/transaction-manager';

@Injectable()
export class TypeormUnitOfWork extends UnitOfWork {
  constructor(private readonly transactions: TransactionManager) {
    super();
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.transactions.run(work);
  }
}
