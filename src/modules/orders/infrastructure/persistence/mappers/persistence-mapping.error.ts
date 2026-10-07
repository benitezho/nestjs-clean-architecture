/** Stored data that cannot be turned into a valid domain object: a server fault, not a client error. */
export class PersistenceMappingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
  }
}
