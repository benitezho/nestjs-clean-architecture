export abstract class UnitOfWork {
  /** Runs `work` in one transaction; nested calls join the outer one. */
  abstract run<T>(work: () => Promise<T>): Promise<T>;
}
