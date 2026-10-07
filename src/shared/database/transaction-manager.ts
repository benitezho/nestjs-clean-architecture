import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Propagates the active transaction through AsyncLocalStorage so repositories
 * can join it without receiving a manager as a parameter.
 */
@Injectable()
export class TransactionManager {
  private readonly storage = new AsyncLocalStorage<EntityManager>();

  constructor(private readonly dataSource: DataSource) {}

  /** The transactional manager when inside `run`, otherwise the default one. */
  get manager(): EntityManager {
    return this.storage.getStore() ?? this.dataSource.manager;
  }

  get inTransaction(): boolean {
    return this.storage.getStore() !== undefined;
  }

  run<T>(work: () => Promise<T>): Promise<T> {
    if (this.inTransaction) {
      return work();
    }
    return this.dataSource.transaction((manager) => this.storage.run(manager, work));
  }

  /** For writes that are only correct when they commit together with something else. */
  requireManager(): EntityManager {
    const manager = this.storage.getStore();
    if (!manager) {
      throw new Error('This operation must run inside TransactionManager.run()');
    }
    return manager;
  }
}
